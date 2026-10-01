UI.run(async()=>{
  const user=await Auth.guard(['citizen']);if(!user)return;
  await Shell.mount({title:'Your application journey.',subtitle:'The details, documents, and decisions behind your request.',eyebrow:'Application details',actions:'<a class="btn" href="citizen-applications.html">'+Icons('back')+'All applications</a>'});
  let id=Number(new URLSearchParams(location.search).get('id'));if(!id){const apps=await API.applications.list({});id=apps[0]?.id;}if(!id){UI.$('#page').innerHTML=UI.empty('No application to display','Start your first request to see its progress here.','<a class="btn primary" href="citizen-apply.html">New application</a>');return;}
  async function render(){const a=await API.applications.get(id);const responseService=a.status==='NEEDS_INFO'?(await API.services.list({})).find(service=>service.id===a.service_id):null;UI.$('#page').innerHTML='<div class="scope-bar"><div class="row"><span class="mono">'+UI.e(a.reference)+'</span>'+UI.badge(a.status)+'</div><div class="actions"><button class="btn sm" id="print-document">'+Icons('print')+(a.status==='APPROVED'?'Print certificate':'Print acknowledgment')+'</button>'+(a.status==='SUBMITTED'||a.status==='UNDER_REVIEW'?'<button class="btn sm danger" id="withdraw">'+Icons('withdrawn')+'Withdraw</button>':'')+'</div></div>'+(a.status==='NEEDS_INFO'?'<div class="alert warning">'+Icons('info')+'The reviewing officer needs more information. Read the latest remarks below and send your response.</div>':'')+'<div class="dashboard-grid"><div class="stack"><section class="card">'+Views.head(a.service_name,'Application record')+Views.detail(a)+'</section><section class="card">'+Views.head('Submitted details')+Views.formDetails(a.form_data)+'</section><section class="card">'+Views.head('Supporting documents')+UI.documents(a.documents)+'</section>'+(a.status==='NEEDS_INFO'?'<section class="card">'+Views.head('Send additional information')+'<form id="response-form"><div class="field"><label for="response">Your response</label><textarea id="response" name="remarks" required minlength="20" maxlength="2000" placeholder="Respond to the officer’s request in detail."></textarea><span class="hint">At least 20 characters.</span></div><div class="field"><label for="response-files">Additional documents (optional)</label><input id="response-files" type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.txt"></div><div id="response-file-list"></div><button class="btn primary" type="submit">Send response'+Icons('send')+'</button></form></section>':'')+'</div><section class="card">'+Views.head('Audit trail','A complete history of this application')+UI.timeline(a.logs)+'</section></div>';
    UI.$('#print-document').onclick=()=>UI.printApplication(a);
    const withdraw=UI.$('#withdraw');if(withdraw)withdraw.onclick=()=>{const m=UI.modal('Withdraw application','<p class="small muted">Only submitted applications and applications under review can be withdrawn.</p><form id="withdraw-form"><div class="field"><label for="withdraw-reason">Reason for withdrawal</label><textarea id="withdraw-reason" required minlength="20" maxlength="2000" placeholder="Please explain why you are withdrawing this request."></textarea></div><button class="btn danger" type="submit">Confirm withdrawal</button></form>');UI.$('#withdraw-form',m.element).onsubmit=ev=>{ev.preventDefault();UI.busy(UI.$('button[type=submit]',ev.target),async()=>{await API.applications.transition(id,{status:'WITHDRAWN',remarks:UI.$('#withdraw-reason').value});m.close();UI.toast('Application withdrawn.');await Shell.refresh();await render();});};};
    if(a.status==='NEEDS_INFO'){
      let docs=[],reading=false,readVersion=0;
      const s=responseService,form=UI.$('#response-form'),submit=UI.$('button[type=submit]',form);
      UI.$('#response-files').onchange=async ev=>{
        const version=++readVersion;reading=true;docs=[];submit.disabled=true;
        UI.$('#response-file-list').textContent='Reading selected documents…';
        try{
          const loaded=await UI.files(ev.target.files,s.required_documents);
          if(version!==readVersion)return;
          docs=loaded;
          UI.$('#response-file-list').innerHTML=docs.map(d=>'<p class="small">'+UI.e(d.name)+' · '+UI.e(d.label)+'</p>').join('');
        }catch(err){
          if(version!==readVersion)return;
          docs=[];ev.target.value='';UI.$('#response-file-list').textContent='';UI.toast(err.message,'error');
        }finally{if(version===readVersion){reading=false;submit.disabled=false;}}
      };
      form.onsubmit=ev=>{
        ev.preventDefault();if(reading)return;
        UI.busy(submit,async()=>{await API.applications.transition(id,{status:'UNDER_REVIEW',remarks:UI.$('#response').value,documents:docs});UI.toast('Response sent. Your application is under review again.');await Shell.refresh();await render();});
      };
    }
  }await render();
});
