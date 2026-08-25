const apiBase = (import.meta.env.VITE_ESTIMATING_API_ORIGIN || '').replace(/\/$/, '');

function apiUrl(path: string): string {
  return apiBase ? `${apiBase}${path}` : path;
}

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');

app.innerHTML = `
  <section class="shell">
    <header>
      <p class="eyebrow">Elite Estimating</p>
      <h1>Cross-platform estimating workspace</h1>
      <p>Web, mobile and desktop client boundary for estimates, photos, VIN data and documents.</p>
    </header>
    <div class="grid">
      <label class="card">
        <strong>Vehicle / VIN</strong>
        <input id="vin" inputmode="text" autocomplete="off" placeholder="Enter VIN" maxlength="17" />
      </label>
      <label class="card">
        <strong>Damage photos</strong>
        <input id="photos" type="file" accept="image/*" capture="environment" multiple />
        <span id="photo-count">No photos selected</span>
      </label>
      <label class="card">
        <strong>Claim / registration documents</strong>
        <input id="documents" type="file" accept="image/*,application/pdf" multiple />
        <span id="document-count">No documents selected</span>
      </label>
      <div class="card">
        <strong>Backend</strong>
        <code>${apiBase || 'same-origin web API'}</code>
        <button id="health" type="button">Check API</button>
        <span id="health-status">Not checked</span>
      </div>
    </div>
  </section>
`;

const style = document.createElement('style');
style.textContent = `
  :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, sans-serif; background:#070b16; color:#f8fafc; }
  * { box-sizing:border-box; }
  body { margin:0; min-width:320px; min-height:100vh; padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left); }
  .shell { max-width:1100px; margin:auto; padding:32px 20px; }
  .eyebrow { text-transform:uppercase; letter-spacing:.18em; font-size:12px; color:#7dd3fc; font-weight:800; }
  h1 { font-size:clamp(32px,7vw,64px); line-height:1; margin:.25em 0; }
  header p:last-child { color:#a5b4c8; max-width:760px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:14px; margin-top:28px; }
  .card { display:flex; flex-direction:column; gap:12px; padding:18px; border:1px solid #26324a; border-radius:18px; background:#0d1424; min-height:150px; }
  input, button { width:100%; min-height:44px; border-radius:10px; border:1px solid #334155; background:#111827; color:#fff; padding:10px 12px; }
  button { cursor:pointer; font-weight:700; }
  code, span { color:#94a3b8; overflow-wrap:anywhere; }
`;
document.head.appendChild(style);

function bindFileCount(id: string, outputId: string, noun: string) {
  const input = document.querySelector<HTMLInputElement>(`#${id}`);
  const output = document.querySelector<HTMLElement>(`#${outputId}`);
  input?.addEventListener('change', () => {
    const count = input.files?.length || 0;
    if (output) output.textContent = count ? `${count} ${noun}${count === 1 ? '' : 's'} selected` : `No ${noun}s selected`;
  });
}

bindFileCount('photos', 'photo-count', 'photo');
bindFileCount('documents', 'document-count', 'document');

document.querySelector<HTMLButtonElement>('#health')?.addEventListener('click', async () => {
  const status = document.querySelector<HTMLElement>('#health-status');
  if (status) status.textContent = 'Checking…';
  try {
    const response = await fetch(apiUrl('/health'), { credentials: 'include' });
    if (status) status.textContent = response.ok ? 'API reachable' : `API returned ${response.status}`;
  } catch {
    if (status) status.textContent = 'API unavailable';
  }
});
