import { SEED, generateSeed } from "./seed.js";
/* ==========================================================================
   store.js — the data layer
   --------------------------------------------------------------------------
   Everything the UI needs to read or write lives behind `Store`.  Persistence
   is localStorage with an in-memory fallback (so the pages still work when a
   browser blocks site data, or when opened straight from the file system in a
   private window).

   When the PHP / Node / Spring backend is ready you do NOT rewrite the pages:
   replace the bodies in js/api.js with fetch() calls to the same-named
   endpoints. Store then becomes the offline demo mode only.
   ========================================================================== */
const global = globalThis;

  'use strict';

  var KEY = 'amap.db.v6';
  var memory = null;                    // fallback when localStorage is unavailable
  var listeners = [];
  const tables = ['departments','services','users','applications','documents','status_logs','grievances','notifications'];
  let baseline, baselineJSON, queuedCommit = false;

  /* ------------------------------------------------------------ storage */

  function canPersist() {
    try {
      var k = '__amap_probe__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  var PERSIST = canPersist();

  function readRaw() {
    if (!PERSIST) return memory;
    try {
      const saved = JSON.parse(global.localStorage.getItem(KEY));
      if (!saved || saved.version !== SEED.version || !saved.delta) return saved;
      const seed = generateSeed(Date.parse(saved.seeded_at));
      setBaseline(seed);
      const restored = {version:seed.version,seeded_at:seed.generated_at};
      for (const table of tables) {
        const delta = saved.delta[table] || {}, removed = new Set(delta.removed || []), changed = new Map((delta.rows || []).map(r=>[r.id,r]));
        restored[table] = seed[table].filter(r=>!removed.has(r.id)).map(r=>{const row=changed.get(r.id)||r;changed.delete(r.id);return row;}).concat([...changed.values()]);
      }
      return restored;
    }
    catch (e) { return null; }
  }

  function writeRaw(db) {
    memory = db;
    if (!PERSIST) return;
    try {
      const delta = {};
      for (const table of tables) {
        const currentIds = new Set(db[table].map(r=>r.id));
        delta[table] = {rows:db[table].filter(r=>baselineJSON[table].get(r.id)!==JSON.stringify(r)),removed:baseline[table].filter(r=>!currentIds.has(r.id)).map(r=>r.id)};
      }
      global.localStorage.setItem(KEY, JSON.stringify({version:db.version,seeded_at:db.seeded_at,delta}));
    }
    catch (e) { PERSIST = false; if (typeof Store !== 'undefined' && Store) Store.persistent = false; }
  }

  function freshDb() {
    var s = SEED;
    setBaseline(s);
    return {
      version: s.version,
      seeded_at: s.generated_at,
      departments: clone(s.departments),
      services: clone(s.services),
      users: clone(s.users),
      applications: clone(s.applications),
      documents: clone(s.documents),
      status_logs: clone(s.status_logs),
      grievances: clone(s.grievances),
      notifications: clone(s.notifications)
    };
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function setBaseline(seed) {baseline=seed;baselineJSON=Object.fromEntries(tables.map(table=>[table,new Map(seed[table].map(r=>[r.id,JSON.stringify(r)]))]));}

  var db = (function init() {
    var existing = readRaw();
    if (existing && existing.version === SEED.version) {if(!baseline)setBaseline(generateSeed(Date.parse(existing.seeded_at)));return existing;}
    var f = freshDb();
    writeRaw(f);
    return f;
  })();

  function commit() {
    // Coalesce multiple writes in one mutation (audit + notification + entity).
    if(queuedCommit)return;
    queuedCommit=true;
    queueMicrotask(()=>{queuedCommit=false;writeRaw(db);listeners.forEach(function(fn){try{fn(db);}catch(e){}});});
  }

  /* -------------------------------------------------------------- helpers */

  function nextId(table) {
    return db[table].reduce(function (m, r) { return Math.max(m, r.id || 0); }, 0) + 1;
  }
  const indexes = new Map();
  function byId(table, id) {
    let index=indexes.get(table),rows=db[table];
    if(!index||index.rows!==rows||index.length!==rows.length){index={rows,length:rows.length,map:new Map(rows.map(r=>[r.id,r]))};indexes.set(table,index);}
    return index.map.get(Number(id)) || null;
  }
  function where(table, fn) { return db[table].filter(fn); }
  let docIndex;
  function documentCounts(){if(!docIndex||docIndex.source!==db.documents||docIndex.length!==db.documents.length){const counts=new Map();db.documents.forEach(d=>counts.set(d.application_id,(counts.get(d.application_id)||0)+1));docIndex={source:db.documents,length:db.documents.length,counts};}return docIndex.counts;}
  function matchingApplications(f={}) {
    const q=String(f.q||'').trim().toLowerCase(),statusIn=typeof f.statusIn==='string'?f.statusIn.split(','):f.statusIn;
    return db.applications.filter(a=>{
      for(const key of ['user_id','department_id','service_id'])if(f[key]&&a[key]!==Number(f[key]))return false;
      if(f.officer_id==='unassigned'?!!a.officer_id:f.officer_id&&a.officer_id!==Number(f.officer_id))return false;
      if(f.status&&a.status!==f.status||statusIn&&!statusIn.includes(a.status)||f.priority&&a.priority!==f.priority)return false;
      if(f.from&&a.submitted_at.slice(0,10)<f.from||f.to&&a.submitted_at.slice(0,10)>f.to)return false;
      if(q&&![a.ref,a.subject,byId('users',a.user_id)?.full_name,byId('services',a.service_id)?.name].some(text=>String(text||'').toLowerCase().includes(q)))return false;
      return true;
    });
  }
  function metrics(f={}) {const now=Date.now();return matchingApplications(f).map(a=>{const age=(now-Date.parse(a.submitted_at))/86400000,isOpen=OPEN_STATUSES.includes(a.status);return {...a,ageDays:Math.floor(age),isOpen,isOverdue:isOpen&&age>a.sla_days,processingDays:a.decided_at?Math.round(days(a.submitted_at,a.decided_at)*10)/10:null};});}
  function ts() { return new Date().toISOString(); }
  function days(a, b) { return (new Date(b) - new Date(a)) / 86400000; }

  var STATUS_ORDER = ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'FORWARDED', 'APPROVED', 'REJECTED', 'WITHDRAWN'];
  var OPEN_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'NEEDS_INFO', 'FORWARDED'];
  var CLOSED_STATUSES = ['APPROVED', 'REJECTED', 'WITHDRAWN'];

  var STATUS_LABEL = {
    SUBMITTED: 'Submitted',
    UNDER_REVIEW: 'Under Review',
    NEEDS_INFO: 'Info Requested',
    FORWARDED: 'Forwarded',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    WITHDRAWN: 'Withdrawn'
  };

  /* ======================================================================
     PUBLIC API
     ====================================================================== */
  var Store = {

    /* -- meta ----------------------------------------------------------- */
    persistent: PERSIST,
    STATUS_ORDER: STATUS_ORDER,
    OPEN_STATUSES: OPEN_STATUSES,
    CLOSED_STATUSES: CLOSED_STATUSES,
    STATUS_LABEL: STATUS_LABEL,

    raw: function () { return db; },
    onChange: function (fn) { listeners.push(fn); return () => { listeners = listeners.filter(x => x !== fn); }; },
    reset: function () { db = freshDb(); commit(); return db; },

    /* -- departments ---------------------------------------------------- */
    departments: function () { return clone(db.departments); },
    department: function (id) { var d = byId('departments', id); return d ? clone(d) : null; },
    departmentByCode: function (code) {
      var d = where('departments', function (x) { return x.code === code; })[0];
      return d ? clone(d) : null;
    },
    saveDepartment: function (data) {
      if (data.id) {
        var d = byId('departments', data.id);
        if (!d) return null;
        Object.keys(data).forEach(function (k) { if (k !== 'id') d[k] = data[k]; });
        commit();
        return clone(d);
      }
      data.id = nextId('departments');
      db.departments.push(data);
      commit();
      return clone(data);
    },
    deleteDepartment: function (id) {
      id = Number(id);
      if (db.grievances.some(g => g.department_id === id) || db.users.some(u => u.department_id === id)) return false;
      if (db.applications.some(a => byId('services', a.service_id)?.department_id === id)) return false;
      if (where('applications', function (a) { return a.department_id === id; }).length) return false;
      db.departments = db.departments.filter(function (d) { return d.id !== id; });
      db.services = db.services.filter(function (s) { return s.department_id !== id; });
      commit();
      return true;
    },

    /* -- services ------------------------------------------------------- */
    services: function (deptId) {
      var list = deptId ? where('services', function (s) { return s.department_id === Number(deptId); })
                        : db.services;
      return clone(list);
    },
    service: function (id) { var s = byId('services', id); return s ? clone(s) : null; },
    saveService: function (data) {
      if (data.id) {
        var s = byId('services', data.id);
        if (!s) return null;
        Object.keys(data).forEach(function (k) { if (k !== 'id') s[k] = data[k]; });
        commit();
        return clone(s);
      }
      data.id = nextId('services');
      data.is_active = data.is_active === undefined ? 1 : data.is_active;
      db.services.push(data);
      commit();
      return clone(data);
    },
    deleteService: function (id) {
      id = Number(id);
      if (where('applications', function (a) { return a.service_id === id; }).length) return false;
      db.services = db.services.filter(function (s) { return s.id !== id; });
      commit();
      return true;
    },

    /* -- users ---------------------------------------------------------- */
    users: function (filter) {
      var list = db.users.slice();
      if (filter && filter.role) list = list.filter(function (u) { return u.role === filter.role; });
      if (filter && filter.department_id) list = list.filter(function (u) { return u.department_id === Number(filter.department_id); });
      if (filter && filter.q) {
        var q = filter.q.toLowerCase();
        list = list.filter(function (u) {
          return u.full_name.toLowerCase().indexOf(q) > -1 || u.email.toLowerCase().indexOf(q) > -1;
        });
      }
      return clone(list);
    },
    user: function (id) { var u = byId('users', id); return u ? clone(u) : null; },
    userByEmail: function (email) {
      var e = String(email || '').trim().toLowerCase();
      var u = where('users', function (x) { return x.email.toLowerCase() === e; })[0];
      return u ? clone(u) : null;
    },
    saveUser: function (data) {
      const duplicate = Store.userByEmail(data.email);
      if (duplicate && duplicate.id !== Number(data.id)) throw new Error('An account with this email already exists.');
      const merged = { ...(data.id ? Store.user(data.id) : {}), ...data };
      if (merged.role === 'OFFICER' && !Store.department(merged.department_id)) throw new Error('Choose a department for the officer.');
      if (data.id) {
        var u = byId('users', data.id);
        if (!u) return null;
        Object.keys(data).forEach(function (k) { if (k !== 'id') u[k] = data[k]; });
        commit();
        return clone(u);
      }
      data.id = nextId('users');
      data.status = data.status || 'ACTIVE';
      data.created_at = ts();
      data.avatar_class = ['', 'a2', 'a3', 'a4'][data.id % 4];
      db.users.push(data);
      commit();
      return clone(data);
    },
    setUserStatus: function (id, status) {
      var u = byId('users', id);
      if (!u) return null;
      u.status = status;
      commit();
      return clone(u);
    },

    /* -- applications --------------------------------------------------- */
    applications: function (f) {
      f = f || {};
      return matchingApplications(f).sort((a,b)=>b.submitted_at.localeCompare(a.submitted_at)).map(expand);
    },

    application: function (id) {
      var a = byId('applications', id);
      return a ? expand(a) : null;
    },
    applicationByRef: function (ref) {
      var r = String(ref || '').trim().toUpperCase();
      var a = where('applications', function (x) { return x.ref.toUpperCase() === r; })[0];
      return a ? expand(a) : null;
    },

    createApplication: function (data) {
      var svc = byId('services', data.service_id);
      if (!svc || !svc.is_active) throw new Error('This service is not accepting applications.');
      if (Store.user(data.user_id)?.role !== 'CITIZEN') throw new Error('A citizen account is required.');
      validateFiles(data.documents || []);
      var id = nextId('applications');
      var now = ts();
      var year = new Date().getFullYear();
      var app = {
        id: id,
        ref: 'AMP-' + year + '-' + String(100000 + id).slice(1),
        user_id: Number(data.user_id),
        service_id: svc.id,
        department_id: svc.department_id,
        subject: data.subject || svc.name,
        details: data.details || '',
        form_data: clone(data.form_data || {}),
        priority: data.priority || 'NORMAL',
        status: 'SUBMITTED',
        officer_id: null,
        submitted_at: now,
        updated_at: now,
        decided_at: null,
        remarks: '',
        fee_paid: svc.fee,
        sla_days: svc.sla_days
      };
      db.applications.push(app);

      (data.documents || []).forEach(function (d) {
        db.documents.push({
          id: nextId('documents'),
          application_id: id,
          name: d.name,
          file_name: d.file_name || d.name,
          mime: d.mime || 'application/pdf',
          size_kb: d.size_kb || 0,
          content: d.content || null,
          uploaded_at: now,
          verified: 0
        });
      });

      db.status_logs.push({
        id: nextId('status_logs'), application_id: id,
        from_status: null, to_status: 'SUBMITTED',
        actor_id: app.user_id, actor_role: 'CITIZEN',
        remarks: 'Application submitted online.', created_at: now
      });

      Store.pushNotification(app.user_id, 'Application submitted',
        app.ref + ' has been received and is awaiting assignment.', 'success',
        'citizen-application.html?ref=' + app.ref);

      commit();
      return expand(app);
    },

    /**
     * Move an application to a new status and write the audit trail.
     * @param {number} appId
     * @param {string} toStatus  one of STATUS_ORDER
     * @param {object} actor     { id, role, full_name }
     * @param {string} remarks
     * @param {object} extra     e.g. { officer_id, department_id }
     */
    transition: function (appId, toStatus, actor, remarks, extra) {
      var a = byId('applications', appId);
      if (!a) throw new Error('Application not found.');
      validateTransition(a, toStatus, actor, remarks, extra);
      var from = a.status;
      var now = ts();

      a.status = toStatus;
      a.updated_at = now;
      a.remarks = remarks || '';
      if (extra && Object.hasOwn(extra, 'officer_id')) a.officer_id = extra.officer_id ? Number(extra.officer_id) : null;
      if (extra && extra.department_id) a.department_id = Number(extra.department_id);
      if (toStatus === 'FORWARDED' && !extra?.officer_id) a.officer_id = null;
      if (CLOSED_STATUSES.indexOf(toStatus) > -1) a.decided_at = now;
      if (toStatus === 'UNDER_REVIEW' && !a.officer_id && actor && actor.role === 'OFFICER') {
        a.officer_id = actor.id;
      }

      db.status_logs.push({
        id: nextId('status_logs'), application_id: a.id,
        from_status: from, to_status: toStatus,
        actor_id: actor ? actor.id : null,
        actor_role: actor ? actor.role : 'SYSTEM',
        remarks: remarks || '', created_at: now
      });

      var titles = {
        UNDER_REVIEW: 'Application under review',
        NEEDS_INFO: 'Action required on your application',
        FORWARDED: 'Application forwarded',
        APPROVED: 'Application approved',
        REJECTED: 'Application rejected',
        WITHDRAWN: 'Application withdrawn'
      };
      var kinds = {
        APPROVED: 'success', REJECTED: 'danger', NEEDS_INFO: 'warning',
        FORWARDED: 'info', UNDER_REVIEW: 'info', WITHDRAWN: 'info'
      };
      Store.pushNotification(a.user_id, titles[toStatus] || 'Status updated',
        a.ref + ' — ' + (STATUS_LABEL[toStatus] || toStatus) + '. ' + (remarks || ''),
        kinds[toStatus] || 'info', 'citizen-application.html?ref=' + a.ref);

      commit();
      return expand(a);
    },

    addDocuments: function (appId, docs) {
      const app = Store.application(appId);
      if (!app?.isOpen) throw new Error('Documents can only be added to an open application.');
      validateFiles(docs || []);
      var now = ts();
      (docs || []).forEach(function (d) {
        db.documents.push({
          id: nextId('documents'), application_id: Number(appId),
          name: d.name, file_name: d.file_name || d.name,
          mime: d.mime || 'application/pdf', size_kb: d.size_kb || 0,
          content: d.content || null,
          uploaded_at: now, verified: 0
        });
      });
      if(docs?.length){
        const row=byId('applications',appId);row.updated_at=now;
        audit(row,row.status,Store.user(row.user_id),docs.length+' supporting document(s) added by the applicant.');
        Store.pushNotification(row.user_id,'Documents received',row.ref+' — Additional documents have been attached.','info','/citizen/applications/'+row.id);
      }
      commit();
      return Store.documents(appId);
    },
    documents: function (appId) {
      return clone(where('documents', function (d) { return d.application_id === Number(appId); }));
    },
    verifyDocument: function (docId, verified, actor) {
      var d = byId('documents', docId);
      if (!d) return null;
      const app = Store.application(d.application_id);
      if (!app?.isOpen) throw new Error('This file has already been closed.');
      d.verified = verified ? 1 : 0;
      audit(app, app.status, actor, (verified ? 'Verified document: ' : 'Document verification removed: ') + d.name);
      commit();
      return clone(d);
    },

    statusLogs: function (appId) {
      return clone(where('status_logs', function (l) { return l.application_id === Number(appId); }))
        .sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at) || a.id - b.id; });
    },

    /* -- grievances ----------------------------------------------------- */
    grievances: function (f) {
      f = f || {};
      var list = db.grievances.slice();
      if (f.user_id)       list = list.filter(function (g) { return g.user_id === Number(f.user_id); });
      if (f.department_id) list = list.filter(function (g) { return g.department_id === Number(f.department_id); });
      if (f.status)        list = list.filter(function (g) { return g.status === f.status; });
      if (f.q) {
        var q = f.q.toLowerCase();
        list = list.filter(function (g) {
          return g.subject.toLowerCase().indexOf(q) > -1 || g.ref.toLowerCase().indexOf(q) > -1;
        });
      }
      list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      return list.map(function (g) {
        var o = clone(g);
        o.department = Store.department(g.department_id);
        o.citizen = Store.user(g.user_id);
        o.officer = g.officer_id ? Store.user(g.officer_id) : null;
        return o;
      });
    },
    createGrievance: function (data, actor) {
      if (!Store.department(data.department_id)) throw new Error('Choose a department.');
      var id = nextId('grievances');
      var now = ts();
      var g = {
        id: id,
        ref: 'GRV-' + new Date().getFullYear() + '-' + String(10000 + id).slice(1),
        user_id: Number(data.user_id),
        department_id: Number(data.department_id),
        category: data.category,
        subject: data.subject,
        description: data.description,
        location: data.location || '',
        status: 'OPEN',
        priority: data.priority || 'NORMAL',
        officer_id: null,
        created_at: now, updated_at: now, resolution: ''
      };
      db.grievances.push(g);
      grievanceAudit(g, null, actor || Store.user(g.user_id), 'Grievance filed.');
      Store.pushNotification(g.user_id, 'Grievance registered',
        g.ref + ' has been forwarded to the concerned department.', 'success', 'citizen-grievances.html');
      commit();
      return clone(g);
    },
    updateGrievance: function (id, changes, actor) {
      var g = byId('grievances', id);
      if (!g) throw new Error('Grievance not found.');
      const from = g.status;
      const allowed = { OPEN: ['IN_PROGRESS'], IN_PROGRESS: ['RESOLVED'], RESOLVED: ['CLOSED'], CLOSED: [] };
      if (!allowed[from]?.includes(changes.status)) throw new Error('This grievance status change is not allowed.');
      if (!actor || !['OFFICER', 'ADMIN'].includes(actor.role) || (actor.role === 'OFFICER' && actor.department_id !== g.department_id)) throw new Error('You cannot manage this grievance.');
      if (changes.status === 'RESOLVED' && (changes.resolution || '').trim().length < 20) throw new Error('Explain the resolution in at least 20 characters.');
      Object.keys(changes).forEach(function (k) { g[k] = changes[k]; });
      g.updated_at = ts();
      grievanceAudit(g, from, actor, changes.resolution || 'Department officer started reviewing the grievance.');
      Store.pushNotification(g.user_id, 'Grievance updated', g.ref + ' — ' + g.status.replaceAll('_', ' '), g.status === 'RESOLVED' ? 'success' : 'info', '/citizen/grievances');
      commit();
      return clone(g);
    },

    /* -- notifications -------------------------------------------------- */
    notifications: function (userId, onlyUnread) {
      var list = where('notifications', function (n) {
        return n.user_id === Number(userId) && (!onlyUnread || !n.is_read);
      });
      list.sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
      return clone(list);
    },
    unreadCount: function (userId) {
      return where('notifications', function (n) {
        return n.user_id === Number(userId) && !n.is_read;
      }).length;
    },
    pushNotification: function (userId, title, message, type, link) {
      db.notifications.push({
        id: nextId('notifications'), user_id: Number(userId),
        title: title, message: message, type: type || 'info',
        is_read: 0, created_at: ts(), link: link || ''
      });
      commit();
    },
    markNotificationsRead: function (userId) {
      db.notifications.forEach(function (n) {
        if (n.user_id === Number(userId)) n.is_read = 1;
      });
      commit();
    },

    /* ==================================================================
       ANALYTICS  — everything the admin dashboard and reports render
       ================================================================== */
    analytics: {

      /** Headline counters, optionally scoped by department / date range. */
      kpis: function (scope) {
        var apps = metrics(scope || {});
        var total = apps.length;
        var approved = apps.filter(function (a) { return a.status === 'APPROVED'; });
        var rejected = apps.filter(function (a) { return a.status === 'REJECTED'; });
        var pending = apps.filter(function (a) { return OPEN_STATUSES.indexOf(a.status) > -1; });
        var decided = approved.length + rejected.length;

        var durations = approved.concat(rejected)
          .filter(function (a) { return a.decided_at; })
          .map(function (a) { return days(a.submitted_at, a.decided_at); });
        var avg = durations.length
          ? durations.reduce(function (s, v) { return s + v; }, 0) / durations.length : 0;

        var overdue = pending.filter(function (a) {
          return days(a.submitted_at, new Date().toISOString()) > a.sla_days;
        });

        return {
          total: total,
          pending: pending.length,
          approved: approved.length,
          rejected: rejected.length,
          withdrawn: apps.filter(function (a) { return a.status === 'WITHDRAWN'; }).length,
          decided: decided,
          approvalRate: decided ? Math.round((approved.length / decided) * 1000) / 10 : 0,
          avgProcessingDays: Math.round(avg * 10) / 10,
          overdue: overdue.length,
          slaCompliance: pending.length ? Math.round(((pending.length - overdue.length) / pending.length) * 1000) / 10 : 100,
          citizens: Store.users({ role: 'CITIZEN' }).length,
          officers: Store.users({ role: 'OFFICER' }).length,
          departments: db.departments.length,
          services: db.services.length,
          grievancesOpen: db.grievances.filter(function (g) { return g.status === 'OPEN' || g.status === 'IN_PROGRESS'; }).length
        };
      },

      /** Applications per month for the last `n` months. */
      monthly: function (n, scope) {
        n = n || 12;
        var apps = metrics(scope || {});
        var now = new Date();
        var buckets = [];
        for (var i = n - 1; i >= 0; i--) {
          var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          buckets.push({
            key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'),
            label: d.toLocaleDateString('en-IN', { month: 'short' }),
            fullLabel: d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
            received: 0, approved: 0, rejected: 0
          });
        }
        var index = {};
        buckets.forEach(function (b) { index[b.key] = b; });

        apps.forEach(function (a) {
          var s = new Date(a.submitted_at);
          var k = s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0');
          if (index[k]) index[k].received++;
          if (a.decided_at) {
            var e = new Date(a.decided_at);
            var k2 = e.getFullYear() + '-' + String(e.getMonth() + 1).padStart(2, '0');
            if (index[k2]) {
              if (a.status === 'APPROVED') index[k2].approved++;
              if (a.status === 'REJECTED') index[k2].rejected++;
            }
          }
        });
        return buckets;
      },

      /** Applications per day for the last `n` days. */
      daily: function (n, scope) {
        n = n || 30;
        var apps = metrics(scope || {});
        var out = [];
        var today = new Date(); today.setHours(0, 0, 0, 0);
        for (var i = n - 1; i >= 0; i--) {
          var d = new Date(today.getTime() - i * 86400000);
          out.push({
            key: d.toISOString().slice(0, 10),
            label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
            received: 0
          });
        }
        var idx = {};
        out.forEach(function (o) { idx[o.key] = o; });
        apps.forEach(function (a) {
          var k = a.submitted_at.slice(0, 10);
          if (idx[k]) idx[k].received++;
        });
        return out;
      },

      /** Count per status. */
      byStatus: function (scope) {
        var apps = metrics(scope || {});
        return STATUS_ORDER.map(function (s) {
          return {
            key: s,
            label: STATUS_LABEL[s],
            value: apps.filter(function (a) { return a.status === s; }).length
          };
        }).filter(function (r) { return r.value > 0; });
      },

      /** Volume + performance per department. */
      byDepartment: function (scope) {
        var apps = metrics(scope || {});
        return db.departments.map(function (d) {
          var mine = apps.filter(function (a) { return a.department_id === d.id; });
          var ap = mine.filter(function (a) { return a.status === 'APPROVED'; });
          var rj = mine.filter(function (a) { return a.status === 'REJECTED'; });
          var pend = mine.filter(function (a) { return OPEN_STATUSES.indexOf(a.status) > -1; });
          var dur = ap.concat(rj).filter(function (a) { return a.decided_at; })
            .map(function (a) { return days(a.submitted_at, a.decided_at); });
          var avg = dur.length ? dur.reduce(function (s, v) { return s + v; }, 0) / dur.length : 0;
          var late = pend.filter(function (a) {
            return days(a.submitted_at, new Date().toISOString()) > a.sla_days;
          }).length;
          return {
            id: d.id, code: d.code, name: d.name,
            total: mine.length, approved: ap.length, rejected: rj.length, pending: pend.length,
            overdue: late,
            avgDays: Math.round(avg * 10) / 10,
            approvalRate: (ap.length + rj.length) ? Math.round((ap.length / (ap.length + rj.length)) * 1000) / 10 : 0
          };
        }).sort(function (a, b) { return b.total - a.total; });
      },

      /** Most-requested services. */
      topServices: function (limit, scope) {
        var apps = metrics(scope || {});
        var counts = {};
        apps.forEach(function (a) { counts[a.service_id] = (counts[a.service_id] || 0) + 1; });
        return Object.keys(counts).map(function (sid) {
          var s = byId('services', sid);
          var d = s ? byId('departments', s.department_id) : null;
          return {
            id: Number(sid),
            name: s ? s.name : 'Unknown',
            department: d ? d.code : '',
            value: counts[sid]
          };
        }).sort(function (a, b) { return b.value - a.value; }).slice(0, limit || 6);
      },

      /** Officer workload and decision counts. */
      officerPerformance: function (deptId) {
        var offs = Store.users({ role: 'OFFICER', department_id: deptId || undefined });
        return offs.map(function (o) {
          var mine = db.applications.filter(function (a) { return a.officer_id === o.id; });
          var ap = mine.filter(function (a) { return a.status === 'APPROVED'; }).length;
          var rj = mine.filter(function (a) { return a.status === 'REJECTED'; }).length;
          var open = mine.filter(function (a) { return OPEN_STATUSES.indexOf(a.status) > -1; }).length;
          var dur = mine.filter(function (a) { return a.decided_at; })
            .map(function (a) { return days(a.submitted_at, a.decided_at); });
          return {
            id: o.id, name: o.full_name, designation: o.designation || 'Officer',
            department_id: o.department_id,
            handled: mine.length, approved: ap, rejected: rj, open: open,
            avgDays: dur.length ? Math.round((dur.reduce(function (s, v) { return s + v; }, 0) / dur.length) * 10) / 10 : 0
          };
        }).sort(function (a, b) { return b.handled - a.handled; });
      },

      /** Decisions made in the last `n` days (officer dashboard). */
      recentDecisions: function (n, officerId) {
        n = n || 7;
        var out = [];
        var today = new Date(); today.setHours(0, 0, 0, 0);
        for (var i = n - 1; i >= 0; i--) {
          var d = new Date(today.getTime() - i * 86400000);
          out.push({
            key: d.toISOString().slice(0, 10),
            label: d.toLocaleDateString('en-IN', { weekday: 'short' }),
            approved: 0, rejected: 0
          });
        }
        var idx = {};
        out.forEach(function (o) { idx[o.key] = o; });
        db.status_logs.forEach(function (l) {
          if (officerId && l.actor_id !== Number(officerId)) return;
          if (l.to_status !== 'APPROVED' && l.to_status !== 'REJECTED') return;
          var k = l.created_at.slice(0, 10);
          if (!idx[k]) return;
          if (l.to_status === 'APPROVED') idx[k].approved++; else idx[k].rejected++;
        });
        return out;
      },

      /** Processing-time distribution buckets. */
      processingBuckets: function (scope) {
        var apps = metrics(scope || {}).filter(function (a) { return a.decided_at; });
        var b = [
          { label: '0–7 d', min: 0, max: 7, value: 0 },
          { label: '8–15 d', min: 7, max: 15, value: 0 },
          { label: '16–30 d', min: 15, max: 30, value: 0 },
          { label: '31–45 d', min: 30, max: 45, value: 0 },
          { label: '45+ d', min: 45, max: 1e9, value: 0 }
        ];
        apps.forEach(function (a) {
          var d = days(a.submitted_at, a.decided_at);
          for (var i = 0; i < b.length; i++) {
            if ((i === 0 ? d >= 0 : d > b[i].min) && d <= b[i].max) { b[i].value++; break; }
          }
        });
        return b;
      },

      /** Latest audit-trail entries, expanded for the activity feed. */
      recentActivity: function (limit, deptId) {
        var logs = db.status_logs.slice().sort(function (a, b) {
          return new Date(b.created_at) - new Date(a.created_at);
        });
        var out = [];
        for (var i = 0; i < logs.length && out.length < (limit || 12); i++) {
          var l = logs[i];
          var app = byId('applications', l.application_id);
          if (!app) continue;
          if (deptId && app.department_id !== Number(deptId)) continue;
          var actor = l.actor_id ? byId('users', l.actor_id) : null;
          out.push({
            id: l.id, ref: app.ref, application_id: app.id,
            to_status: l.to_status, from_status: l.from_status,
            actor: actor ? actor.full_name : 'System',
            actor_role: l.actor_role,
            remarks: l.remarks, at: l.created_at
          });
        }
        return out;
      },

      /** Grievance counts by status and by department. */
      grievanceSummary: function () {
        var g = db.grievances;
        var byStatus = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(function (s) {
          return { key: s, label: s.replace('_', ' '), value: g.filter(function (x) { return x.status === s; }).length };
        });
        var byCat = {};
        g.forEach(function (x) { byCat[x.category] = (byCat[x.category] || 0) + 1; });
        var cats = Object.keys(byCat).map(function (k) { return { name: k, value: byCat[k] }; })
          .sort(function (a, b) { return b.value - a.value; });
        return { total: g.length, byStatus: byStatus, byCategory: cats };
      }
    }
  };

  /* Attach related rows so pages never have to join by hand. */
  function expand(a) {
    var o = clone(a);
    o.service = Store.service(a.service_id);
    o.department = Store.department(a.department_id);
    o.citizen = safeUser(Store.user(a.user_id));
    o.officer = a.officer_id ? safeUser(Store.user(a.officer_id)) : null;
    o.documentCount = documentCounts().get(a.id) || 0;
    o.ageDays = Math.floor(days(a.submitted_at, new Date().toISOString()));
    o.isOpen = OPEN_STATUSES.indexOf(a.status) > -1;
    o.isOverdue = o.isOpen && days(a.submitted_at, ts()) > a.sla_days;
    o.processingDays = a.decided_at ? Math.round(days(a.submitted_at, a.decided_at) * 10) / 10 : null;
    o.statusLabel = STATUS_LABEL[a.status] || a.status;
    return o;
  }

  function safeUser(u) { if (!u) return null; const { password, ...rest } = u; return rest; }
  function validateFiles(files) {
    files.forEach(f => {
      if (!['application/pdf', 'image/png', 'image/jpeg'].includes(f.mime) || !f.content || f.size_kb <= 0 || f.size_kb > 5120) throw new Error('Upload a PDF, JPG or PNG file up to 5 MB.');
      if (!String(f.content).startsWith('data:' + f.mime + ';base64,')) throw new Error('The file content does not match its type.');
    });
  }
  function validateTransition(a, next, actor, remarks, extra = {}) {
    const user = actor && Store.user(actor.id);
    if (!user || user.status !== 'ACTIVE' || user.role !== actor.role) throw new Error('Sign in to update this application.');
    if (!OPEN_STATUSES.includes(a.status)) throw new Error('A closed application cannot be changed.');
    if (user.role === 'CITIZEN') {
      if (a.user_id !== user.id || !(next === 'WITHDRAWN' || (a.status === 'NEEDS_INFO' && next === 'UNDER_REVIEW'))) throw new Error('This citizen action is not allowed.');
      if (Object.keys(extra).length) throw new Error('Citizens cannot assign applications.');
    } else {
      if (!['OFFICER','ADMIN'].includes(user.role) || (user.role === 'OFFICER' && a.department_id !== user.department_id)) throw new Error('This application belongs to another department.');
      const allowed = { SUBMITTED: ['UNDER_REVIEW'], UNDER_REVIEW: ['APPROVED','REJECTED','NEEDS_INFO','FORWARDED'], FORWARDED: ['UNDER_REVIEW'], NEEDS_INFO: [] };
      if (!allowed[a.status].includes(next)) throw new Error('Take up a submitted or forwarded application before deciding it. Only the citizen can respond to an information request.');
      if (next === 'FORWARDED' && (!Store.department(extra.department_id) || Number(extra.department_id) === a.department_id)) throw new Error('Choose a different destination department.');
      if (next !== 'FORWARDED' && extra.department_id && Number(extra.department_id) !== a.department_id) throw new Error('Use Forward to move departments.');
      if (extra.officer_id) {
        const o = Store.user(extra.officer_id);
        if (o?.role !== 'OFFICER' || o.status !== 'ACTIVE' || o.department_id !== Number(extra.department_id || a.department_id)) throw new Error('Select an active officer in the destination department.');
      }
    }
    if (String(remarks || '').trim().length < 20) throw new Error('Give a clear explanation of at least 20 characters.');
  }
  function audit(app, status, actor, remarks) {
    db.status_logs.push({id: nextId('status_logs'), application_id: app.id, from_status: app.status, to_status: status, actor_id: actor?.id || null, actor_role: actor?.role || 'SYSTEM', remarks, created_at: ts()});
  }
  function grievanceAudit(g, from, actor, remarks) {
    db.status_logs.push({id: nextId('status_logs'), application_id: null, grievance_id: g.id, from_status: from, to_status: g.status, actor_id: actor?.id || null, actor_role: actor?.role || 'SYSTEM', remarks, created_at: ts()});
  }
  Store.assign = (ids, officerId, actor, remarks) => {
    const officer = Store.user(officerId);
    if (!officer || officer.role !== 'OFFICER' || officer.status !== 'ACTIVE') throw new Error('Choose an active officer.');
    const apps = [...new Set(ids.map(Number))].map(id => Store.application(id));
    if (!apps.length || apps.some(a => !a?.isOpen || a.department_id !== officer.department_id || (actor.role === 'OFFICER' && (actor.id !== officer.id || a.department_id !== actor.department_id)))) throw new Error('Select open applications in the selected officer’s department. Forward a file to change departments.');
    if (!['OFFICER','ADMIN'].includes(actor.role)) throw new Error('Only staff can assign files.');
    apps.forEach(app => {
      const row = byId('applications', app.id); row.officer_id = officer.id; row.updated_at = ts();
      audit(row, row.status, actor, remarks || 'Assigned for review to ' + officer.full_name + '.');
      Store.pushNotification(row.user_id, 'Officer assigned', row.ref + ' — Assigned to ' + officer.full_name, 'info', '/citizen/applications/' + row.id);
    });
    commit(); return apps.map(a => Store.application(a.id));
  };
  Store.grievanceLogs = id => clone(db.status_logs.filter(l => l.grievance_id === Number(id)));
  Store.preference = (key, value) => {
    const storageKey = 'amap.' + key;
    if (value === undefined) { try { return global.localStorage.getItem(storageKey); } catch { return null; } }
    try { global.localStorage.setItem(storageKey, String(value)); } catch { /* device preference is optional */ }
    return value;
  };
  const pageRows = (rows, f = {}, counts = {}) => {
    if (f.limit == null) return rows;
    const limit = Math.min(100, Math.max(1, Number(f.limit) || 12));
    const offset = Math.min(Math.max(0, Number(f.offset) || 0), Math.max(0, Math.ceil(rows.length / limit) - 1) * limit);
    return {rows:rows.slice(offset, offset + limit),total:rows.length,offset,limit,counts};
  };
  const sortRows = (rows, f, fallback) => {
    const key = f.sort || fallback, sign = f.direction === 'asc' ? 1 : -1;
    return rows.sort((a,b) => {
      let av = a[key] ?? '', bv = b[key] ?? '';
      if (key === 'priority') { av = {NORMAL:0,HIGH:1,URGENT:2}[a.priority]; bv = {NORMAL:0,HIGH:1,URGENT:2}[b.priority]; }
      if (key === 'sla') { av = a.sla_days - a.ageDays; bv = b.sla_days - b.ageDays; }
      return (typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv))) * sign || b.id - a.id;
    });
  };
  Store.queryApplications = (f = {}) => {
    let rows = metrics(f);
    const views = {all:a=>true,open:a=>a.isOpen,mine:a=>a.isOpen && a.officer_id===Number(f.me),unassigned:a=>a.isOpen&&!a.officer_id,overdue:a=>a.isOverdue,needs_info:a=>a.status==='NEEDS_INFO',decided:a=>!a.isOpen};
    const counts = Object.fromEntries(Object.entries(views).map(([k,p]) => [k,rows.filter(p).length]));
    counts.status = Object.fromEntries(STATUS_ORDER.map(s=>[s,rows.filter(a=>a.status===s).length]));
    if (views[f.view]) rows = rows.filter(views[f.view]);
    if (f.officer_id === 'unassigned') rows = rows.filter(a=>!a.officer_id);
    sortRows(rows,f,'submitted_at'); const page=pageRows(rows,f,counts);
    if(Array.isArray(page))return page.map(expand);
    return {...page,rows:page.rows.map(expand)};
  };
  Store.queryUsers = (f = {}) => {
    const citizenCounts=new Map(),officerCounts=new Map();
    db.applications.forEach(a=>{citizenCounts.set(a.user_id,(citizenCounts.get(a.user_id)||0)+1);officerCounts.set(a.officer_id,(officerCounts.get(a.officer_id)||0)+1);});
    let rows = Store.users(f).map(u => ({...safeUser(u),department:Store.department(u.department_id),fileCount:(u.role==='CITIZEN'?citizenCounts:officerCounts).get(u.id)||0}));
    if(f.status) rows=rows.filter(u=>u.status===f.status);
    sortRows(rows,f,'created_at'); return pageRows(rows,f);
  };
  Store.queryServices = (f = {}) => {
    let rows = Store.services(f.department_id);
    if(f.q)rows=rows.filter(s=>(s.name+' '+s.code).toLowerCase().includes(f.q.toLowerCase()));
    if(f.active!=null&&f.active!=='')rows=rows.filter(s=>!!s.is_active===!!Number(f.active));
    sortRows(rows,{direction:'asc',...f},'name');return pageRows(rows,f);
  };
  Store.queryGrievances = (f = {}) => {
    let rows=Store.grievances(f).map(g=>({...g,citizen:safeUser(g.citizen),officer:safeUser(g.officer)}));
    if(f.category)rows=rows.filter(g=>g.category===f.category);
    if(f.from)rows=rows.filter(g=>g.created_at.slice(0,10)>=f.from);
    if(f.to)rows=rows.filter(g=>g.created_at.slice(0,10)<=f.to);
    sortRows(rows,f,'created_at');return pageRows(rows,f);
  };
  Store.scopedOfficers = (s = {}) => {
    const apps=metrics(s);
    const rows = Store.users({role:'OFFICER',department_id:s.department_id}).map(u=>{
      const a=apps.filter(x=>x.officer_id===u.id), done=a.filter(x=>['APPROVED','REJECTED'].includes(x.status));
      return {id:u.id,name:u.full_name,designation:u.designation,department_id:u.department_id,department:Store.department(u.department_id)?.code,handled:a.length,approved:a.filter(x=>x.status==='APPROVED').length,rejected:a.filter(x=>x.status==='REJECTED').length,open:a.filter(x=>x.isOpen).length,avgDays:done.length?Math.round(done.reduce((n,x)=>n+x.processingDays,0)/done.length*10)/10:0};
    }).sort((a,b)=>b.handled-a.handled);
    return pageRows(rows,s);
  };
  Store.scopedDecisions = (n=7,s={}) => {
    const ids=new Set(metrics(s).map(a=>a.id));
    const logs=db.status_logs.filter(l=>ids.has(l.application_id)&&['APPROVED','REJECTED'].includes(l.to_status)&&(!s.officer_id||l.actor_id===Number(s.officer_id)));
    return Array.from({length:n},(_,i)=>{const day=new Date(Date.now()-(n-1-i)*86400000),key=day.toISOString().slice(0,10),rows=logs.filter(l=>l.created_at.startsWith(key));return {key,label:day.toLocaleDateString('en-IN',{weekday:'short'}),approved:rows.filter(l=>l.to_status==='APPROVED').length,rejected:rows.filter(l=>l.to_status==='REJECTED').length};});
  };
  Store.scopedActivity = (n=12,s={}) => {
    const ids=new Set(metrics(s).map(a=>a.id));
    return db.status_logs.filter(l=>ids.has(l.application_id)&&(!s.actor_id||l.actor_id===Number(s.actor_id))).sort((a,b)=>b.created_at.localeCompare(a.created_at)||b.id-a.id).slice(0,n).map(l=>({id:l.id,ref:Store.application(l.application_id).ref,application_id:l.application_id,to_status:l.to_status,from_status:l.from_status,actor:Store.user(l.actor_id)?.full_name||'System',actor_role:l.actor_role,remarks:l.remarks,at:l.created_at}));
  };
  Store.scopedGrievanceSummary = s => {
    const rows=Store.grievances(s),statuses=['OPEN','IN_PROGRESS','RESOLVED','CLOSED'];
    return {total:rows.length,byStatus:statuses.map(key=>({key,label:key.replaceAll('_',' '),value:rows.filter(g=>g.status===key).length})),byCategory:[...new Set(rows.map(g=>g.category))].map(name=>({name,value:rows.filter(g=>g.category===name).length})).sort((a,b)=>b.value-a.value)};
  };
  Store.slaSummary = s => {const rows=metrics(s).filter(a=>a.isOpen),overdue=rows.filter(a=>a.isOverdue).length,dueSoon=rows.filter(a=>!a.isOverdue&&a.sla_days-a.ageDays<=3).length;return {pending:rows.length,overdue,dueSoon,onTrack:rows.length-overdue-dueSoon,compliance:rows.length?Math.round((rows.length-overdue)/rows.length*1000)/10:100};};
  Store.userSummary = () => ({total:db.users.length,inactive:db.users.filter(u=>u.status==='INACTIVE').length,byRole:['CITIZEN','OFFICER','ADMIN'].map(key=>({key,label:key[0]+key.slice(1).toLowerCase(),value:db.users.filter(u=>u.role===key).length})),byDepartment:db.departments.map(d=>({label:d.code,value:db.users.filter(u=>u.role==='OFFICER'&&u.department_id===d.id).length}))});
  export { Store };
export default Store;
