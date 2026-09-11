'use strict';
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (message, status = 400) => { throw new HttpError(status, message); };
function text(value, label, min = 1, max = 500) {
  if (typeof value !== 'string') fail(label + ' must be text.');
  const v = value.trim();
  if (v.length < min || v.length > max || /\u0000/.test(v)) fail(label + ' must contain ' + min + '–' + max + ' characters.');
  return v;
}
function id(value, label = 'Record ID') {
  if (!/^[1-9][0-9]*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) fail('Invalid ' + label + '.');
  return Number(value);
}
function email(value) { const v = text(value, 'Email', 5, 150).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail('Enter a valid email address.'); return v; }
function phone(value) { const v = text(value, 'Phone', 10, 15); if (!/^[0-9]{10,15}$/.test(v)) fail('Phone must contain 10–15 digits.'); return v; }
function password(value) { const v = text(value, 'Password', 8, 100); if (!/[A-Za-z]/.test(v) || !/[0-9]/.test(v)) fail('Password must contain letters and a number.'); return v; }
function object(value) { if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Expected a JSON object.'); return value; }
function fields(value, allowed) { object(value); if (Object.keys(value).some(k => !allowed.includes(k))) fail('The request contains a field that cannot be changed.'); return value; }
function date(value) { const v = String(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0,10) !== v) fail('Choose a valid date.'); return v; }
function filters(value = {}) {
  fields(value, ['department_id','citizen_id','service_id','status','officer_id','priority','search','from','to']);
  const f = {...value};
  for (const key of ['department_id','citizen_id','service_id','officer_id']) if (f[key] && !(key === 'officer_id' && f[key] === 'unassigned')) f[key] = id(f[key]);
  if (f.status && !STATUSES.includes(f.status)) fail('Invalid application status.');
  if (f.priority && !['normal','high','urgent'].includes(f.priority)) fail('Invalid priority.');
  for (const key of ['from','to']) if (f[key]) f[key] = date(f[key]);
  if (f.from && f.to && (f.from > f.to || Date.parse(f.to) - Date.parse(f.from) > 3660 * 86400000)) fail('Choose a date range of at most ten years, in chronological order.');
  if (f.from && !f.to && Date.now() - Date.parse(f.from) > 3660 * 86400000) fail('Choose a start date within the last ten years.');
  if (f.search) f.search = text(f.search, 'Search', 1, 150);
  return f;
}
const OPEN = ['SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED'];
const STATUSES = [...OPEN,'APPROVED','REJECTED','WITHDRAWN'];
const DOCUMENT_TYPES = ['Identity proof','Address proof','Photograph','Income proof','Property document','Educational certificate','Medical certificate','Business registration'];
module.exports = {HttpError, fail, text, id, email, phone, password, object, fields, date, filters, OPEN, STATUSES, DOCUMENT_TYPES};
