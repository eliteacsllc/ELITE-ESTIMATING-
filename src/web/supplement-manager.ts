export const supplementManagerCss = `.suppManager{padding:14px;border-bottom:1px solid #28282d}.suppManager .blockTitle{margin-left:0}.suppReason{margin:0 0 8px}.suppActions{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.suppActions button{padding:6px 8px;font-size:8px}.suppCard{border:1px solid #28282d;background:#0a0a0c;padding:9px;margin-top:7px}.suppCardHead{display:flex;justify-content:space-between;gap:8px}.suppCardHead b{font-size:9px}.suppCardHead span{font:600 7px ui-monospace,SFMono-Regular,Consolas,monospace;color:#8c8c94}.suppMeta{color:#62626a;font-size:8px;margin-top:4px}.suppChange{border-top:1px solid #202024;padding-top:5px;margin-top:5px;color:#84848d;font-size:8px}.suppChange strong{color:#b8b8c0}`;

export const supplementManagerJs = `(() => {
  const right=document.querySelector('.rightPanel');
  if(!right)return;
  const panel=document.createElement('div');
  panel.className='suppManager';
  panel.innerHTML='<div class="blockTitle">SUPPLEMENT DESK</div><input id="suppReason" class="suppReason" placeholder="Reason for supplement change"><button id="suppRefresh" class="secondary wide">Refresh supplements</button><div id="suppManagerList"><div class="emptyState">Load an approved estimate to manage supplements.</div></div>';
  right.insertBefore(panel,right.firstChild);

  function currentLineFromEditor(existingId){
    if(!estimate)throw new Error('No estimate loaded.');
    const qty=Number($('qty').value||1),part=Math.round(Number($('part').value||0)*100),hours=Number($('hours').value||0),rate=Math.round(Number($('rate').value||0)*100);
    const operation=$('operation').value;
    const safety=operation==='calibrate'||operation==='scan';
    return {id:existingId||crypto.randomUUID(),category:'scope',component:$('component').value.trim()||'Unspecified item',operation,quantity:qty,laborHours:hours,laborRate:{amountMinor:rate,currency:estimate.currency},partOrMaterial:{amountMinor:part,currency:estimate.currency},total:{amountMinor:part*qty+Math.round(hours*rate),currency:estimate.currency},safetyCritical:safety,procedureRefs:safety?['human_procedure_review_required']:undefined,humanApproved:true,provenance:[{provider:'user_entry',retrievedAt:new Date().toISOString(),licenseClass:'customer_provided'}]};
  }

  function reason(){const value=$('suppReason').value.trim();if(!value)throw new Error('Enter a supplement reason first.');return value;}

  async function change(id,type){
    try{
      const payload={type,reason:reason()};
      if(type==='remove'){if(!selectedLine)throw new Error('Select an estimate line to remove.');payload.lineId=selectedLine;}
      if(type==='replace'){if(!selectedLine)throw new Error('Select an estimate line to replace.');payload.lineId=selectedLine;payload.line=currentLineFromEditor(selectedLine);}
      if(type==='add')payload.line=currentLineFromEditor();
      await api('/v1/supplements/'+id+'/changes',{method:'POST',body:JSON.stringify(payload)});
      note('Supplement change added.');await load();
    }catch(e){note(e.message,true)}
  }

  async function submit(id){try{await api('/v1/supplements/'+id+'/submit',{method:'POST',body:'{}'});note('Supplement submitted for review.');await load();}catch(e){note(e.message,true)}}
  async function approve(id){try{const result=await api('/v1/supplements/'+id+'/approve',{method:'POST',body:'{}'});estimate=result.estimate;lines=estimate.lines||[];selectedLine=null;render();renderInspector(null);note('Supplement approved and applied as estimate revision '+estimate.revision+'.');await load();}catch(e){note(e.message,true)}}

  function card(s){
    const changes=(s.changes||[]).map(c=>'<div class="suppChange"><strong>'+esc(c.type.toUpperCase())+'</strong> • '+esc(c.reason)+'</div>').join('');
    const buttons=s.status==='draft'?'<div class="suppActions"><button class="secondary" data-act="add">Add editor line</button><button class="secondary" data-act="replace">Replace selected</button><button class="secondary" data-act="remove">Remove selected</button><button class="primary" data-act="submit">Submit</button></div>':s.status==='submitted'?'<div class="suppActions"><button class="primary" data-act="approve">Approve + Apply</button></div>':'';
    return '<div class="suppCard" data-id="'+esc(s.id)+'"><div class="suppCardHead"><b>SUPP '+esc(s.id.slice(0,8))+'</b><span>'+esc(s.status.toUpperCase())+'</span></div><div class="suppMeta">Base revision '+s.baseRevision+' • '+s.changes.length+' changes</div>'+changes+buttons+'</div>';
  }

  async function load(){
    const target=$('suppManagerList');
    if(!estimate){target.innerHTML='<div class="emptyState">Load an approved estimate to manage supplements.</div>';return;}
    try{
      const rows=await api('/v1/estimates/'+estimate.id+'/supplements');
      target.innerHTML=rows.length?rows.map(card).join(''):'<div class="emptyState">No supplements. Use + Supplement to create one after estimate approval.</div>';
      target.querySelectorAll('.suppCard').forEach(el=>el.querySelectorAll('button[data-act]').forEach(btn=>btn.onclick=()=>{const id=el.dataset.id,act=btn.dataset.act;if(act==='submit')submit(id);else if(act==='approve')approve(id);else change(id,act)}));
    }catch(e){target.innerHTML='<div class="emptyState">'+esc(e.message)+'</div>'}
  }

  $('suppRefresh').onclick=load;
  document.addEventListener('click',e=>{if(e.target&&['createSupplement','queueRefresh'].includes(e.target.id))setTimeout(load,150)});
})();`;
