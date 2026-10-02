export const intelligenceWorkspaceCss = `
.intelShell{padding:14px;display:grid;gap:12px}.intelToolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.intelToolbar h2{margin:0;font-size:16px}.intelToolbar p{margin:4px 0 0;color:#777780;font-size:9px}.intelActions{display:flex;gap:6px;flex-wrap:wrap}.intelGrid{display:grid;grid-template-columns:1.05fr 1.45fr 1fr;gap:10px}.intelCard{border:1px solid #28282d;background:#0d0d0f;padding:11px;min-width:0}.intelCard h3{font-size:10px;margin:0 0 8px;letter-spacing:.04em}.intelSummary{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}.intelMetric{border:1px solid #26262b;background:#09090b;padding:9px}.intelMetric small{display:block;color:#66666e;font:600 7px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.08em}.intelMetric b{display:block;font-size:18px;margin-top:4px}.intelList{display:grid;gap:7px;max-height:56vh;overflow:auto}.intelFinding{border:1px solid #2a2a30;background:#09090b;padding:9px}.intelFinding[data-severity="blocker"]{border-left:3px solid #ef4444}.intelFinding[data-severity="review"]{border-left:3px solid #f59e0b}.intelFinding[data-severity="opportunity"]{border-left:3px solid #00d1ff}.intelFindingHead{display:flex;justify-content:space-between;gap:8px}.intelFindingHead b{font-size:9px}.intelFindingHead span{font:600 7px ui-monospace,SFMono-Regular,Consolas,monospace;color:#8c8c94}.intelFinding p{font-size:8px;color:#898992;line-height:1.45;margin:6px 0}.intelEvidence{font-size:8px;color:#b7b7bf}.intelButtons{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.intelButtons button{font-size:8px;padding:6px 8px}.intelImport textarea{width:100%;min-height:160px;background:#09090b;border:1px solid #303037;color:#d4d4d8;padding:8px;resize:vertical;font:9px ui-monospace,SFMono-Regular,Consolas,monospace}.intelImport .split{margin-bottom:7px}.intelStatus{font:600 8px ui-monospace,SFMono-Regular,Consolas,monospace;color:#8b8b94}.intelStatus.ready{color:#34d399}.intelStatus.blocked{color:#ef4444}.intelStatus.needs_review{color:#f59e0b}.intelEvidenceItem{border-top:1px solid #202024;padding:7px 0}.intelEvidenceItem b{display:block;font-size:8px}.intelEvidenceItem small{color:#6f6f78}.intelEmpty{color:#686870;font-size:9px;padding:10px 0}.intelDraft{white-space:pre-wrap;font-size:8px;color:#a5a5ad;line-height:1.5}.intelSourceMode{color:#00d1ff}.intelDecision{margin-top:6px;color:#9c9ca5;font-size:8px}.intelFieldLink{border:1px dashed #35526a;padding:8px;margin-top:8px;color:#9fc7d8;font-size:8px}.intelFile{display:none}@media(max-width:1150px){.intelGrid{grid-template-columns:1fr 1fr}.intelGrid>.intelCard:last-child{grid-column:1/-1}}@media(max-width:760px){.intelGrid,.intelSummary{grid-template-columns:1fr}.intelGrid>.intelCard:last-child{grid-column:auto}}
`;

export const intelligenceWorkspaceJs = `(() => {
  const tabs=document.querySelector('.tabs'),main=document.querySelector('.main');
  if(!tabs||!main)return;
  const tab=document.createElement('button');tab.className='tab';tab.dataset.tab='completeness';tab.textContent='Completeness';
  const auditTab=tabs.querySelector('[data-tab="audit"]');tabs.insertBefore(tab,auditTab||null);
  const pane=document.createElement('section');pane.className='tabPane';pane.id='pane-completeness';
  pane.innerHTML='<div class="intelShell"><div class="intelToolbar"><div><div class="eyebrow">ESTIMATE INTELLIGENCE WORKSPACE</div><h2>Find gaps → verify evidence → decide → supplement → field capture → QA</h2><p>Provider-neutral and asset-neutral. Suggestions remain human-governed and source-backed.</p></div><div class="intelActions"><button id="intelDraftIQ" class="primary">Generate DraftIQ</button><button id="intelRefresh" class="secondary">Refresh review</button><button id="intelEvidence" class="secondary">Resolve with Estimatics</button><button id="intelDraft" class="secondary">Supplement draft</button></div></div><div id="intelSummary" class="intelSummary"></div><div class="intelGrid"><div class="intelCard intelImport"><h3>IMPORT STRUCTURED ESTIMATE</h3><div class="split"><label>Provider<select id="intelProvider"><option value="ccc">CCC</option><option value="mitchell">Mitchell</option><option value="audatex">Audatex</option><option value="other">Other</option></select></label><label>Source estimate ID<input id="intelSourceId" placeholder="External estimate ID"></label></div><input id="intelFile" class="intelFile" type="file" accept=".json,application/json"><div class="intelButtons"><button id="intelChooseFile" class="secondary">Choose JSON</button><button id="intelImportBtn" class="primary">Import + Analyze</button></div><textarea id="intelPayload" spellcheck="false" placeholder=\'Paste normalized provider export JSON: {"asset":{...},"currency":"USD","jurisdiction":"MD","lines":[...]}\'></textarea><div class="intelFieldLink">PDF/image ingestion should enter through governed document ingestion before normalization; this screen does not pretend raw PDFs are structured data.</div></div><div class="intelCard"><h3>COMPLETENESS FINDINGS</h3><div id="intelFindings" class="intelList"><div class="intelEmpty">Load an estimate to review completeness.</div></div></div><div class="intelCard"><h3>EVIDENCE / SUPPLEMENT CONTEXT</h3><div id="intelContext" class="intelList"><div class="intelEmpty">Select Refresh, Resolve with Estimatics, or Supplement draft.</div></div></div></div></div>';
  main.appendChild(pane);

  function openTab(){document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('.tabPane').forEach(x=>x.classList.toggle('active',x===pane))}
  tab.onclick=openTab;
  const escLocal=v=>typeof esc==='function'?esc(v):String(v??'').replace(/[&<>"']/g,'');
  const summary=(review)=>{
    const s=review.summary||{};const risk=review.supplementRisk||{};
    return [['Status',review.status||'—'],['Score',review.score??'—'],['Review items',(s.blockers||0)+(s.reviews||0)+(s.opportunities||0)],['Supplement risk',risk.band||risk.level||risk.score||'—']].map(([k,v])=>'<div class="intelMetric"><small>'+escLocal(k)+'</small><b>'+escLocal(v)+'</b></div>').join('');
  };
  function renderReview(review){
    globalThis.__eliteCompletenessReview=review;
    document.querySelector('#intelSummary').innerHTML=summary(review);
    const target=document.querySelector('#intelFindings'),items=review.candidates||[];
    target.innerHTML=items.length?items.map((f,i)=>'<article class="intelFinding" data-severity="'+escLocal(f.severity)+'"><div class="intelFindingHead"><b>'+escLocal(f.title)+'</b><span>'+escLocal(f.severity).toUpperCase()+' · '+Math.round(Number(f.confidence||0)*100)+'%</span></div><p>'+escLocal(f.reason)+'</p><div class="intelEvidence"><strong>Evidence:</strong> '+escLocal((f.evidenceRequired||[]).join(' • ')||'Human review')+'</div><div class="intelDecision"><span class="intelSourceMode">'+escLocal(f.sourceMode||'review')+'</span> · '+escLocal(f.code)+'</div><input data-reason placeholder="Decision reason / evidence note"><div class="intelButtons"><button class="secondary" data-decision="accepted" data-index="'+i+'">Accept</button><button class="secondary" data-decision="rejected" data-index="'+i+'">Reject</button><button class="secondary" data-decision="deferred" data-index="'+i+'">Defer</button></div></article>').join(''):'<div class="intelEmpty">No unresolved completeness findings.</div>';
    target.querySelectorAll('[data-decision]').forEach(btn=>btn.onclick=()=>recordDecision(btn.dataset.decision,Number(btn.dataset.index)));
  }
  async function generateDraftIQ(){
    if(!estimate)return note('Load an estimate first.',true);
    const candidates=(lines||[]).map((line,i)=>({
      component:line.component||line.description||('Line '+(i+1)),
      operation:String(line.operation||'inspect').toLowerCase(),
      description:line.description||line.component||'DraftIQ candidate',
      laborHours:Number(line.laborHours||line.hours||0)||undefined,
      partPrice:Number(line.partPrice||line.partCost||0)||undefined,
      confidence:Number(line.aiConfidence||line.confidence||0.82),
      safetyCritical:Boolean(line.safetyCritical||line.adasRequired),
      evidence:(line.provenance||line.procedureRef)?[
        ...(line.provenance?[{id:String(line.provenance),kind:'observation'}]:[]),
        ...(line.procedureRef?[{id:String(line.procedureRef),kind:'procedure'}]:[])
      ]:[]
    }));
    if(!candidates.length)return note('Add or import estimate evidence/lines before generating DraftIQ.',true);
    try{
      const result=await api('/v1/estimates/'+estimate.id+'/draftiq',{method:'POST',body:JSON.stringify({candidates,requiredEvidenceKinds:['photo'],minimumConfidence:0.8})});
      globalThis.__eliteDraftIQ=result.draft;
      const target=document.querySelector('#intelContext');
      const draft=result.draft;
      const knowledgeItems=result.estimatics?.envelope?.items||[];
      const qaStatus=result.qa?.status||'not_configured';
      const knowledgeStatus=result.estimatics?.status||'not_configured';
      target.innerHTML='<div class="intelStatus '+((result.nextAction||'').includes('evidence')||qaStatus==='blocked'?'blocked':'needs_review')+'">DRAFTIQ · '+escLocal(String(result.nextAction||'human_review').replaceAll('_',' ').toUpperCase())+'</div>'+
        '<div class="intelFieldLink">Preliminary only. No DraftIQ line becomes approved until a qualified reviewer accepts the supporting evidence.</div>'+
        '<div class="intelEvidenceItem"><b>Governed knowledge</b><small>Estimatics: '+escLocal(knowledgeStatus)+' · '+knowledgeItems.length+' source-backed record(s) · QA: '+escLocal(qaStatus)+'</small></div>'+
        (draft.lines||[]).map((x,i)=>'<div class="intelEvidenceItem" data-draftiq-line="'+i+'"><b>'+escLocal((i+1)+'. '+x.component+' · '+x.operation)+'</b><small>'+Math.round(Number(x.confidence||0)*100)+'% confidence · '+escLocal(x.status)+' · '+escLocal((x.reviewReasons||[]).join(' • ')||'evidence ready')+'</small><input data-draftiq-reason placeholder="Reviewer reason / evidence note"><div class="intelButtons"><button class="secondary" data-draftiq-decision="accepted" data-index="'+i+'">Accept</button><button class="secondary" data-draftiq-decision="rejected" data-index="'+i+'">Reject</button><button class="secondary" data-draftiq-decision="deferred" data-index="'+i+'">Defer</button></div></div>').join('')+
        ((draft.missingEvidence||[]).length?'<div class="intelFinding" data-severity="blocker"><b>Missing evidence</b><p>'+escLocal(draft.missingEvidence.join(' • '))+'</p></div>':'')+
        (knowledgeItems.length?'<div class="intelEvidenceItem"><b>Estimatics evidence ready for review</b><small>'+escLocal(knowledgeItems.map(x=>x.title).slice(0,5).join(' • '))+'</small></div>':'');
      target.querySelectorAll('[data-draftiq-decision]').forEach(btn=>btn.onclick=()=>recordDraftIQDecision(btn.dataset.draftiqDecision,Number(btn.dataset.index)));
      openTab();note('DraftIQ preliminary draft generated with Estimatics and QA context. Human review remains required.');
    }catch(e){note(e.message,true)}
  }
  async function recordDraftIQDecision(decision,index){
    const line=globalThis.__eliteDraftIQ?.lines?.[index];if(!line)return;
    const card=document.querySelector('[data-draftiq-line="'+index+'"]');
    const reason=card?.querySelector('[data-draftiq-reason]')?.value?.trim();
    if(!reason)return note('Enter a reviewer reason before recording the DraftIQ decision.',true);
    const evidenceRefs=(line.evidence||[]).map(item=>String(item.id)).filter(Boolean);
    try{
      const result=await api('/v1/estimates/'+estimate.id+'/decisions/draftiq-line',{method:'POST',body:JSON.stringify({
        lineIndex:index,component:line.component,operation:line.operation,decision,reason,evidenceRefs,confidence:line.confidence
      })});
      card?.setAttribute('data-review-state',decision);
      note('DraftIQ line '+(index+1)+' '+decision+(result.replayed?' (existing decision replayed).':'.'));
    }catch(e){note(e.message,true)}
  }
  async function loadReview(){
    if(!estimate)return note('Load an estimate first.',true);
    try{const review=await api('/v1/estimates/'+estimate.id+'/completeness-review');renderReview(review);openTab();note('Completeness review refreshed.');}catch(e){note(e.message,true)}
  }
  async function recordDecision(decision,index){
    const finding=globalThis.__eliteCompletenessReview?.candidates?.[index];if(!finding)return;
    const card=document.querySelector('.intelFinding [data-index="'+index+'"]')?.closest('.intelFinding');const reason=card?.querySelector('[data-reason]')?.value?.trim();if(!reason)return note('Enter a decision reason first.',true);
    try{const result=await api('/v1/estimates/'+estimate.id+'/decisions/completeness-finding',{method:'POST',body:JSON.stringify({code:finding.code,decision,reason,evidenceRefs:[]})});note('Human '+decision+' decision recorded'+(result.replayed?' (existing decision replayed).':'.'));}catch(e){note(e.message,true)}
  }
  async function loadEvidence(){
    if(!estimate)return note('Load an estimate first.',true);
    const target=document.querySelector('#intelContext');target.innerHTML='<div class="intelEmpty">Querying governed repair knowledge…</div>';
    try{const data=await api('/v1/estimates/'+estimate.id+'/estimatics-context');const items=data.envelope?.items||[];target.innerHTML='<div class="intelStatus '+(data.decision?.blocked?'blocked':data.decision?.requiresHumanReview?'needs_review':'ready')+'">'+(data.decision?.blocked?'BLOCKED KNOWLEDGE':data.decision?.requiresHumanReview?'HUMAN REVIEW REQUIRED':'REFERENCE READY')+'</div>'+(items.length?items.map(x=>'<div class="intelEvidenceItem"><b>'+escLocal(x.title)+'</b><small>'+escLocal(x.kind)+' · '+escLocal(x.status)+' · '+escLocal((x.citations||[]).map(c=>c.source_id).join(', '))+'</small></div>').join(''):'<div class="intelEmpty">No applicable knowledge records returned.</div>');}catch(e){target.innerHTML='<div class="intelEmpty">'+escLocal(e.message)+'</div>'}
  }
  async function loadDraft(){
    if(!estimate)return note('Load an estimate first.',true);
    const target=document.querySelector('#intelContext');try{const data=await api('/v1/estimates/'+estimate.id+'/supplement-review-draft');target.innerHTML='<div class="intelStatus '+escLocal(data.status)+'">'+escLocal(data.status).toUpperCase()+'</div><div class="intelFieldLink">'+escLocal(data.disclaimer)+'</div>'+(data.items||[]).map(x=>'<div class="intelEvidenceItem"><b>'+escLocal(x.title)+'</b><div class="intelDraft">'+escLocal(x.note)+'</div><small>'+escLocal((x.evidenceRequired||[]).join(' • '))+'</small></div>').join('');}catch(e){target.innerHTML='<div class="intelEmpty">'+escLocal(e.message)+'</div>'}
  }
  async function importStructured(){
    const raw=document.querySelector('#intelPayload').value.trim();if(!raw)return note('Paste or choose a normalized structured estimate JSON file.',true);
    let payload;try{payload=JSON.parse(raw)}catch{return note('Import JSON is invalid.',true)}
    const provider=document.querySelector('#intelProvider').value,sourceEstimateId=document.querySelector('#intelSourceId').value.trim()||payload.sourceEstimateId;
    if(!sourceEstimateId)return note('Source estimate ID is required.',true);
    const request={provider,sourceEstimateId,claimId:payload.claimId,asset:payload.asset,locale:payload.locale,currency:payload.currency||'USD',jurisdiction:payload.jurisdiction||'US',lines:payload.lines||[]};
    try{const result=await api('/v1/imports/external-estimate',{method:'POST',body:JSON.stringify(request)});estimate=result.estimate;lines=estimate.lines||[];if(typeof render==='function')render();if(typeof renderInspector==='function')renderInspector(null);renderReview(result.completeness);note((result.idempotent?'Re-opened':'Imported')+' '+provider.toUpperCase()+' estimate and ran completeness review.');}catch(e){note(e.message,true)}
  }
  document.querySelector('#intelDraftIQ').onclick=generateDraftIQ;
  document.querySelector('#intelRefresh').onclick=loadReview;
  document.querySelector('#intelEvidence').onclick=loadEvidence;
  document.querySelector('#intelDraft').onclick=loadDraft;
  document.querySelector('#intelImportBtn').onclick=importStructured;
  document.querySelector('#intelChooseFile').onclick=()=>document.querySelector('#intelFile').click();
  document.querySelector('#intelFile').onchange=async e=>{const file=e.target.files?.[0];if(file)document.querySelector('#intelPayload').value=await file.text()};
  document.addEventListener('click',e=>{if(e.target?.id==='loadEstimate'||e.target?.classList?.contains('queueItem'))setTimeout(()=>{if(estimate)loadReview()},250)});
})();`;
