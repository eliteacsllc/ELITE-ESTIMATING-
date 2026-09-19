import './elite-brand.css';

type Mode = 'guided' | 'professional' | 'field' | 'ai-assisted';

const apiBase = (import.meta.env.VITE_ESTIMATING_API_ORIGIN || '').replace(/\/$/, '');
const apiUrl = (path: string) => apiBase ? `${apiBase}${path}` : path;

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');

let mode: Mode = 'professional';
let selectedZone = 'Front bumper';

const checks = [
  ['Damage documented', 100, 'pass'],
  ['Parts identified', 96, 'pass'],
  ['OEM procedures reviewed', 87, 'warning'],
  ['ADAS reviewed', 100, 'pass'],
  ['Labor operations verified', 88, 'warning'],
  ['Photos matched', 94, 'pass'],
  ['Pricing verified', 90, 'pass'],
  ['QA checks passed', 97, 'pass'],
] as const;

const estimateLines = [
  ['Replace', 'Front bumper cover', 'Body', '2.4', '$612.45', 'Photo 12'],
  ['R&I', 'Upper grille', 'Body', '0.6', '$0.00', 'Photo 12'],
  ['Replace', 'Energy absorber', 'Body', '0.4', '$94.10', 'Photo 13'],
  ['R&I', 'Front radar sensor', 'Mechanical', '0.5', '$0.00', 'Photo 14'],
  ['Calibrate', 'Front radar', 'Mechanical', '1.5', '$375.00', 'OEM / ADAS'],
  ['Refinish', 'Front bumper cover', 'Paint', '2.8', '$0.00', 'Photo 12'],
];

function render() {
  const score = Math.round(checks.reduce((s, [,v]) => s + v, 0) / checks.length);
  app.innerHTML = `
  <div class="app-shell mode-${mode}">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">E</span><div><strong>ELITE</strong><span>ESTIMATING</span></div></div>
      <nav>
        <button class="nav-item active">◈ <span>Work</span></button>
        <button class="nav-item">▣ <span>Estimates</span><b>8</b></button>
        <button class="nav-item">⇄ <span>Supplements</span><b>3</b></button>
        <button class="nav-item">⌁ <span>ACV / DV</span></button>
        <button class="nav-item">⌘ <span>Repair Intelligence</span></button>
        <button class="nav-item">▤ <span>Reports</span></button>
        <button class="nav-item">⚙ <span>Admin</span></button>
      </nav>
      <div class="system-card"><span class="status-dot"></span><div><strong>Elite services</strong><small id="service-status">Ready</small></div><button id="health">Check</button></div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <div class="command"><span>⌕</span><input id="command" placeholder="Search or type a command: VIN, add bumper, run ACV, compare estimate..." /></div>
        <div class="top-actions">
          <select id="mode" aria-label="Workspace mode">
            <option value="guided" ${mode==='guided'?'selected':''}>Guided</option>
            <option value="professional" ${mode==='professional'?'selected':''}>Professional</option>
            <option value="field" ${mode==='field'?'selected':''}>Field</option>
            <option value="ai-assisted" ${mode==='ai-assisted'?'selected':''}>AI-assisted</option>
          </select>
          <button class="primary">+ New estimate</button>
        </div>
      </header>

      <section class="attention-strip">
        <div><strong>Needs attention</strong><span>4 estimates</span></div>
        <div><strong>Supplements</strong><span>3 waiting</span></div>
        <div><strong>QA exceptions</strong><span>2</span></div>
        <div><strong>Parts conflicts</strong><span>5</span></div>
        <div><strong>Total-loss review</strong><span>2</span></div>
      </section>

      <section class="loss-header">
        <div>
          <span class="eyebrow">CM-28442 • Auto collision</span>
          <h1>2022 Honda Accord EX</h1>
          <p>VIN 1HGCV1F34NA123456 • 32,450 mi • Front impact • Carrier assignment</p>
        </div>
        <div class="loss-actions">
          <button>Compare revision</button>
          <button>Generate report</button>
          <button class="primary">Finalize</button>
        </div>
      </section>

      <section class="workspace-grid">
        <aside class="context-pane panel">
          <div class="panel-title"><span>Loss context</span><button>•••</button></div>
          <div class="vehicle-card">
            <div class="vehicle-visual">FRONT IMPACT</div>
            <strong>2022 Honda Accord EX</strong><span>FWD • 1.5L Turbo • Automatic</span>
          </div>
          <div class="zone-grid">
            ${['Front bumper','LF fender','Hood','RF lamp','Radar','Cooling'].map(z=>`<button class="zone ${z===selectedZone?'selected':''}" data-zone="${z}">${z}</button>`).join('')}
          </div>
          <div class="section-head"><strong>Evidence</strong><span>18 items</span></div>
          <div class="thumb-grid">
            ${[12,13,14,15,16,17].map(n=>`<button class="thumb">Photo ${n}<small>${n===14?'Radar':'Front'}</small></button>`).join('')}
          </div>
          <button class="dropzone">＋ Add camera, gallery, video or document</button>
        </aside>

        <section class="estimate-pane panel">
          <div class="panel-title"><span>Repair plan • ${selectedZone}</span><div><button>Undo</button><button>History</button></div></div>
          <div class="estimate-toolbar"><button class="primary">+ Line</button><button>AI suggest</button><button>Voice</button><button>Parts compare</button><button>Import estimate</button></div>
          <div class="estimate-table">
            <div class="estimate-row header"><span>Operation</span><span>Component</span><span>Type</span><span>Labor</span><span>Price</span><span>Evidence</span></div>
            ${estimateLines.map(line=>`<div class="estimate-row">${line.map((cell,i)=>`<span class="${i===0?'op':''}">${cell}</span>`).join('')}</div>`).join('')}
          </div>
          <div class="totals">
            <span>Parts <b>$706.55</b></span><span>Labor <b>$1,428.00</b></span><span>Paint/Materials <b>$612.50</b></span><strong>Current $2,747.05</strong>
          </div>
          <div class="revision-bar">
            <span><b>Revision delta</b> +6 added • 1 changed • $428.60 increase</span>
            <button>View full diff</button>
          </div>
        </section>

        <aside class="intel-pane panel">
          <div class="panel-title"><span>Repair intelligence</span><span class="live">LIVE</span></div>
          <div class="completeness">
            <div class="score"><strong>${score}%</strong><span>Repair plan completeness</span></div>
            <div class="meter"><i style="width:${score}%"></i></div>
            ${checks.map(([label,value,state])=>`<div class="check ${state}"><span>${label}</span><b>${value}%</b></div>`).join('')}
          </div>

          <div class="intel-card critical">
            <div class="intel-kicker">ADAS IMPACT</div>
            <strong>Front radar removed</strong>
            <p>Calibration review required before release.</p>
            <div class="source">Source: OEM procedure • confidence 99%</div>
            <div class="button-row"><button>Why?</button><button>View source</button><button class="primary">Add operation</button></div>
          </div>

          <div class="intel-card">
            <div class="intel-kicker">COPILOT</div>
            <strong>4 related operations found</strong>
            <p>Pre-scan, post-scan, corrosion protection and road test may apply to this repair graph.</p>
            <div class="button-row"><button>Review 4</button><button>Dismiss</button></div>
          </div>

          <div class="intel-card total-loss">
            <div class="intel-kicker">ACV SIGNAL</div>
            <strong>Projected repair ratio 79.8%</strong>
            <p>Repair $14,822 + predicted supplement $2,100 against estimated ACV $21,200.</p>
            <button class="primary full">Run full ACV</button>
          </div>
        </aside>
      </section>
    </main>
  </div>`;

  document.querySelector<HTMLSelectElement>('#mode')?.addEventListener('change', (event) => {
    mode = (event.target as HTMLSelectElement).value as Mode;
    render();
  });

  document.querySelectorAll<HTMLButtonElement>('[data-zone]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedZone = button.dataset.zone || selectedZone;
      render();
    });
  });

  document.querySelector<HTMLButtonElement>('#health')?.addEventListener('click', async () => {
    const status = document.querySelector<HTMLElement>('#service-status');
    if (status) status.textContent = 'Checking…';
    try {
      const response = await fetch(apiUrl('/health'), { credentials: 'include' });
      if (status) status.textContent = response.ok ? 'All systems operational' : 'Service degraded';
    } catch {
      if (status) status.textContent = 'Offline-safe mode';
    }
  });

  document.querySelector<HTMLInputElement>('#command')?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    const input = event.currentTarget;
    const command = input.value.trim().toLowerCase();
    if (command.includes('acv')) alert('ACV workflow queued for this loss. Human review remains required.');
    else if (command.includes('compare')) alert('Opening normalized estimate/supplement comparison.');
    else if (command) alert(`Command received: ${input.value}`);
    input.value = '';
  });
}

render();
