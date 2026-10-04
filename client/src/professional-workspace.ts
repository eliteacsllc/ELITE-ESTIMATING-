type Money = { amountMinor: number; currency: string };
type EstimateLine = {
  id: string;
  category: string;
  component: string;
  operation: string;
  quantity: number;
  laborHours?: number;
  partOrMaterial?: Money;
  total: Money;
  procedureRefs?: string[];
  safetyCritical?: boolean;
  aiSuggested?: boolean;
  aiConfidence?: number;
  humanApproved: boolean;
  provenance: Array<{ provider: string; retrievedAt: string; licenseClass: string; confidence?: number }>;
};
type Estimate = {
  id: string;
  claimId?: string;
  asset: Record<string, unknown>;
  lines: EstimateLine[];
  total: Money;
  status: string;
  revision: number;
  jurisdiction: string;
  currency: string;
};
type Completeness = {
  score: number;
  status: string;
  summary: { blockers: number; reviews: number; opportunities: number };
  candidates: Array<{ code: string; severity: string; title: string; reason: string; relatedLineIds: string[]; confidence: number }>;
};
type ComponentIntelligence = {
  lineId: string;
  category: string;
  component: string;
  operation: string;
  laborHours: number | null;
  totalMinor: number;
  currency: string;
  humanApproved: boolean;
  aiSuggested: boolean;
  confidence: number | null;
  safetyCritical: boolean;
  procedureRefs: string[];
  evidence: Array<{ provider: string; sourceId?: string; licenseClass: string; confidence?: number }>;
  related: { diagnostics: string[]; calibrations: string[]; measurements: string[]; procedures: string[] };
  reviewCandidates: Array<{ code: string; severity: string; title: string; reason: string }>;
  releaseState: 'approved' | 'human_review_required' | 'evidence_required';
  rationale: string[];
};
type ComponentWorkspace = {
  graphValid: boolean;
  graphValidationErrors: string[];
  components: ComponentIntelligence[];
  summary: { totalComponents: number; safetyCritical: number; humanReviewRequired: number; evidenceRequired: number };
};

const OPERATIONS = ['repair','replace','remove_install','remove_replace','refinish','blend','inspect','scan','calibrate','measure','clean','other'];

function esc(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]!));
}

function money(minor: number, currency = 'USD'): string {
  return new Intl.NumberFormat(undefined,{style:'currency',currency}).format((minor || 0) / 100);
}

function assetLabel(asset: Record<string, unknown>): string {
  const label = [asset.year, asset.make, asset.model, asset.configuration].filter(Boolean).join(' ');
  return label || String(asset.assetClass || 'Asset');
}

function assetIdentity(asset: Record<string, unknown>): string {
  return String(asset.vin || asset.hin || asset.serialNumber || asset.assetTag || 'Identity pending');
}

async function request<T>(apiBase: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiBase ? `${apiBase}${path}` : path, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.body ? {'content-type':'application/json'} : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(String(body.error || `request_failed_${response.status}`));
  return body as T;
}

export async function mountProfessionalWorkspace(root: HTMLElement, apiBase: string, estimateId: string): Promise<void> {
  root.innerHTML = `<section class="workspace-loading"><strong>Opening estimator workspace…</strong><span>Loading estimate, intelligence graph, and QA review.</span></section>`;

  let estimate: Estimate;
  let completeness: Completeness;
  let componentWorkspace: ComponentWorkspace;

  async function loadCore() {
    [estimate, completeness, componentWorkspace] = await Promise.all([
      request<Estimate>(apiBase, `/v1/estimates/${encodeURIComponent(estimateId)}`),
      request<Completeness>(apiBase, `/v1/estimates/${encodeURIComponent(estimateId)}/completeness-review`),
      request<ComponentWorkspace>(apiBase, `/v1/estimates/${encodeURIComponent(estimateId)}/component-intelligence`),
    ]);
  }

  await loadCore();

  function render(selectedLineId?: string) {
    const selected = componentWorkspace.components.find(component => component.lineId === selectedLineId) || componentWorkspace.components[0];
    const selectedLine = selected ? estimate.lines.find(line => line.id === selected.lineId) : undefined;

    root.innerHTML = `
      <section class="estimator-workspace">
        <header class="workspace-header">
          <div>
            <p class="eyebrow">Elite Estimating OS · Professional Workspace</p>
            <h1>${esc(assetLabel(estimate.asset))}</h1>
            <p class="workspace-subtitle">${esc(assetIdentity(estimate.asset))} · ${esc(estimate.claimId || 'Standalone estimate')} · Revision ${estimate.revision}</p>
          </div>
          <div class="workspace-header-actions">
            <span class="status-pill status-${esc(estimate.status)}">${esc(estimate.status)}</span>
            <button class="elite-action elite-action--secondary" id="workspace-refresh" type="button">Refresh</button>
            <button class="elite-action elite-action--primary" id="workspace-approve" type="button">Submit for approval</button>
          </div>
        </header>

        <section class="workspace-scorebar" aria-label="Estimate readiness">
          <div><span>Completeness</span><strong>${completeness.score}%</strong></div>
          <div><span>Blockers</span><strong>${completeness.summary.blockers}</strong></div>
          <div><span>Reviews</span><strong>${completeness.summary.reviews}</strong></div>
          <div><span>Opportunities</span><strong>${completeness.summary.opportunities}</strong></div>
          <div><span>Estimate total</span><strong>${money(estimate.total.amountMinor, estimate.total.currency)}</strong></div>
        </section>

        <div class="workspace-grid">
          <aside class="workspace-panel assignment-panel">
            <div class="panel-heading"><span>Assignment context</span></div>
            <dl class="context-list">
              <div><dt>Claim</dt><dd>${esc(estimate.claimId || 'Standalone')}</dd></div>
              <div><dt>Asset</dt><dd>${esc(assetLabel(estimate.asset))}</dd></div>
              <div><dt>Identity</dt><dd>${esc(assetIdentity(estimate.asset))}</dd></div>
              <div><dt>Jurisdiction</dt><dd>${esc(estimate.jurisdiction)}</dd></div>
              <div><dt>Revision</dt><dd>${estimate.revision}</dd></div>
              <div><dt>Graph</dt><dd>${componentWorkspace.graphValid ? 'Validated' : 'Needs review'}</dd></div>
            </dl>

            <div class="panel-heading panel-heading--spaced"><span>Connected intelligence</span></div>
            <button class="workspace-link-button" id="load-damage" type="button">Damage IQ graph</button>
            <button class="workspace-link-button" id="load-estimatics" type="button">Estimatics procedures</button>
            <button class="workspace-link-button" id="load-supplement" type="button">Supplement review draft</button>
            <div id="connected-output" class="connected-output">Choose a source to inspect its current context.</div>
          </aside>

          <main class="workspace-panel component-panel">
            <div class="panel-heading component-toolbar">
              <span>Estimate components</span>
              <input id="component-search" class="workspace-search" type="search" placeholder="Search component or operation" />
            </div>
            <div id="component-list" class="component-list">
              ${componentWorkspace.components.length ? componentWorkspace.components.map(component => `
                <button class="component-row ${selected?.lineId === component.lineId ? 'is-selected' : ''}" data-line-id="${esc(component.lineId)}" type="button">
                  <span class="component-main">
                    <strong>${esc(component.component)}</strong>
                    <small>${esc(component.category)} · ${esc(component.operation.replaceAll('_',' '))}</small>
                  </span>
                  <span class="component-meta">
                    <span class="release-dot release-${esc(component.releaseState)}"></span>
                    <strong>${money(component.totalMinor, component.currency)}</strong>
                  </span>
                </button>
              `).join('') : '<div class="empty-state"><strong>No estimate lines yet.</strong><span>Add the first component below or import Damage IQ/estimate data.</span></div>'}
            </div>

            <details class="line-editor" open>
              <summary>Add estimate line</summary>
              <form id="line-form" class="line-form">
                <label>Category<input name="category" required placeholder="Rear bumper" /></label>
                <label>Component<input name="component" required placeholder="Bumper cover" /></label>
                <label>Operation<select name="operation">${OPERATIONS.map(operation => `<option value="${operation}">${operation.replaceAll('_',' ')}</option>`).join('')}</select></label>
                <label>Labor hours<input name="laborHours" type="number" min="0" step="0.1" value="0" /></label>
                <label>Part/material $<input name="partAmount" type="number" min="0" step="0.01" value="0" /></label>
                <label>Total $<input name="totalAmount" type="number" min="0" step="0.01" required value="0" /></label>
                <label class="line-form-wide">Procedure reference<input name="procedureRef" placeholder="OEM procedure / Estimatics reference" /></label>
                <label class="checkbox-label"><input name="safetyCritical" type="checkbox" /> Safety critical</label>
                <button class="elite-action elite-action--primary line-form-wide" type="submit">Add line</button>
              </form>
            </details>
          </main>

          <aside class="workspace-panel intelligence-panel">
            <div class="panel-heading"><span>Component intelligence</span></div>
            ${selected ? `
              <section class="intelligence-hero">
                <div>
                  <small>${esc(selected.category)}</small>
                  <h2>${esc(selected.component)}</h2>
                  <p>${esc(selected.operation.replaceAll('_',' '))} · ${selected.laborHours ?? 0} labor hr</p>
                </div>
                <span class="review-state review-${esc(selected.releaseState)}">${esc(selected.releaseState.replaceAll('_',' '))}</span>
              </section>

              <div class="intel-section">
                <h3>Evidence & provenance</h3>
                ${selected.evidence.length ? selected.evidence.map(source => `<div class="intel-item"><strong>${esc(source.provider)}</strong><span>${esc(source.licenseClass)}${source.confidence !== undefined ? ` · ${Math.round(source.confidence*100)}%` : ''}</span></div>`).join('') : '<p class="intel-warning">No provenance attached.</p>'}
              </div>

              <div class="intel-section">
                <h3>Procedures</h3>
                ${selected.procedureRefs.length ? selected.procedureRefs.map(ref => `<div class="intel-chip">${esc(ref)}</div>`).join('') : '<p class="intel-warning">No procedure reference attached.</p>'}
              </div>

              <div class="intel-section">
                <h3>Related operations</h3>
                <div class="intel-chip-row">
                  ${selected.related.diagnostics.map(label => `<span class="intel-chip">Scan · ${esc(label)}</span>`).join('')}
                  ${selected.related.calibrations.map(label => `<span class="intel-chip">Calibration · ${esc(label)}</span>`).join('')}
                  ${selected.related.measurements.map(label => `<span class="intel-chip">Measure · ${esc(label)}</span>`).join('')}
                  ${!selected.related.diagnostics.length && !selected.related.calibrations.length && !selected.related.measurements.length ? '<span class="muted">No linked diagnostic/calibration/measurement nodes.</span>' : ''}
                </div>
              </div>

              <div class="intel-section">
                <h3>QA / missing-operation review</h3>
                ${selected.reviewCandidates.length ? selected.reviewCandidates.map(candidate => `
                  <article class="qa-finding severity-${esc(candidate.severity)}">
                    <strong>${esc(candidate.title)}</strong>
                    <p>${esc(candidate.reason)}</p>
                  </article>`).join('') : '<p class="intel-success">No line-specific completeness candidates.</p>'}
              </div>
            ` : '<div class="empty-state"><strong>Select a component.</strong><span>Its evidence, procedures, dependencies, pricing, and QA findings will appear here.</span></div>'}
          </aside>
        </div>

        <section class="workspace-panel timeline-panel">
          <div class="panel-heading"><span>Estimate timeline & QA</span><span class="muted">${esc(completeness.status.replaceAll('_',' '))}</span></div>
          <div class="timeline-list">
            <div class="timeline-event"><strong>Revision ${estimate.revision}</strong><span>Current estimate state: ${esc(estimate.status)}</span></div>
            ${completeness.candidates.slice(0,8).map(candidate => `<div class="timeline-event"><strong>${esc(candidate.title)}</strong><span>${esc(candidate.reason)}</span></div>`).join('')}
            ${componentWorkspace.graphValidationErrors.map(error => `<div class="timeline-event timeline-event--warning"><strong>Graph validation</strong><span>${esc(error)}</span></div>`).join('')}
          </div>
        </section>

        <div id="workspace-toast" class="workspace-toast" role="status" aria-live="polite"></div>
      </section>
    `;

    bind();
  }

  function toast(message: string, error = false) {
    const node = root.querySelector<HTMLElement>('#workspace-toast');
    if (!node) return;
    node.textContent = message;
    node.classList.toggle('is-error', error);
    node.classList.add('is-visible');
    window.setTimeout(() => node.classList.remove('is-visible'), 4500);
  }

  async function reload(selectedLineId?: string) {
    await loadCore();
    render(selectedLineId);
  }

  function bind() {
    root.querySelectorAll<HTMLButtonElement>('.component-row').forEach(button => {
      button.addEventListener('click', () => render(button.dataset.lineId));
    });

    const search = root.querySelector<HTMLInputElement>('#component-search');
    search?.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      root.querySelectorAll<HTMLElement>('.component-row').forEach(row => {
        row.hidden = q.length > 0 && !row.textContent?.toLowerCase().includes(q);
      });
    });

    root.querySelector<HTMLButtonElement>('#workspace-refresh')?.addEventListener('click', async () => {
      try { await reload(selected?.lineId); toast('Workspace refreshed.'); }
      catch (error) { toast(error instanceof Error ? error.message : 'Refresh failed', true); }
    });

    root.querySelector<HTMLButtonElement>('#workspace-approve')?.addEventListener('click', async () => {
      try {
        await request(apiBase, `/v1/estimates/${encodeURIComponent(estimate.id)}/approve`, {method:'POST'});
        await reload(selected?.lineId);
        toast('Estimate passed backend approval gates.');
      } catch (error) {
        toast(`Approval blocked: ${error instanceof Error ? error.message : 'review required'}`, true);
      }
    });

    const form = root.querySelector<HTMLFormElement>('#line-form');
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      const data = new FormData(form);
      const category = String(data.get('category') || '').trim();
      const component = String(data.get('component') || '').trim();
      const operation = String(data.get('operation') || 'other');
      const laborHours = Math.max(0, Number(data.get('laborHours') || 0));
      const partAmount = Math.max(0, Number(data.get('partAmount') || 0));
      const totalAmount = Math.max(0, Number(data.get('totalAmount') || 0));
      const procedureRef = String(data.get('procedureRef') || '').trim();
      if (!category || !component || !Number.isFinite(totalAmount)) return toast('Category, component, and valid total are required.', true);

      const line: EstimateLine = {
        id: crypto.randomUUID(),
        category,
        component,
        operation,
        quantity: 1,
        ...(laborHours ? {laborHours} : {}),
        ...(partAmount ? {partOrMaterial:{amountMinor:Math.round(partAmount*100),currency:estimate.currency}} : {}),
        total:{amountMinor:Math.round(totalAmount*100),currency:estimate.currency},
        ...(procedureRef ? {procedureRefs:[procedureRef]} : {}),
        safetyCritical:data.get('safetyCritical') === 'on',
        aiSuggested:false,
        humanApproved:true,
        provenance:[{provider:'estimator',retrievedAt:new Date().toISOString(),licenseClass:'customer_provided'}],
      };
      try {
        await request(apiBase, `/v1/estimates/${encodeURIComponent(estimate.id)}/lines`, {
          method:'PUT',
          body:JSON.stringify({lines:[...estimate.lines,line]}),
        });
        await reload(line.id);
        toast('Estimate line added and intelligence review refreshed.');
      } catch (error) {
        toast(error instanceof Error ? error.message : 'Unable to add line', true);
      }
    });

    async function loadConnected(path: string, label: string) {
      const output = root.querySelector<HTMLElement>('#connected-output');
      if (!output) return;
      output.textContent = `Loading ${label}…`;
      try {
        const data = await request<unknown>(apiBase, path);
        output.innerHTML = `<strong>${esc(label)}</strong><pre>${esc(JSON.stringify(data,null,2).slice(0,5000))}</pre>`;
      } catch (error) {
        output.innerHTML = `<strong>${esc(label)}</strong><p class="intel-warning">${esc(error instanceof Error ? error.message : 'Unavailable')}</p>`;
      }
    }

    root.querySelector<HTMLButtonElement>('#load-damage')?.addEventListener('click', () => loadConnected(`/v1/estimates/${encodeURIComponent(estimate.id)}/damage-graph`, 'Damage IQ graph'));
    root.querySelector<HTMLButtonElement>('#load-estimatics')?.addEventListener('click', () => loadConnected(`/v1/estimates/${encodeURIComponent(estimate.id)}/estimatics-context`, 'Estimatics context'));
    root.querySelector<HTMLButtonElement>('#load-supplement')?.addEventListener('click', () => loadConnected(`/v1/estimates/${encodeURIComponent(estimate.id)}/supplement-review-draft`, 'Supplement review draft'));
  }

  render();
}
