export const operationsCss = `.queueSearch{display:grid;grid-template-columns:1fr auto;gap:5px;margin-bottom:7px}.queueSearch input{margin:0}.queueSearch button{padding:7px 9px}.queueResults{display:grid;gap:5px;margin-top:8px;max-height:220px;overflow:auto}.queueItem{width:100%;display:flex;justify-content:space-between;gap:8px;text-align:left;border:1px solid #28282d;background:#0a0a0c;color:#d4d4d8;padding:8px;cursor:pointer}.queueItem:hover{border-color:#ff6a0066;background:#ff6a000a}.queueItem span:last-child{text-align:right}.queueItem b{display:block;font-size:9px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.queueItem small,.suppItem small{display:block;color:#62626a;font:500 7px ui-monospace,SFMono-Regular,Consolas,monospace;margin-top:3px}.suppItem{display:flex;justify-content:space-between;gap:8px;border:1px solid #28282d;background:#0a0a0c;padding:8px;color:#bcbcc4;font-size:8px}.commandActions>.secondary{width:auto;white-space:nowrap}@media(max-width:850px){.queueResults{max-height:none}}`;

export const operationsJs = `(() => {
  const left = document.querySelector('.leftPanel');
  const actions = document.querySelector('.commandActions');
  if (!left || !actions) return;

  const queue = document.createElement('div');
  queue.className = 'panelBlock queuePanel';
  queue.innerHTML = '<div class="blockTitle">ESTIMATE QUEUE</div><div class="queueSearch"><input id="queueClaim" placeholder="Claim ID search"><button id="queueSearchBtn" class="secondary">Search</button></div><button id="queueRefresh" class="secondary wide">Recent estimates</button><div id="queueResults" class="queueResults"><div class="emptyState">Load a token, then open recent estimates.</div></div>';
  left.insertBefore(queue, left.children[1] || null);

  const supp = document.createElement('div');
  supp.className = 'panelBlock';
  supp.innerHTML = '<div class="blockTitle">SUPPLEMENTS</div><div id="supplementList" class="queueResults"><div class="emptyState">No estimate loaded.</div></div>';
  left.appendChild(supp);

  const exportBtn = document.createElement('button');
  exportBtn.id = 'exportEstimate';
  exportBtn.className = 'secondary';
  exportBtn.textContent = 'Export';
  actions.appendChild(exportBtn);

  const supplementBtn = document.createElement('button');
  supplementBtn.id = 'createSupplement';
  supplementBtn.className = 'secondary';
  supplementBtn.textContent = '+ Supplement';
  actions.appendChild(supplementBtn);

  const summary = e => '<button class="queueItem" data-id="'+esc(e.id)+'"><span><b>'+(esc(e.claimId || e.asset.assetClass.replaceAll('_',' ')))+'</b><small>'+esc(e.asset.assetClass.replaceAll('_',' '))+' • REV '+e.revision+'</small></span><span><b>'+money(e.total.amountMinor,e.currency)+'</b><small>'+esc(e.status.toUpperCase())+'</small></span></button>';

  async function loadQueue(claimId='') {
    try {
      const path = claimId ? '/v1/estimates?claimId='+encodeURIComponent(claimId) : '/v1/estimates?limit=25';
      const rows = await api(path);
      const target = $('queueResults');
      target.innerHTML = rows.length ? rows.map(summary).join('') : '<div class="emptyState">No estimates found.</div>';
      target.querySelectorAll('.queueItem').forEach(btn => btn.onclick = () => loadEstimate(btn.dataset.id));
    } catch (e) { note(e.message, true); }
  }

  async function loadEstimate(id) {
    try {
      estimate = await api('/v1/estimates/'+id);
      lines = estimate.lines || [];
      selectedLine = null;
      render();
      renderInspector(null);
      await loadSupplements();
      note('Estimate '+estimate.id.slice(0,8)+' loaded from the tenant queue.');
    } catch (e) { note(e.message, true); }
  }

  async function loadSupplements() {
    const target = $('supplementList');
    if (!estimate) { target.innerHTML = '<div class="emptyState">No estimate loaded.</div>'; return; }
    try {
      const rows = await api('/v1/estimates/'+estimate.id+'/supplements');
      target.innerHTML = rows.length ? rows.map(s => '<div class="suppItem"><span><b>SUPP '+s.sequence+'</b><small>'+esc(s.status.toUpperCase())+' • base rev '+s.baseRevision+'</small></span><span>'+s.changes.length+' changes</span></div>').join('') : '<div class="emptyState">No supplements yet.</div>';
    } catch (e) { target.innerHTML = '<div class="emptyState">'+esc(e.message)+'</div>'; }
  }

  $('queueRefresh').onclick = () => loadQueue();
  $('queueSearchBtn').onclick = () => loadQueue($('queueClaim').value.trim());
  $('queueClaim').onkeydown = e => { if (e.key === 'Enter') loadQueue($('queueClaim').value.trim()); };

  exportBtn.onclick = async () => {
    if (!estimate) return note('Load an estimate before exporting.', true);
    try {
      const headers = token ? {authorization:'Bearer '+token} : {};
      const response = await fetch('/v1/estimates/'+estimate.id+'/export',{headers});
      if (!response.ok) { const data=await response.json().catch(()=>({})); throw new Error(data.error || 'Export failed'); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'elite-estimate-'+estimate.id+'.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      note('Canonical Elite estimate exported.');
    } catch (e) { note(e.message, true); }
  };

  supplementBtn.onclick = async () => {
    if (!estimate) return note('Load an estimate before creating a supplement.', true);
    try {
      const created = await api('/v1/estimates/'+estimate.id+'/supplements',{method:'POST',body:'{}'});
      note('Supplement '+created.sequence+' created from estimate revision '+created.baseRevision+'.');
      await loadSupplements();
    } catch (e) { note(e.message, true); }
  };

  const originalCreate = $('createEstimate').onclick;
  $('createEstimate').onclick = async (...args) => { await originalCreate(...args); if (estimate) { await loadQueue(); await loadSupplements(); } };

  const originalApprove = $('approveEstimate').onclick;
  $('approveEstimate').onclick = async (...args) => { await originalApprove(...args); if (estimate) await loadQueue(); };

  if (token) loadQueue();
})();`;
