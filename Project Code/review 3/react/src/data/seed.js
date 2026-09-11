/* ==========================================================================
   seed.js — deterministic demo dataset
   --------------------------------------------------------------------------
   Mirrors the MySQL schema in schema.sql one-for-one, so every screen can be
   built and demoed before the backend exists. Swap Store's persistence for
   real REST calls (see js/api.js) and none of the page code changes.

   Tables produced:  departments · services · users · applications ·
                     documents · status_logs · grievances · notifications
   ========================================================================== */
export function generateSeed(anchor = Date.now()) {

  /* ---------------------------------------------------------------- utils */

  // Mulberry32 — small seeded PRNG so the demo data is identical every run.
  function makeRandom(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  var rnd = makeRandom(20260829);
  function ri(min, max) { return Math.floor(rnd() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
  function chance(p) { return rnd() < p; }

  var DAY = 86400000;
  var NOW = Number(anchor);
  function iso(ms) { return new Date(ms).toISOString(); }
  function daysAgo(d, jitterHours) {
    return NOW - d * DAY + (jitterHours ? ri(-jitterHours, jitterHours) * 3600000 : 0);
  }

  /* --------------------------------------------------------- departments */

  var departments = [
    { id: 1, code: 'REV', name: 'Revenue Department',        icon: 'scroll',     head: 'Smt. Lakshmi Prasad',  email: 'revenue@egov.in',    phone: '0891-2540011', description: 'Certificates of income, domicile, nativity and related revenue records.' },
    { id: 2, code: 'TRN', name: 'Transport Department',      icon: 'truck',      head: 'Sri. Vikram Naidu',    email: 'transport@egov.in',  phone: '0891-2540022', description: 'Driving licences, vehicle registration, permits and fitness certificates.' },
    { id: 3, code: 'MUN', name: 'Municipal Services',        icon: 'building',   head: 'Sri. Ramesh Chowdary', email: 'municipal@egov.in',  phone: '0891-2540033', description: 'Building approvals, trade licences, water and sanitation connections.' },
    { id: 4, code: 'SWF', name: 'Social Welfare',            icon: 'heart',      head: 'Smt. Anjali Menon',    email: 'welfare@egov.in',    phone: '0891-2540044', description: 'Pensions, scholarships, housing subsidies and welfare scheme enrolment.' },
    { id: 5, code: 'HLT', name: 'Health Department',         icon: 'droplet',    head: 'Dr. Suresh Iyer',      email: 'health@egov.in',     phone: '0891-2540055', description: 'Health cards, clinical establishment and food safety licensing.' },
    { id: 6, code: 'EDU', name: 'Education Department',      icon: 'book',       head: 'Smt. Kavya Sinha',     email: 'education@egov.in',  phone: '0891-2540066', description: 'Transfer certificates, duplicate marksheets and institution recognition.' },
    { id: 7, code: 'LND', name: 'Land Records',              icon: 'mapPin',     head: 'Sri. Manish Bhat',     email: 'land@egov.in',       phone: '0891-2540077', description: 'Mutation, encumbrance certificates and survey record copies.' },
    { id: 8, code: 'GRV', name: 'Public Grievances Cell',    icon: 'megaphone',  head: 'Sri. Kiran Pillai',    email: 'grievance@egov.in',  phone: '0891-2540088', description: 'Citizen complaints, service failures and redressal escalation.' }
  ];

  /* ------------------------------------------------------------- services */

  var D = ['Aadhaar / Photo ID', 'Address Proof', 'Passport-size Photograph', 'Ration Card',
    'Previous Certificate', 'Land Document', 'Bank Passbook (first page)', 'Affidavit',
    'Income Proof', 'Vehicle RC Copy', 'Insurance Copy', 'Site Plan / Layout',
    'Property Tax Receipt', 'School Bonafide', 'Medical Fitness Report'];

  var services = [
    // Revenue
    { id: 1,  department_id: 1, code: 'REV-INC', name: 'Income Certificate',            fee: 30,   sla_days: 15, docs: [D[0], D[1], D[8]],            description: 'Certified statement of annual family income for scheme eligibility.' },
    { id: 2,  department_id: 1, code: 'REV-DOM', name: 'Domicile / Residence Certificate', fee: 30, sla_days: 15, docs: [D[0], D[1], D[3]],         description: 'Proof of continuous residence within the state.' },
    { id: 3,  department_id: 1, code: 'REV-NAT', name: 'Nativity Certificate',          fee: 30,   sla_days: 20, docs: [D[0], D[1], D[7]],            description: 'Certificate of place of birth and native status.' },
    { id: 4,  department_id: 1, code: 'REV-CST', name: 'Community Certificate',         fee: 30,   sla_days: 21, docs: [D[0], D[4], D[7]],            description: 'Community classification certificate for reservation benefits.' },
    // Transport
    { id: 5,  department_id: 2, code: 'TRN-LLR', name: "Learner's Licence",             fee: 200,  sla_days: 7,  docs: [D[0], D[1], D[14]],           description: "Apply for a learner's driving licence and book a slot test." },
    { id: 6,  department_id: 2, code: 'TRN-DLR', name: 'Driving Licence Renewal',       fee: 400,  sla_days: 10, docs: [D[0], D[4], D[14]],           description: 'Renew an expiring or expired driving licence.' },
    { id: 7,  department_id: 2, code: 'TRN-TRF', name: 'Vehicle Ownership Transfer',    fee: 600,  sla_days: 14, docs: [D[0], D[9], D[10]],           description: 'Transfer registration of a vehicle to a new owner.' },
    { id: 8,  department_id: 2, code: 'TRN-DRC', name: 'Duplicate RC Book',             fee: 300,  sla_days: 12, docs: [D[0], D[9], D[7]],            description: 'Issue a duplicate registration certificate for a vehicle.' },
    // Municipal
    { id: 9,  department_id: 3, code: 'MUN-BLD', name: 'Building Plan Approval',        fee: 2500, sla_days: 30, docs: [D[0], D[11], D[5], D[12]],    description: 'Sanction of building plans for residential or commercial construction.' },
    { id: 10, department_id: 3, code: 'MUN-TRD', name: 'Trade Licence',                 fee: 1200, sla_days: 21, docs: [D[0], D[1], D[12]],           description: 'Licence to operate a trade or commercial establishment.' },
    { id: 11, department_id: 3, code: 'MUN-WTR', name: 'New Water Connection',          fee: 800,  sla_days: 18, docs: [D[0], D[1], D[12]],           description: 'Sanction of a new municipal water supply connection.' },
    { id: 12, department_id: 3, code: 'MUN-PTX', name: 'Property Tax Assessment',       fee: 0,    sla_days: 20, docs: [D[0], D[5], D[12]],           description: 'Fresh assessment or revision of property tax records.' },
    // Social Welfare
    { id: 13, department_id: 4, code: 'SWF-OAP', name: 'Old Age Pension',               fee: 0,    sla_days: 25, docs: [D[0], D[1], D[6], D[8]],      description: 'Monthly pension for eligible senior citizens.' },
    { id: 14, department_id: 4, code: 'SWF-SCH', name: 'Student Scholarship',           fee: 0,    sla_days: 30, docs: [D[0], D[13], D[8], D[6]],     description: 'Merit and means based scholarship for enrolled students.' },
    { id: 15, department_id: 4, code: 'SWF-HSG', name: 'Housing Subsidy Scheme',        fee: 0,    sla_days: 40, docs: [D[0], D[1], D[8], D[5]],      description: 'Assistance under the state affordable housing programme.' },
    { id: 16, department_id: 4, code: 'SWF-WPN', name: 'Widow Pension Scheme',          fee: 0,    sla_days: 25, docs: [D[0], D[1], D[6]],            description: 'Monthly support pension for eligible beneficiaries.' },
    // Health
    { id: 17, department_id: 5, code: 'HLT-CRD', name: 'Health Card Registration',      fee: 0,    sla_days: 10, docs: [D[0], D[1], D[3]],            description: 'Enrolment into the state public health benefit card.' },
    { id: 18, department_id: 5, code: 'HLT-CLE', name: 'Clinical Establishment Licence',fee: 3000, sla_days: 35, docs: [D[0], D[11], D[12], D[7]],    description: 'Registration of a clinic, laboratory or nursing home.' },
    { id: 19, department_id: 5, code: 'HLT-FSL', name: 'Food Safety Licence',           fee: 2000, sla_days: 28, docs: [D[0], D[1], D[11]],           description: 'FSSAI-aligned licence for food business operators.' },
    // Education
    { id: 20, department_id: 6, code: 'EDU-TRC', name: 'Transfer Certificate',          fee: 50,   sla_days: 10, docs: [D[0], D[13], D[4]],           description: 'School or college transfer certificate issuance.' },
    { id: 21, department_id: 6, code: 'EDU-DMS', name: 'Duplicate Marksheet',           fee: 250,  sla_days: 20, docs: [D[0], D[7], D[4]],            description: 'Reissue of a lost or damaged marks statement.' },
    { id: 22, department_id: 6, code: 'EDU-REC', name: 'Institution Recognition Renewal',fee: 5000,sla_days: 45, docs: [D[0], D[11], D[12]],          description: 'Renewal of recognition for a private educational institution.' },
    // Land Records
    { id: 23, department_id: 7, code: 'LND-MUT', name: 'Land Mutation',                 fee: 500,  sla_days: 30, docs: [D[0], D[5], D[12], D[7]],     description: 'Update of ownership records after sale or inheritance.' },
    { id: 24, department_id: 7, code: 'LND-ENC', name: 'Encumbrance Certificate',       fee: 200,  sla_days: 12, docs: [D[0], D[5]],                  description: 'Statement of registered transactions against a property.' },
    { id: 25, department_id: 7, code: 'LND-SUR', name: 'Survey Record Copy',            fee: 150,  sla_days: 14, docs: [D[0], D[5]],                  description: 'Certified copy of the village survey / adangal record.' },
    // Grievance cell (grievances use their own table, this is the escalation route)
    { id: 26, department_id: 8, code: 'GRV-ESC', name: 'Grievance Escalation Request',  fee: 0,    sla_days: 7,  docs: [D[0]],                        description: 'Escalate an unresolved grievance to the redressal cell.' }
  ];

  services.forEach(function (s) { s.is_active = 1; });

  /* ---------------------------------------------------------------- users */

  var FIRST = ['Aarav', 'Ananya', 'Rohan', 'Priya', 'Vikram', 'Sneha', 'Karthik', 'Meera', 'Arjun',
    'Divya', 'Rahul', 'Kavya', 'Suresh', 'Lakshmi', 'Nikhil', 'Pooja', 'Ravi', 'Anjali', 'Manish',
    'Deepa', 'Sanjay', 'Nisha', 'Aditya', 'Swathi', 'Harsha', 'Bhavana', 'Kiran', 'Sushma',
    'Vamsi', 'Padma', 'Naveen', 'Sirisha', 'Gopal', 'Rekha', 'Tejas', 'Ishita'];
  var LAST = ['Sharma', 'Reddy', 'Nair', 'Patel', 'Rao', 'Verma', 'Iyer', 'Gupta', 'Menon', 'Das',
    'Kulkarni', 'Chowdary', 'Pillai', 'Joshi', 'Bose', 'Naidu', 'Mehta', 'Kumar', 'Bhat', 'Sinha'];
  var CITY = ['Visakhapatnam', 'Vijayawada', 'Guntur', 'Kakinada', 'Rajahmundry', 'Tirupati',
    'Nellore', 'Anantapur', 'Kurnool', 'Eluru'];

  var users = [];
  var uid = 0;

  function addUser(u) {
    uid += 1;
    u.id = uid;
    u.status = u.status || 'ACTIVE';
    u.created_at = u.created_at || iso(daysAgo(ri(120, 620)));
    u.avatar_class = ['', 'a2', 'a3', 'a4'][uid % 4];
    users.push(u);
    return u;
  }

  function phone() { return '9' + ri(100000000, 999999999); }
  function addr(c) { return ri(1, 89) + '-' + ri(1, 40) + '/' + ri(1, 9) + ', ' + pick(['Gandhi Nagar', 'MVP Colony', 'Ram Nagar', 'Krishna Puram', 'Lawsons Bay', 'Seethammadhara', 'Dwaraka Nagar']) + ', ' + c; }

  /* -- Fixed demo accounts (documented in README) ------------------------ */
  addUser({
    full_name: 'Ananya Sharma', email: 'citizen@demo.gov', password: 'citizen123', role: 'CITIZEN',
    phone: '9876543210', city: 'Visakhapatnam', address: '12-4/7, MVP Colony, Visakhapatnam',
    id_last4: '4821', department_id: null, created_at: iso(daysAgo(430))
  });
  addUser({
    full_name: 'Rakesh Menon', email: 'officer@demo.gov', password: 'officer123', role: 'OFFICER',
    phone: '9845012345', city: 'Visakhapatnam', address: 'Revenue Bhavan, Visakhapatnam',
    designation: 'Deputy Tahsildar', id_last4: '7712', department_id: 1, created_at: iso(daysAgo(600))
  });
  addUser({
    full_name: 'Dr. R. Sateesh Kumar', email: 'admin@demo.gov', password: 'admin123', role: 'ADMIN',
    phone: '9812345670', city: 'Visakhapatnam', address: 'Secretariat Annexe, Visakhapatnam',
    designation: 'Portal Administrator', id_last4: '1009', department_id: null, created_at: iso(daysAgo(640))
  });

  /* -- Project team, as additional demo citizens ------------------------- */
  [['Dhruva Datta Vishnubhotla', 'dhruva@demo.gov'],
   ['Somana Divya Sai', 'divya@demo.gov'],
   ['Ayusha Das', 'ayusha@demo.gov']].forEach(function (t) {
    addUser({
      full_name: t[0], email: t[1], password: 'citizen123', role: 'CITIZEN',
      phone: phone(), city: 'Visakhapatnam', address: addr('Visakhapatnam'),
      id_last4: String(ri(1000, 9999)), department_id: null
    });
  });

  /* -- Officers: two per department -------------------------------------- */
  var DESIG = ['Assistant Officer', 'Section Officer', 'Deputy Tahsildar', 'Superintendent',
    'Junior Assistant', 'Licensing Officer', 'Field Verification Officer'];
  departments.forEach(function (d) {
    var count = d.id === 1 ? 5 : 6;   // six officers per department, including the fixed demo
    for (var i = 0; i < count; i++) {
      var fn = pick(FIRST), ln = pick(LAST);
      addUser({
        full_name: fn + ' ' + ln,
        email: (fn + '.' + ln).toLowerCase() + '.' + d.code.toLowerCase() + '.' + i + '@demo.gov',
        password: 'officer123', role: 'OFFICER',
        phone: phone(), city: 'Visakhapatnam', address: d.name + ', Visakhapatnam',
        designation: pick(DESIG), id_last4: String(ri(1000, 9999)), department_id: d.id
      });
    }
  });

  /* -- A second administrator -------------------------------------------- */
  addUser({
    full_name: 'Sunitha Rao', email: 'sunitha.rao@egov.in', password: 'admin123', role: 'ADMIN',
    phone: phone(), city: 'Vijayawada', address: 'Secretariat, Vijayawada',
    designation: 'Joint Secretary (IT)', id_last4: String(ri(1000, 9999)), department_id: null
  });

  /* -- Bulk citizens ------------------------------------------------------ */
  for (var c = 0; c < 596; c++) {
    var f = FIRST[c % FIRST.length], l = LAST[(c * 7) % LAST.length], city = pick(CITY);
    addUser({
      full_name: f + ' ' + l,
      email: (f + '.' + l + (c + 1)).toLowerCase() + '@mail.com',
      password: 'citizen123', role: 'CITIZEN',
      phone: phone(), city: city, address: addr(city),
      id_last4: String(ri(1000, 9999)), department_id: null,
      status: chance(0.06) ? 'INACTIVE' : 'ACTIVE'
    });
  }

  var citizens = users.filter(function (u) { return u.role === 'CITIZEN'; });
  var officers = users.filter(function (u) { return u.role === 'OFFICER'; });

  function officersOf(deptId) {
    return officers.filter(function (o) { return o.department_id === deptId; });
  }

  /* --------------------------------------------------------- applications */

  var STATUS = {
    SUBMITTED: 'SUBMITTED',
    UNDER_REVIEW: 'UNDER_REVIEW',
    NEEDS_INFO: 'NEEDS_INFO',
    FORWARDED: 'FORWARDED',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    WITHDRAWN: 'WITHDRAWN'
  };

  var APPROVE_NOTES = [
    'All submitted documents verified against departmental records. Approved.',
    'Field verification completed satisfactorily. Certificate issued.',
    'Eligibility confirmed. Sanction order generated and dispatched.',
    'Applicant details cross-checked with the revenue register. Approved.',
    'Approved. Digitally signed copy available for download in the portal.'
  ];
  var REJECT_NOTES = [
    'Address proof does not match the applicant record. Application rejected.',
    'Submitted income proof is beyond the prescribed validity period.',
    'Duplicate application already processed under an earlier reference.',
    'Mandatory supporting document not furnished within the notice period.',
    'Property details are under dispute; cannot be processed at this stage.'
  ];
  var INFO_NOTES = [
    'Please upload a clearer scan of the address proof.',
    'Signature on the affidavit is not legible. Kindly re-upload.',
    'The uploaded photograph does not meet the size specification.',
    'Additional proof of continuous residence is required.'
  ];
  var FORWARD_NOTES = [
    'Case requires verification by the field office. Forwarded.',
    'Beyond the sanctioning limit at this level. Forwarded to the senior officer.',
    'Referred to the technical section for site inspection.'
  ];

  var applications = [];
  var documents = [];
  var statusLogs = [];
  var docId = 0, logId = 0;

  function addLog(appId, from, to, actor, role, note, at) {
    logId += 1;
    statusLogs.push({
      id: logId, application_id: appId, from_status: from, to_status: to,
      actor_id: actor, actor_role: role, remarks: note || '', created_at: iso(at)
    });
  }

  function refNo(n, when) {
    var y = new Date(when).getFullYear();
    return 'AMP-' + y + '-' + String(100000 + n).slice(1);
  }

  var TOTAL_APPS = 6000;
  for (var a = 1; a <= TOTAL_APPS; a++) {
    var svc = pick(services);
    var applicant = pick(citizens);

    // Bias volume toward recent months — the portal is growing, so the last few
    // months carry more traffic and a believable number of files are still open.
    var span = 1095, ageDays, submittedAt, season;
    // Acceptance sampling adds annual peaks to steady three-year growth.
    do {
      ageDays = Math.floor(Math.pow(rnd(), 1.6) * span);
      submittedAt = Math.min(NOW, daysAgo(ageDays, 9));
      const month = new Date(submittedAt).getMonth();
      season = [0.7,0.72,1,0.82,0.8,0.96,1,0.9,0.78,0.85,0.74,0.66][month];
      if ([4,6].includes(svc.department_id) && [5,6,7].includes(month)) season = 1;
    } while (rnd() > season);

    var app = {
      id: a,
      ref: refNo(a, submittedAt),
      user_id: applicant.id,
      service_id: svc.id,
      department_id: svc.department_id,
      subject: svc.name + ' — ' + applicant.full_name.split(' ')[0],
      details: 'Application submitted through the citizen portal for ' + svc.name.toLowerCase() +
        '. Applicant residing at ' + (applicant.city || 'Visakhapatnam') + '.',
      priority: chance(0.10) ? 'HIGH' : (chance(0.03) ? 'URGENT' : 'NORMAL'),
      status: STATUS.SUBMITTED,
      officer_id: null,
      submitted_at: iso(submittedAt),
      updated_at: iso(submittedAt),
      decided_at: null,
      remarks: '',
      fee_paid: svc.fee,
      sla_days: svc.sla_days
    };

    addLog(a, null, STATUS.SUBMITTED, applicant.id, 'CITIZEN', 'Application submitted online.', submittedAt);

    // documents
    svc.docs.forEach(function (dn) {
      docId += 1;
      documents.push({
        id: docId, application_id: a, name: dn,
        file_name: dn.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.pdf',
        mime: 'application/pdf', size_kb: ri(120, 2400),
        uploaded_at: iso(submittedAt + ri(1, 40) * 60000),
        verified: 0
      });
    });

    var cursor = submittedAt;
    var deptOfficers = officersOf(svc.department_id);
    var officer = deptOfficers.length ? pick(deptOfficers) : officers[0];

    // Anything younger than ~2 days usually has not been picked up yet.
    if (ageDays < 2 && chance(0.7)) {
      applications.push(app);
      continue;
    }

    // Move to review
    cursor += ri(6, 52) * 3600000;
    app.status = STATUS.UNDER_REVIEW;
    app.officer_id = officer.id;
    app.updated_at = iso(cursor);
    addLog(a, STATUS.SUBMITTED, STATUS.UNDER_REVIEW, officer.id, 'OFFICER',
      'Assigned to ' + officer.full_name + ' for verification.', cursor);

    var remaining = (NOW - cursor) / DAY;
    if (ageDays > 40 && ageDays < 160 && chance(0.10)) {
      app.remarks = 'Supporting field verification is pending; review is overdue.';
      applications.push(app);
      continue;
    }
    // How long this office would realistically take, capped by real elapsed time
    var takes = Math.max(1, Math.round(svc.sla_days * (0.45 + rnd() * 1.25)));
    if (takes > remaining) {
      // still in flight
      if (chance(0.16)) {
        cursor += ri(1, 4) * DAY;
        app.status = STATUS.NEEDS_INFO;
        app.remarks = pick(INFO_NOTES);
        app.updated_at = iso(cursor);
        addLog(a, STATUS.UNDER_REVIEW, STATUS.NEEDS_INFO, officer.id, 'OFFICER', app.remarks, cursor);
      } else if (chance(0.12)) {
        cursor += ri(1, 5) * DAY;
        app.status = STATUS.FORWARDED;
        app.remarks = pick(FORWARD_NOTES);
        app.updated_at = iso(cursor);
        addLog(a, STATUS.UNDER_REVIEW, STATUS.FORWARDED, officer.id, 'OFFICER', app.remarks, cursor);
      }
      applications.push(app);
      continue;
    }

    // Optional intermediate hop
    if (chance(0.18)) {
      cursor += ri(1, Math.max(2, Math.round(takes * 0.4))) * DAY;
      var hop = chance(0.5) ? STATUS.FORWARDED : STATUS.NEEDS_INFO;
      var hopNote = hop === STATUS.FORWARDED ? pick(FORWARD_NOTES) : pick(INFO_NOTES);
      addLog(a, STATUS.UNDER_REVIEW, hop, officer.id, 'OFFICER', hopNote, cursor);
      if (hop === STATUS.NEEDS_INFO) {
        cursor += ri(1, 6) * DAY;
        addLog(a, STATUS.NEEDS_INFO, STATUS.UNDER_REVIEW, applicant.id, 'CITIZEN',
          'Requested document re-uploaded by the applicant.', cursor);
      } else {
        cursor += ri(1, 5) * DAY;
        addLog(a, STATUS.FORWARDED, STATUS.UNDER_REVIEW, officer.id, 'OFFICER',
          'Returned from the field office with a verification report.', cursor);
      }
    }

    // Final decision
    cursor = Math.min(NOW - 3600000, cursor + Math.max(1, takes - 1) * DAY);
    var approved = chance(0.83);
    if (chance(0.04)) {
      app.status = STATUS.WITHDRAWN;
      app.remarks = 'Withdrawn by the applicant before a decision was recorded.';
      app.decided_at = iso(cursor);
      addLog(a, STATUS.UNDER_REVIEW, STATUS.WITHDRAWN, applicant.id, 'CITIZEN', app.remarks, cursor);
    } else if (approved) {
      app.status = STATUS.APPROVED;
      app.remarks = pick(APPROVE_NOTES);
      app.decided_at = iso(cursor);
      addLog(a, STATUS.UNDER_REVIEW, STATUS.APPROVED, officer.id, 'OFFICER', app.remarks, cursor);
    } else {
      app.status = STATUS.REJECTED;
      app.remarks = pick(REJECT_NOTES);
      app.decided_at = iso(cursor);
      addLog(a, STATUS.UNDER_REVIEW, STATUS.REJECTED, officer.id, 'OFFICER', app.remarks, cursor);
    }
    app.updated_at = iso(cursor);
    applications.push(app);
  }

  /* Guarantee the demo citizen has a rich, varied portfolio ------------- */
  (function ensureDemoCitizen() {
    var demo = users[0];                       // citizen@demo.gov
    var mine = applications.filter(function (x) { return x.user_id === demo.id; });
    var wanted = [
      { svc: 1,  status: STATUS.APPROVED,     age: 96 },
      { svc: 5,  status: STATUS.APPROVED,     age: 61 },
      { svc: 24, status: STATUS.REJECTED,     age: 44 },
      { svc: 11, status: STATUS.UNDER_REVIEW, age: 9  },
      { svc: 14, status: STATUS.NEEDS_INFO,   age: 6  },
      { svc: 2,  status: STATUS.SUBMITTED,    age: 1  }
    ];
    // Simply append purpose-built records — clearer than mutating generated ones.
    wanted.forEach(function (w) {
      var svc = services.filter(function (s) { return s.id === w.svc; })[0];
      var id = applications.length + 1;
      var t0 = daysAgo(w.age, 5);
      var deptOff = officersOf(svc.department_id);
      var off = deptOff.length ? deptOff[0] : officers[0];
      var app = {
        id: id, ref: refNo(id, t0), user_id: demo.id, service_id: svc.id,
        department_id: svc.department_id,
        subject: svc.name + ' — Ananya',
        details: 'Application submitted through the citizen portal for ' + svc.name.toLowerCase() + '.',
        priority: 'NORMAL', status: w.status,
        officer_id: w.status === STATUS.SUBMITTED ? null : off.id,
        submitted_at: iso(t0), updated_at: iso(t0), decided_at: null, remarks: '',
        fee_paid: svc.fee, sla_days: svc.sla_days
      };
      addLog(id, null, STATUS.SUBMITTED, demo.id, 'CITIZEN', 'Application submitted online.', t0);
      svc.docs.forEach(function (dn) {
        docId += 1;
        documents.push({
          id: docId, application_id: id, name: dn,
          file_name: dn.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.pdf',
          mime: 'application/pdf', size_kb: ri(140, 1900),
          uploaded_at: iso(t0 + 900000), verified: w.status === STATUS.APPROVED ? 1 : 0
        });
      });
      if (w.status !== STATUS.SUBMITTED) {
        var t1 = t0 + ri(8, 30) * 3600000;
        addLog(id, STATUS.SUBMITTED, STATUS.UNDER_REVIEW, off.id, 'OFFICER',
          'Assigned to ' + off.full_name + ' for verification.', t1);
        app.updated_at = iso(t1);
        if (w.status === STATUS.APPROVED || w.status === STATUS.REJECTED) {
          var t2 = t1 + ri(2, Math.max(3, svc.sla_days - 2)) * DAY;
          if (t2 > NOW) t2 = NOW - DAY;
          app.remarks = w.status === STATUS.APPROVED ? APPROVE_NOTES[0] : REJECT_NOTES[0];
          app.decided_at = iso(t2);
          app.updated_at = iso(t2);
          addLog(id, STATUS.UNDER_REVIEW, w.status, off.id, 'OFFICER', app.remarks, t2);
        } else if (w.status === STATUS.NEEDS_INFO) {
          var t3 = t1 + 2 * DAY;
          app.remarks = INFO_NOTES[0];
          app.updated_at = iso(t3);
          addLog(id, STATUS.UNDER_REVIEW, STATUS.NEEDS_INFO, off.id, 'OFFICER', app.remarks, t3);
        }
      }
      applications.push(app);
    });
  })();

  /* ------------------------------------------------------------ grievances */

  var GRV_CATEGORIES = ['Water Supply', 'Street Lighting', 'Road & Drainage', 'Sanitation',
    'Electricity', 'Public Transport', 'Service Delay', 'Staff Behaviour', 'Encroachment'];
  var GRV_SUBJECTS = {
    'Water Supply': 'Irregular water supply in the locality for the past two weeks',
    'Street Lighting': 'Street lights non-functional on the main approach road',
    'Road & Drainage': 'Open drain overflowing near the residential block',
    'Sanitation': 'Garbage not collected in the ward for several days',
    'Electricity': 'Frequent power interruptions in the evening hours',
    'Public Transport': 'City bus service discontinued on the route without notice',
    'Service Delay': 'Certificate application pending well beyond the notified timeline',
    'Staff Behaviour': 'Counter staff refused to accept a duly filled application',
    'Encroachment': 'Unauthorised construction obstructing the public footpath'
  };
  var GRV_STATUS = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

  var grievances = [];
  for (var g = 1; g <= 460; g++) {
    var cat = pick(GRV_CATEGORIES);
    var gd = Math.floor(Math.pow(rnd(), 1.8) * 1090) + 1;
    var gAt = daysAgo(gd, 8);
    var gUser = g <= 3 ? users[0] : pick(citizens);
    var gDept = gd > 90 ? pick(departments) : pick([departments[2], departments[7], departments[1]]);
    var st = gd < 4 ? 'OPEN' : (gd < 12 ? pick(['OPEN', 'IN_PROGRESS']) : gd > 100 ? pick(['RESOLVED','CLOSED']) : pick(GRV_STATUS));
    var gOff = officersOf(gDept.id);
    grievances.push({
      id: g,
      ref: 'GRV-' + new Date(gAt).getFullYear() + '-' + String(10000 + g).slice(1),
      user_id: gUser.id,
      department_id: gDept.id,
      category: cat,
      subject: GRV_SUBJECTS[cat],
      description: GRV_SUBJECTS[cat] + '. Requesting the concerned department to take corrective action at the earliest.',
      location: addr(gUser.city || 'Visakhapatnam'),
      status: st,
      priority: chance(0.18) ? 'HIGH' : 'NORMAL',
      officer_id: st === 'OPEN' ? null : (gOff.length ? gOff[0].id : null),
      created_at: iso(gAt),
      updated_at: iso(st === 'OPEN' ? gAt : Math.min(NOW - 3600000, gAt + ri(2, 20) * DAY)),
      resolution: (st === 'RESOLVED' || st === 'CLOSED')
        ? 'Field team deployed and the issue was rectified. Complainant informed.' : ''
    });
  }

  /* --------------------------------------------------------- notifications */

  var notifications = [];
  var nid = 0;
  function notify(userId, title, message, type, at, link) {
    nid += 1;
    notifications.push({
      id: nid, user_id: userId, title: title, message: message,
      type: type || 'info', is_read: 0, created_at: iso(at), link: link || ''
    });
  }

  // Every seeded application transition also has its citizen notification.
  const appIndex = new Map(applications.map(a=>[a.id,a]));
  statusLogs
    .slice()
    .sort(function (x, y) { return new Date(y.created_at) - new Date(x.created_at); })
    .forEach(function (log) {
      var app = appIndex.get(log.application_id);
      if (!app || !log.from_status) return;
      var titleMap = {
        UNDER_REVIEW: 'Application under review',
        APPROVED: 'Application approved',
        REJECTED: 'Application rejected',
        NEEDS_INFO: 'Action required on your application',
        FORWARDED: 'Application forwarded',
        WITHDRAWN: 'Application withdrawn'
      };
      var typeMap = {
        APPROVED: 'success', REJECTED: 'danger', NEEDS_INFO: 'warning',
        FORWARDED: 'info', UNDER_REVIEW: 'info', WITHDRAWN: 'info'
      };
      notify(app.user_id, titleMap[log.to_status] || 'Status updated',
        app.ref + ' — ' + (titleMap[log.to_status] || 'updated') + '.',
        typeMap[log.to_status] || 'info',
        new Date(log.created_at).getTime(),
        'citizen-application.html?ref=' + app.ref);
    });

  // Mark older notifications as read so the badge count stays believable.
  notifications.forEach(function (n, i) { n.is_read = i % 3 === 0 ? 0 : 1; });

  /* --------------------------------------------------------------- export */

  // Index once: avoid repeatedly scanning all logs/documents as the fixture grows.
  const logsByApp = new Map();
  statusLogs.forEach(l=>{if(!logsByApp.has(l.application_id))logsByApp.set(l.application_id,[]);logsByApp.get(l.application_id).push(l);});
  const usersById = new Map(users.map(u=>[u.id,u]));
  // Clamp jitter to the generation anchor, retaining each audit's chronological order.
  applications.forEach(app => {
    app.submitted_at = iso(Math.min(NOW, Date.parse(app.submitted_at)));
    app.updated_at = iso(Math.max(Date.parse(app.submitted_at), Math.min(NOW, Date.parse(app.updated_at))));
    if (app.decided_at) app.decided_at = iso(Math.max(Date.parse(app.submitted_at), Math.min(NOW, Date.parse(app.decided_at))));
    let previous = Date.parse(app.submitted_at);
    const history = logsByApp.get(app.id) || [];
    history.forEach(log => {
      previous = Math.max(previous, Math.min(NOW, Date.parse(log.created_at)));
      log.created_at = iso(previous);
    });
    app.updated_at = history.at(-1)?.created_at || app.submitted_at;
    if(app.decided_at)app.decided_at=app.updated_at;
    const citizen = usersById.get(app.user_id);
    citizen.created_at = iso(Math.min(Date.parse(citizen.created_at),Date.parse(app.submitted_at)-DAY));
    app.form_data = {full_name:citizen.full_name,email:citizen.email,phone:citizen.phone,address:citizen.address};
    history.filter(l=>l.actor_role==='OFFICER').forEach(l=>{const officer=usersById.get(l.actor_id);officer.created_at=iso(Math.min(Date.parse(officer.created_at),Date.parse(l.created_at)-DAY));});
  });
  documents.forEach(d => { d.uploaded_at = iso(Math.min(NOW, Date.parse(d.uploaded_at))); });
  notifications.forEach(n => { n.created_at = iso(Math.min(NOW, Date.parse(n.created_at))); });
  grievances.forEach(g=>{
    const steps=['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].slice(0,['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].indexOf(g.status)+1);
    steps.forEach((status,i)=>statusLogs.push({id:++logId,application_id:null,grievance_id:g.id,from_status:i?steps[i-1]:null,to_status:status,actor_id:i?g.officer_id:g.user_id,actor_role:i?'OFFICER':'CITIZEN',remarks:i===0?'Grievance filed by the citizen.':status==='IN_PROGRESS'?'Officer took up this grievance for investigation.':g.resolution,created_at:iso(Date.parse(g.created_at)+(Date.parse(g.updated_at)-Date.parse(g.created_at))*i/Math.max(1,steps.length-1))}));
    const citizen=usersById.get(g.user_id);citizen.created_at=iso(Math.min(Date.parse(citizen.created_at),Date.parse(g.created_at)-DAY));
  });
  return {
    version: 6,
    generated_at: iso(NOW),
    departments: departments,
    services: services,
    users: users,
    applications: applications,
    documents: documents,
    status_logs: statusLogs,
    grievances: grievances,
    notifications: notifications,
    STATUS: STATUS
  };
}
export const SEED = generateSeed();
