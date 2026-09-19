import './elite-brand.css';

const apiBase = (import.meta.env.VITE_ESTIMATING_API_ORIGIN || '').replace(/\/$/, '');

function apiUrl(path: string): string {
  return apiBase ? `${apiBase}${path}` : path;
}

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');

const assetOptions = [
  ['passenger_vehicle','Passenger vehicle'],['commercial_vehicle','Commercial vehicle'],['tractor_trailer','Tractor-trailer'],
  ['heavy_equipment','Heavy equipment'],['agricultural_equipment','Agricultural equipment'],
  ['material_handling_equipment','Material-handling equipment'],['industrial_machinery','Industrial machinery'],
  ['motorcycle','Motorcycle'],['atv_utv','ATV / UTV'],['rv','RV / motorhome'],['marine','Marine / boat'],
  ['ambulance_emergency','Ambulance / emergency'],['crane_specialty','Crane / specialty'],
  ['residential_property','Residential property'],['commercial_property','Commercial property'],['contents','Contents'],['other','Other specialty asset'],
] as const;

const identityConfig: Record<string,{label:string;help:string;placeholder:string;required:boolean;validate:(value:string)=>boolean}> = {
  passenger_vehicle:{label:'VIN',help:'Enter the 17-character VIN.',placeholder:'17-character VIN',required:true,validate:v=>/^[A-HJ-NPR-Z0-9]{17}$/.test(v)},
  commercial_vehicle:{label:'VIN',help:'Enter the vehicle VIN.',placeholder:'VIN',required:true,validate:v=>/^[A-HJ-NPR-Z0-9]{5,25}$/.test(v)},
  tractor_trailer:{label:'VIN',help:'Enter the tractor or trailer VIN.',placeholder:'VIN',required:true,validate:v=>/^[A-HJ-NPR-Z0-9]{5,25}$/.test(v)},
  rv:{label:'VIN',help:'Enter the chassis VIN. Coach identifiers can be added during review.',placeholder:'Chassis VIN',required:true,validate:v=>/^[A-HJ-NPR-Z0-9]{5,25}$/.test(v)},
  motorcycle:{label:'VIN',help:'Enter the motorcycle VIN.',placeholder:'VIN',required:true,validate:v=>/^[A-HJ-NPR-Z0-9]{5,25}$/.test(v)},
  atv_utv:{label:'VIN / Serial',help:'Enter the VIN or manufacturer serial number.',placeholder:'VIN or serial',required:true,validate:v=>v.length>=5},
  ambulance_emergency:{label:'VIN',help:'Enter the chassis VIN; upfit identifiers can be added during review.',placeholder:'Chassis VIN',required:true,validate:v=>/^[A-HJ-NPR-Z0-9]{5,25}$/.test(v)},
  marine:{label:'HIN / Serial',help:'Enter the vessel HIN or primary engine/equipment serial.',placeholder:'HIN or serial',required:true,validate:v=>v.length>=5},
  heavy_equipment:{label:'Serial / PIN',help:'Enter the equipment serial number, PIN, or fleet asset ID.',placeholder:'Serial / PIN',required:true,validate:v=>v.length>=2},
  agricultural_equipment:{label:'Serial / PIN',help:'Enter the equipment serial number or PIN.',placeholder:'Serial / PIN',required:true,validate:v=>v.length>=2},
  material_handling_equipment:{label:'Serial / Asset ID',help:'Enter the serial number or fleet asset ID.',placeholder:'Serial / asset ID',required:true,validate:v=>v.length>=2},
  industrial_machinery:{label:'Serial / Asset Tag',help:'Enter the machine nameplate serial number or asset tag.',placeholder:'Serial / asset tag',required:true,validate:v=>v.length>=2},
  crane_specialty:{label:'Serial / Asset ID',help:'Enter the crane serial number or fleet asset ID.',placeholder:'Serial / asset ID',required:true,validate:v=>v.length>=2},
  residential_property:{label:'Property / Inspection Reference',help:'Optional at setup; address and structure details are captured in the property workflow.',placeholder:'Optional reference',required:false,validate:()=>true},
  commercial_property:{label:'Property / Inspection Reference',help:'Optional at setup; address and structure details are captured in the property workflow.',placeholder:'Optional reference',required:false,validate:()=>true},
  contents:{label:'Inventory Reference',help:'Optional at setup; individual items are captured in the contents workflow.',placeholder:'Optional inventory reference',required:false,validate:()=>true},
  other:{label:'Serial / Asset ID',help:'Enter a serial or asset identifier when available.',placeholder:'Serial / asset ID',required:false,validate:()=>true},
};

app.innerHTML = `
  <section class="elite-shell">
    <header class="hero">
      <p class="eyebrow">Elite Estimating OS</p>
      <h1>Build a complete estimate</h1>
      <p class="lede">Choose the asset, add the evidence you have, and move through the domain-specific estimating and review workflow.</p>
    </header>

    <section class="progress" aria-label="Estimate setup progress">
      <span class="progress-step is-active">1. Asset</span>
      <span class="progress-step">2. Evidence</span>
      <span class="progress-step">3. Review</span>
    </section>

    <div class="elite-grid setup-grid">
      <div class="elite-card field-card">
        <span class="step-label">Asset</span>
        <label for="asset-class"><strong>Asset type</strong></label>
        <span class="help">The selected domain controls identity, inspection, safety, pricing, valuation, and QA requirements.</span>
        <select id="asset-class">${assetOptions.map(([value,label])=>`<option value="${value}">${label}</option>`).join('')}</select>
      </div>

      <label class="elite-card field-card" for="asset-id">
        <span class="step-label">Identity</span>
        <strong id="asset-id-label">VIN</strong>
        <span id="asset-id-help" class="help">Enter the 17-character VIN.</span>
        <input id="asset-id" inputmode="text" autocomplete="off" placeholder="17-character VIN" aria-describedby="asset-id-status" />
        <small id="asset-id-status" class="field-status">Required</small>
      </label>

      <label class="elite-card field-card" for="photos">
        <span class="step-label">Evidence</span>
        <strong>Photos and images</strong>
        <span class="help">Add the clearest evidence you have. More can be added later or received from Claims Management / Damage IQ.</span>
        <input id="photos" type="file" accept="image/*" capture="environment" multiple />
        <span id="photo-count" class="field-status" aria-live="polite">No photos selected</span>
      </label>

      <label class="elite-card field-card" for="documents">
        <span class="step-label">Documents</span>
        <strong>Claim, ownership, inspection, or technical records</strong>
        <span class="help">Optional at setup. Add PDFs or images when available.</span>
        <input id="documents" type="file" accept="image/*,application/pdf" multiple />
        <span id="document-count" class="field-status" aria-live="polite">No documents selected</span>
      </label>
    </div>

    <section class="action-zone" aria-label="Next action">
      <div>
        <strong>Ready when you are</strong>
        <p id="readiness-copy">Complete the required asset identity to continue.</p>
      </div>
      <button id="continue" class="elite-action elite-action--primary" type="button" disabled>Continue estimate</button>
    </section>

    <details class="support-details">
      <summary>Having trouble?</summary>
      <div class="support-content">
        <p id="service-status">Elite services are checked automatically when needed.</p>
        <button id="health" class="elite-action elite-action--secondary" type="button">Check service status</button>
      </div>
    </details>
  </section>
`;

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

const assetClass = document.querySelector<HTMLSelectElement>('#asset-class');
const assetId = document.querySelector<HTMLInputElement>('#asset-id');
const assetIdLabel = document.querySelector<HTMLElement>('#asset-id-label');
const assetIdHelp = document.querySelector<HTMLElement>('#asset-id-help');
const continueButton = document.querySelector<HTMLButtonElement>('#continue');
const readinessCopy = document.querySelector<HTMLElement>('#readiness-copy');
const assetIdStatus = document.querySelector<HTMLElement>('#asset-id-status');

function updateReadiness() {
  const config = identityConfig[assetClass?.value || 'passenger_vehicle'];
  const value = (assetId?.value || '').trim().toUpperCase();
  if (assetId && assetId.value !== value) assetId.value = value;
  if (assetIdLabel) assetIdLabel.textContent = config.label;
  if (assetIdHelp) assetIdHelp.textContent = config.help;
  if (assetId) assetId.placeholder = config.placeholder;
  const valid = !config.required || config.validate(value);
  if (continueButton) continueButton.disabled = !valid;
  if (assetIdStatus) assetIdStatus.textContent = valid ? (value ? 'Asset identity ready' : 'Optional at setup') : 'Required identity is incomplete';
  if (readinessCopy) readinessCopy.textContent = valid
    ? 'Asset setup is ready. Continue to evidence and domain-specific review.'
    : `Complete ${config.label} to continue. Evidence can be added now or later.`;
}

assetClass?.addEventListener('change', updateReadiness);
assetId?.addEventListener('input', updateReadiness);
updateReadiness();

continueButton?.addEventListener('click', () => {
  document.querySelector('.progress-step:nth-child(1)')?.classList.remove('is-active');
  document.querySelector('.progress-step:nth-child(2)')?.classList.add('is-active');
  document.querySelector<HTMLInputElement>('#photos')?.focus();
  if (readinessCopy) readinessCopy.textContent = 'Asset setup complete. Add available evidence, then continue into review.';
});

document.querySelector<HTMLButtonElement>('#health')?.addEventListener('click', async () => {
  const status = document.querySelector<HTMLElement>('#service-status');
  if (status) status.textContent = 'Checking service availability…';
  try {
    const response = await fetch(apiUrl('/health'), { credentials: 'include' });
    if (status) status.textContent = response.ok
      ? 'Elite services are available.'
      : 'A service is temporarily unavailable. Your work is safe; try again shortly.';
  } catch {
    if (status) status.textContent = 'We could not reach the service. Your work is safe; try again when you are connected.';
  }
});
