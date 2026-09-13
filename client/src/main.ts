import './elite-brand.css';

const apiBase = (import.meta.env.VITE_ESTIMATING_API_ORIGIN || '').replace(/\/$/, '');

function apiUrl(path: string): string {
  return apiBase ? `${apiBase}${path}` : path;
}

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Missing #app root');

app.innerHTML = `
  <section class="elite-shell">
    <header class="hero">
      <p class="eyebrow">Elite Estimating</p>
      <h1>Build a complete estimate</h1>
      <p class="lede">Add the vehicle and evidence you have. Elite handles the technical checks, source orchestration, and workflow behind the scenes.</p>
    </header>

    <section class="progress" aria-label="Estimate setup progress">
      <span class="progress-step is-active">1. Vehicle</span>
      <span class="progress-step">2. Evidence</span>
      <span class="progress-step">3. Review</span>
    </section>

    <div class="elite-grid setup-grid">
      <label class="elite-card field-card" for="vin">
        <span class="step-label">Vehicle</span>
        <strong>VIN</strong>
        <span class="help">Enter the 17-character VIN. We’ll use it to prepare the correct vehicle context.</span>
        <input id="vin" inputmode="text" autocomplete="off" placeholder="Enter VIN" maxlength="17" aria-describedby="vin-help" />
        <small id="vin-help" class="field-status">17 characters required</small>
      </label>

      <label class="elite-card field-card" for="photos">
        <span class="step-label">Evidence</span>
        <strong>Damage photos</strong>
        <span class="help">Add the clearest photos you have. More can be added later.</span>
        <input id="photos" type="file" accept="image/*" capture="environment" multiple />
        <span id="photo-count" class="field-status" aria-live="polite">No photos selected</span>
      </label>

      <label class="elite-card field-card" for="documents">
        <span class="step-label">Documents</span>
        <strong>Claim or registration</strong>
        <span class="help">Optional for now. Add PDFs or images if they’re available.</span>
        <input id="documents" type="file" accept="image/*,application/pdf" multiple />
        <span id="document-count" class="field-status" aria-live="polite">No documents selected</span>
      </label>
    </div>

    <section class="action-zone" aria-label="Next action">
      <div>
        <strong>Ready when you are</strong>
        <p id="readiness-copy">Enter a VIN to continue. Evidence can be added now or later.</p>
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

const vin = document.querySelector<HTMLInputElement>('#vin');
const continueButton = document.querySelector<HTMLButtonElement>('#continue');
const readinessCopy = document.querySelector<HTMLElement>('#readiness-copy');
const vinHelp = document.querySelector<HTMLElement>('#vin-help');

function updateReadiness() {
  const value = (vin?.value || '').trim().toUpperCase();
  if (vin && vin.value !== value) vin.value = value;
  const valid = /^[A-HJ-NPR-Z0-9]{17}$/.test(value);
  if (continueButton) continueButton.disabled = !valid;
  if (vinHelp) vinHelp.textContent = valid ? 'Vehicle ready' : `${Math.min(value.length, 17)} of 17 characters`;
  if (readinessCopy) readinessCopy.textContent = valid
    ? 'Vehicle ready. Continue to review the evidence and estimate setup.'
    : 'Enter a VIN to continue. Evidence can be added now or later.';
}

vin?.addEventListener('input', updateReadiness);
updateReadiness();

continueButton?.addEventListener('click', () => {
  document.querySelector('.progress-step:nth-child(1)')?.classList.remove('is-active');
  document.querySelector('.progress-step:nth-child(2)')?.classList.add('is-active');
  document.querySelector<HTMLInputElement>('#photos')?.focus();
  if (readinessCopy) readinessCopy.textContent = 'Vehicle complete. Add available evidence, then continue into review.';
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
