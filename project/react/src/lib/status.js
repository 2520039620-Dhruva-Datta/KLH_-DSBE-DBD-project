export const STATUS_LABEL={SUBMITTED:'Submitted',UNDER_REVIEW:'Under review',NEEDS_INFO:'Info requested',FORWARDED:'Forwarded',APPROVED:'Approved',REJECTED:'Rejected',WITHDRAWN:'Withdrawn',OPEN:'Open',IN_PROGRESS:'In progress',RESOLVED:'Resolved',CLOSED:'Closed',ACTIVE:'Active',INACTIVE:'Deactivated'};
export const STATUS_ORDER=['SUBMITTED','UNDER_REVIEW','NEEDS_INFO','FORWARDED','APPROVED','REJECTED','WITHDRAWN'];
export const OPEN_STATUSES=STATUS_ORDER.slice(0,4);
export const STATUS_ICON={SUBMITTED:'send',UNDER_REVIEW:'eye',NEEDS_INFO:'alert',FORWARDED:'forward',APPROVED:'checkCircle',REJECTED:'xCircle',WITHDRAWN:'x',OPEN:'inbox',IN_PROGRESS:'clock',RESOLVED:'checkCircle',CLOSED:'lock',ACTIVE:'checkCircle',INACTIVE:'lock'};
export const STATUS_TONE={SUBMITTED:'info',UNDER_REVIEW:'warn',NEEDS_INFO:'warn',FORWARDED:'info',APPROVED:'ok',REJECTED:'danger'};
export const statusColor = s => '--status-'+String(s).toLowerCase().replaceAll('_','-');
export const lifecyclePercent = s => ({SUBMITTED:20,UNDER_REVIEW:55,NEEDS_INFO:45,FORWARDED:70,APPROVED:100,REJECTED:100,WITHDRAWN:100}[s]||0);
export const statusHelp={SUBMITTED:'Your application is waiting for an officer.',UNDER_REVIEW:'We’re reviewing your documents.',NEEDS_INFO:'Please send the information the officer requested.',FORWARDED:'Your file has been sent to the right department.',APPROVED:'Your application has been approved.',REJECTED:'Read the officer’s explanation below.',WITHDRAWN:'You have withdrawn this application.'};
export function slaInfo(a) {if(!a.isOpen)return {cls:'',label:a.processingDays!=null?a.processingDays+' days to close':'Closed'};const left=a.sla_days-a.ageDays;return {cls:a.isOverdue?'age-late':left<=3?'age-warn':'age-ok',label:a.isOverdue?Math.max(1,-left)+' d overdue':left+' d left'};}
