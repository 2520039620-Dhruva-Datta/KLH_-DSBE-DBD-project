export const num = n => Number(n || 0).toLocaleString('en-IN');
export const money = n => Number(n) ? new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n) : 'Free';
export const fmtDate = (value,time=false) => value && !isNaN(new Date(value)) ? new Date(value).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',...(time?{hour:'numeric',minute:'2-digit'}:{})}) : '—';
export const fmtDateShort = value => new Date(value).toLocaleDateString('en-IN',{day:'numeric',month:'short'});
export const initials = name => String(name||'?').trim().split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();
export const fileSize = kb => kb>=1024 ? (kb/1024).toFixed(1)+' MB' : Math.max(1,Math.round(kb||0))+' KB';
export function timeAgo(value) { const seconds=Math.max(0,(Date.now()-Date.parse(value))/1000); if(seconds<60)return 'Just now'; for(const [unit,size] of [['year',31536000],['month',2592000],['day',86400],['hour',3600],['minute',60]]) if(seconds>=size)return new Intl.RelativeTimeFormat('en',{numeric:'auto'}).format(-Math.floor(seconds/size),unit); }
export const today = () => new Date().toISOString().slice(0,10);
export const daysBack = n => new Date(Date.now()-n*86400000).toISOString().slice(0,10);
export const safeNext = (next,fallback='/citizen') => next && /^\/(?!\/)/.test(next) && !next.includes('\\') ? next : fallback;
export function legacyLink(link='') {const [path,search='']=link.split('?'); const p=new URLSearchParams(search);const routes={'citizen-dashboard.html':'/citizen','citizen-applications.html':'/citizen/applications','citizen-grievances.html':'/citizen/grievances','officer-queue.html':'/officer/queue','officer-dashboard.html':'/officer','admin-dashboard.html':'/admin'};if(path==='citizen-application.html')return '/citizen/applications/'+encodeURIComponent(p.get('ref')||p.get('id'));return routes[path]||safeNext(link,'/profile');}
