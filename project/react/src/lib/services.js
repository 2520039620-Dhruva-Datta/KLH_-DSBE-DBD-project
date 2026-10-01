// Shared catalogue helpers for the public catalogue and the apply wizard.

// Services people look for first; matched by stable service code so renamed or
// missing rows simply drop out of the list.
export const POPULAR_CODES=['AADHAAR-NEW','AADHAAR-UPD','PAN-NEW','PASSPORT','VOTER-ID','RATION-CARD'];

const ICONS=[[/^AADHAAR/,'fingerprint'],[/^PAN/,'idCard'],[/^PASSPORT/,'globe'],[/^VOTER/,'userCheck'],[/^RATION/,'list'],[/PENSION/,'heart'],[/CERT|HEIR|ENCUMBRANCE/,'scroll'],[/LL|DL-|VEHICLE/,'truck'],[/ELECTRICITY/,'zap'],[/LPG/,'droplet'],[/UDYAM|GST|FSSAI/,'briefcase'],[/MARKSHEET/,'book'],[/MUTATION/,'home']];
export function serviceIcon(service,department){return ICONS.find(([pattern])=>pattern.test(service?.code||''))?.[1]||department?.icon||'fileText';}

export function popularServices(services){return POPULAR_CODES.map(code=>services.find(s=>s.code===code&&s.is_active)).filter(Boolean);}

// Case-insensitive match on name, code, description and department name; every
// word of the query must appear somewhere.
export function matchesService(service,department,query){
  const words=query.toLowerCase().split(/\s+/).filter(Boolean);
  if(!words.length)return true;
  const text=[service.name,service.code,service.description,department?.name].join(' ').toLowerCase();
  return words.every(w=>text.includes(w));
}
