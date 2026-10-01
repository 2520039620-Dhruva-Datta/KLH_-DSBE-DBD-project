UI.run(async()=>{
  const user=await Auth.guard(['officer']);if(!user)return;
  const departments=await API.departments.list(),department=departments.find(d=>d.id===user.department_id);
  await Shell.mount({title:'A good day to make progress.',subtitle:'Your department’s workload, decisions, and next priorities.',eyebrow:department.name,actions:'<a class="btn primary" href="officer-queue.html">Open work queue'+Icons('arrow')+'</a>'});
  async function refreshDashboard(){
  const [data,apps]=await Promise.all([API.analytics.dashboard({}),API.applications.list({})]);const k=data.kpis,open=apps.filter(a=>Views.statuses.slice(0,4).includes(a.status));
  UI.$('#page').innerHTML='<div class="stat-grid">'+UI.stat('Open applications',k.open,'inbox','Across '+department.name)+UI.stat('Assigned to me',open.filter(a=>a.officer_id===user.id).length,'assignment','Open requests in your care')+UI.stat('Past service timeline',k.overdue,'clock','Prioritize these applications')+UI.stat('Decisions made',k.decided,'approved',k.approvalRate.toFixed(1)+'% approved')+'</div><div class="dashboard-grid"><section class="card">'+Views.head('Decisions, day by day','Approval and rejection activity over the last 14 days',Charts.legend([{label:'Approved',color:'--approved'},{label:'Rejected',color:'--rejected'}]))+'<div class="chart" id="decisions-chart"></div></section><section class="card">'+Views.head('The open workload','Where pending applications stand')+'<div class="chart" id="open-chart"></div>'+Charts.legend(data.status.filter(s=>Views.statuses.slice(0,4).includes(s.status)&&s.value))+'</section></div><section class="card">'+Views.head('Waiting the longest','The oldest open applications in your department','<a class="btn sm" href="officer-queue.html">View queue</a>')+'<div id="oldest-table"></div></section><section class="card">'+Views.head('Department activity','The latest steps taken by your team')+'<div class="activity-feed">'+UI.timeline(data.activity.slice(0,10))+'</div></section>';
  Charts.groupedBars('#decisions-chart',data.daily,{series:[{key:'approved',label:'Approved',color:'--approved'},{key:'rejected',label:'Rejected',color:'--rejected'}]});Charts.donut('#open-chart',data.status.filter(s=>Views.statuses.slice(0,4).includes(s.status)));UI.table('#oldest-table',Views.columns('officer'),Views.sort(open,'oldest').slice(0,6),{pageSize:6});
  }
  await refreshDashboard();
  window.addEventListener('civicdesk:datachange',()=>refreshDashboard().catch(err=>UI.toast(err.message,'error')));
  const refreshTimer=setInterval(()=>{if(!document.hidden)refreshDashboard().catch(err=>UI.toast(err.message,'error'));},60000);
  window.addEventListener('pagehide',()=>clearInterval(refreshTimer),{once:true});
});

