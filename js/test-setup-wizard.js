import {
  parseWeightInput,
  formatKg,
  formatPlates,
  getDistributionForProduct,
  formatDistributionSummary,
} from './weight-distribution.js';
import { downloadSetupWord, downloadSetupJson, saveSetupRecord } from './setup-export.js';
import {
  fileToJpegDataUrl,
  waitForVideoReady,
  captureVideoFrame,
} from './setup-photos.js';

const STORAGE_KEY = 'linak_test_setup_wizard_v1';

export const SETUP_STEPS = [
  { id: 'product', title: 'Bed or chair', short: 'Product' },
  { id: 'test-type', title: 'Type of test', short: 'Test' },
  { id: 'cad', title: 'CAD version', short: 'CAD' },
  { id: 'actuators', title: 'Actuators used', short: 'Actuators', photos: 'actuatorPhotos' },
  { id: 'load', title: 'Load applied', short: 'Load', photos: 'loadPhotos' },
  { id: 'duty', title: 'Duty cycle / motor cycle time', short: 'Duty' },
  { id: 'counters', title: 'Counters applied', short: 'Counters', photos: 'counterPhotos' },
  { id: 'fan', title: 'Cooling fan applied', short: 'Fan', photos: 'coolingFanPhotos' },
  { id: 'start', title: 'Has testing started', short: 'Start' },
];

const TEST_TYPES = {
  bed: [
    'Static load',
    'Dynamic / cycle',
    'Destructive',
    'Stability',
    'Headboard / footboard',
    'Other',
  ],
  chair: [
    'Static load',
    'Dynamic / cycle',
    'Destructive',
    'Stability',
    'Backrest / legrest',
    'Other',
  ],
};

export function createSetupState() {
  return {
    productType: '',
    testType: '',
    testTypeOther: '',
    cadVersion: '',
    actuators: '',
    actuatorPhotos: [],
    loadApplied: '',
    loadTotalKg: '',
    weightDistribution: '',
    scalesUsed: '',
    loadPhotos: [],
    dutyCycle: '',
    cycleTimeNotes: '',
    countersQty: '',
    counterPhotos: [],
    coolingFanUsed: null,
    coolingFanPhotos: [],
    testingStartedAt: null,
    completedAt: null,
  };
}

export function loadSetupState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return createSetupState();
    const parsed = JSON.parse(raw);
    delete parsed._photoCounts;
    return { ...createSetupState(), ...parsed };
  } catch {
    return createSetupState();
  }
}

export function saveSetupState(state) {
  const {
    actuatorPhotos,
    loadPhotos,
    counterPhotos,
    coolingFanPhotos,
    ...meta
  } = state;

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...meta,
      _photoCounts: {
        actuators: actuatorPhotos?.length || 0,
        load: loadPhotos?.length || 0,
        counters: counterPhotos?.length || 0,
        fan: coolingFanPhotos?.length || 0,
      },
    }));
  } catch {
    /* quota exceeded — continue in memory */
  }
}

export function getStepIndex(stepId) {
  return SETUP_STEPS.findIndex((s) => s.id === stepId);
}

export function validateStep(stepId, state) {
  switch (stepId) {
    case 'product':
      if (!state.productType) return fail('Select bed or chair before continuing.');
      return ok();

    case 'test-type': {
      if (!state.testType) return fail('Select the type of test.');
      if (state.testType === 'Other' && !state.testTypeOther.trim()) {
        return fail('Describe the test type.');
      }
      return ok();
    }

    case 'cad':
      if (!state.cadVersion.trim()) return fail('Enter the CAD version.');
      return ok();

    case 'actuators':
      if (!state.actuators.trim()) return fail('List the actuators used.');
      if (!state.actuatorPhotos.length) return fail('Add at least one photo of the actuators.');
      return ok();

    case 'load':
      if (!state.loadApplied.trim()) return fail('Enter the load applied.');
      if (!state.weightDistribution.trim()) return fail('Record the weight distribution.');
      if (!state.scalesUsed.trim()) return fail('Record which scales were used.');
      if (!state.loadPhotos.length) return fail('Add photos of the loaded setup and scales.');
      return ok();

    case 'duty':
      if (!state.dutyCycle.trim()) return fail('Enter the duty cycle or motor cycle time.');
      if (!state.cycleTimeNotes.trim()) return fail('Add notes for the duty / cycle time.');
      return ok();

    case 'counters':
      if (!state.countersQty.trim()) return fail('Enter the quantity of counters used.');
      if (!state.counterPhotos.length) return fail('Add photos of the counters.');
      return ok();

    case 'fan':
      if (state.coolingFanUsed === null) return fail('Confirm whether a cooling fan is applied.');
      if (state.coolingFanUsed && !state.coolingFanPhotos.length) {
        return fail('Add a photo of the cooling fan setup.');
      }
      return ok();

    case 'start':
      if (!state.testingStartedAt) return fail('Confirm that testing has started to record the timestamp.');
      return ok();

    default:
      return ok();
  }
}

function ok() {
  return { ok: true, message: '' };
}

function fail(message) {
  return { ok: false, message };
}

export function buildSetupSummary(state) {
  const testLabel =
    state.testType === 'Other' ? state.testTypeOther.trim() : state.testType;

  return [
    `Test setup record`,
    `Product: ${state.productType}`,
    `Test type: ${testLabel}`,
    `CAD version: ${state.cadVersion}`,
    `Actuators: ${state.actuators}`,
    `Load applied: ${state.loadApplied}`,
    `Weight distribution: ${state.weightDistribution}`,
    `Scales used: ${state.scalesUsed}`,
    `Duty cycle / cycle time: ${state.dutyCycle}`,
    `Cycle notes: ${state.cycleTimeNotes}`,
    `Counters qty: ${state.countersQty}`,
    `Cooling fan: ${state.coolingFanUsed ? 'Yes' : 'No'}`,
    `Testing started: ${state.testingStartedAt || '—'}`,
    `Photos: actuators ${state.actuatorPhotos.length}, load ${state.loadPhotos.length}, counters ${state.counterPhotos.length}, fan ${state.coolingFanPhotos.length}`,
  ].join('\n');
}

export function initTestSetupWizard({ $, on, showToast, escapeHtml, showView, openWeightsCalculator }) {
  const progressEl = $('#setup-progress');
  const contentEl = $('#setup-step-content');
  const backBtn = $('#setup-back-btn');
  const nextBtn = $('#setup-next-btn');
  const validationEl = $('#setup-validation-msg');
  const summaryCard = $('#setup-summary-card');
  const summaryBody = $('#setup-summary-body');
  const newSetupBtn = $('#setup-new-btn');
  const shareSetupBtn = $('#setup-share-btn');
  const saveWordBtn = $('#setup-save-word-btn');
  const saveZipBtn = $('#setup-save-zip-btn');
  const saveJsonBtn = $('#setup-save-json-btn');
  const fileInput = $('#setup-photo-input');
  const cameraWrap = $('#setup-camera-wrap');
  const cameraVideo = $('#setup-camera-video');
  const captureBtn = $('#setup-capture-btn');
  const cancelCameraBtn = $('#setup-cancel-camera-btn');

  let state = loadSetupState();
  let stepIndex = 0;
  let activePhotoKey = null;
  let cameraStream = null;
  let cameraReady = false;

  function persist() {
    saveSetupState(state);
  }

  function setValidation(message, isError = true) {
    if (!validationEl) return;
    validationEl.textContent = message || '';
    validationEl.classList.toggle('setup-validation-error', Boolean(message && isError));
    validationEl.classList.toggle('setup-validation-ok', Boolean(message && !isError));
  }

  function renderProgress() {
    if (!progressEl) return;
    progressEl.innerHTML = SETUP_STEPS.map((step, i) => {
      const done = i < stepIndex;
      const current = i === stepIndex;
      const blocked = i > stepIndex;
      return `
        <div class="setup-progress-step${done ? ' done' : ''}${current ? ' current' : ''}${blocked ? ' blocked' : ''}" aria-current="${current ? 'step' : 'false'}">
          <span class="setup-progress-dot">${done ? '✓' : i + 1}</span>
          <span class="setup-progress-label">${escapeHtml(step.short)}</span>
        </div>
      `;
    }).join('');
  }

  function photoGalleryHtml(photoKey) {
    const photos = state[photoKey] || [];
    const thumbs = photos.map((src, i) => `
      <div class="setup-photo-thumb">
        <img src="${src}" alt="Setup photo ${i + 1}" />
        <button type="button" class="setup-photo-remove" data-photo-key="${photoKey}" data-photo-index="${i}" aria-label="Remove photo">×</button>
      </div>
    `).join('');

    return `
      <div class="setup-photo-block">
        <div class="setup-photo-required">
          <span class="setup-required-badge">Required</span>
          Photos must be captured before you can continue
        </div>
        <div class="setup-photo-actions">
          <button type="button" class="btn primary setup-photo-btn" data-photo-key="${photoKey}" data-source="camera">Take photo</button>
          <button type="button" class="btn setup-photo-btn" data-photo-key="${photoKey}" data-source="gallery">Gallery</button>
        </div>
        <div class="setup-photo-grid${photos.length ? '' : ' empty'}">${thumbs || '<p class="setup-photo-empty">No photos yet</p>'}</div>
      </div>
    `;
  }

  function renderStep() {
    const step = SETUP_STEPS[stepIndex];
    if (!step || !contentEl) return;

    summaryCard?.classList.add('hidden');
    setValidation('');
    renderProgress();

    if (backBtn) backBtn.disabled = stepIndex === 0;
    if (nextBtn) {
      nextBtn.textContent = step.id === 'start' ? 'Complete setup' : 'Continue';
    }

    let html = `<p class="setup-step-kicker">Step ${stepIndex + 1} of ${SETUP_STEPS.length}</p>`;
    html += `<h3 class="setup-step-title">${escapeHtml(step.title)}</h3>`;

    switch (step.id) {
      case 'product':
        html += `
          <p class="card-desc">Select what is being set up for testing.</p>
          <div class="setup-choice-row">
            <label class="setup-choice${state.productType === 'Bed' ? ' selected' : ''}">
              <input type="radio" name="setup-product" value="Bed" ${state.productType === 'Bed' ? 'checked' : ''} />
              <span>Bed</span>
            </label>
            <label class="setup-choice${state.productType === 'Chair' ? ' selected' : ''}">
              <input type="radio" name="setup-product" value="Chair" ${state.productType === 'Chair' ? 'checked' : ''} />
              <span>Chair</span>
            </label>
          </div>
        `;
        break;

      case 'test-type': {
        const options = TEST_TYPES[state.productType === 'Chair' ? 'chair' : 'bed'];
        html += `<p class="card-desc">Choose the test being performed on this ${escapeHtml(state.productType || 'product').toLowerCase()}.</p>`;
        html += `<label class="field-label" for="setup-test-type">Type of test</label>`;
        html += `<select id="setup-test-type">
          <option value="">Select…</option>
          ${options.map((opt) => `<option value="${escapeHtml(opt)}" ${state.testType === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
        </select>`;
        html += `
          <div id="setup-test-other-wrap" class="${state.testType === 'Other' ? '' : 'hidden'}">
            <label class="field-label" for="setup-test-other">Describe test</label>
            <input type="text" id="setup-test-other" value="${escapeHtml(state.testTypeOther)}" placeholder="e.g. Castor bar cyclic" autocomplete="off" />
          </div>
        `;
        break;
      }

      case 'cad':
        html += `
          <p class="card-desc">Enter the CAD version or file reference used for this setup.</p>
          <label class="field-label" for="setup-cad">CAD version</label>
          <input type="text" id="setup-cad" value="${escapeHtml(state.cadVersion)}" placeholder="e.g. Rev C / 2026-03-18" autocomplete="off" />
        `;
        break;

      case 'actuators':
        html += `
          <p class="card-desc">List every actuator fitted. Photo evidence is mandatory.</p>
          <label class="field-label" for="setup-actuators">Actuators used</label>
          <textarea id="setup-actuators" rows="3" placeholder="e.g. LA40 backrest, LA34 legrest">${escapeHtml(state.actuators)}</textarea>
          ${photoGalleryHtml('actuatorPhotos')}
        `;
        break;

      case 'load': {
        const distLabel = state.productType === 'Chair' ? 'seat' : 'bed';
        html += `
          <p class="card-desc">Enter total test weight and calculate distribution from the ${escapeHtml(distLabel)} weights tool. Photos of the loaded setup are mandatory.</p>
          <label class="field-label" for="setup-load-total">Total weight (kg)</label>
          <input type="text" id="setup-load-total" inputmode="decimal" value="${escapeHtml(state.loadTotalKg)}" placeholder="e.g. 250" autocomplete="off" />
          <div class="setup-load-actions">
            <button type="button" id="setup-calc-load-btn" class="btn primary">Calculate distribution</button>
            <button type="button" id="setup-open-weights-btn" class="btn">Open Weights tab</button>
          </div>
          <div id="setup-load-preview" class="setup-load-preview${state.weightDistribution ? '' : ' hidden'}"></div>
          <label class="field-label" for="setup-load">Load applied</label>
          <input type="text" id="setup-load" value="${escapeHtml(state.loadApplied)}" placeholder="e.g. 250 kg total" autocomplete="off" />
          <label class="field-label" for="setup-distribution">Weight distribution</label>
          <textarea id="setup-distribution" rows="3" placeholder="Use Calculate distribution or enter manually">${escapeHtml(state.weightDistribution)}</textarea>
          <label class="field-label" for="setup-scales">Scales used?</label>
          <input type="text" id="setup-scales" value="${escapeHtml(state.scalesUsed)}" placeholder="e.g. 300 kg floor scales, serial 1234" autocomplete="off" />
          ${photoGalleryHtml('loadPhotos')}
        `;
        break;
      }

      case 'duty':
        html += `
          <p class="card-desc">Record duty cycle and motor cycle time settings for this test.</p>
          <label class="field-label" for="setup-duty">Duty cycle / motor cycle time</label>
          <input type="text" id="setup-duty" value="${escapeHtml(state.dutyCycle)}" placeholder="e.g. 50% duty, 12 s extend / 12 s retract" autocomplete="off" />
          <label class="field-label" for="setup-cycle-notes">Note the</label>
          <textarea id="setup-cycle-notes" rows="3" placeholder="Any dwell times, speed limits, or controller settings">${escapeHtml(state.cycleTimeNotes)}</textarea>
        `;
        break;

      case 'counters':
        html += `
          <p class="card-desc">Record cycle counters fitted to the test. Photos are mandatory.</p>
          <label class="field-label" for="setup-counters-qty">Qty used</label>
          <input type="text" id="setup-counters-qty" inputmode="numeric" value="${escapeHtml(state.countersQty)}" placeholder="e.g. 2" autocomplete="off" />
          ${photoGalleryHtml('counterPhotos')}
        `;
        break;

      case 'fan':
        html += `
          <p class="card-desc">Confirm whether a cooling fan is part of this setup.</p>
          <div class="setup-choice-row">
            <label class="setup-choice${state.coolingFanUsed === true ? ' selected' : ''}">
              <input type="radio" name="setup-fan" value="yes" ${state.coolingFanUsed === true ? 'checked' : ''} />
              <span>Yes — fan applied</span>
            </label>
            <label class="setup-choice${state.coolingFanUsed === false ? ' selected' : ''}">
              <input type="radio" name="setup-fan" value="no" ${state.coolingFanUsed === false ? 'checked' : ''} />
              <span>No fan</span>
            </label>
          </div>
          <div id="setup-fan-photo-wrap" class="${state.coolingFanUsed ? '' : 'hidden'}">
            ${photoGalleryHtml('coolingFanPhotos')}
          </div>
        `;
        break;

      case 'start':
        html += `
          <p class="card-desc">Only confirm once the physical setup is complete and the test is running.</p>
          <div class="setup-start-panel">
            <label class="setup-confirm-check">
              <input type="checkbox" id="setup-started-check" ${state.testingStartedAt ? 'checked' : ''} />
              <span>I confirm testing has started and the setup matches the steps above</span>
            </label>
            <div class="setup-timestamp-box">
              <span class="setup-timestamp-label">Time stamp</span>
              <span id="setup-timestamp-value" class="setup-timestamp-value">${escapeHtml(state.testingStartedAt || 'Not recorded yet')}</span>
            </div>
          </div>
        `;
        break;

      default:
        break;
    }

    contentEl.innerHTML = html;
    bindStepInputs(step.id);
  }

  function renderLoadPreview(rows) {
    const preview = $('#setup-load-preview');
    if (!preview) return;
    if (!rows?.length) {
      preview.innerHTML = '';
      preview.classList.add('hidden');
      return;
    }
    preview.innerHTML = rows.map((row) => `
      <div class="weight-card setup-load-card">
        <div>
          <div class="weight-card-label">${escapeHtml(row.label)}</div>
          <div class="weight-card-pct">${escapeHtml(row.pct)}</div>
        </div>
        <div class="weight-card-values">
          <div class="weight-card-kg">${escapeHtml(formatKg(row.kg))}</div>
          <div class="weight-card-plates">${escapeHtml(formatPlates(row.kg))}</div>
        </div>
      </div>
    `).join('');
    preview.classList.remove('hidden');
  }

  function applyLoadDistribution() {
    const totalInput = $('#setup-load-total');
    state.loadTotalKg = totalInput?.value || state.loadTotalKg;
    const total = parseWeightInput(state.loadTotalKg);

    if (!state.productType) {
      showToast('Select bed or chair first (step 1).');
      return;
    }
    if (!total) {
      showToast('Enter a valid total weight in kg.');
      return;
    }

    const rows = getDistributionForProduct(state.productType, total);
    state.loadTotalKg = String(total);
    state.loadApplied = `${formatKg(total)} total`;
    state.weightDistribution = formatDistributionSummary(rows);

    const loadEl = $('#setup-load');
    const distEl = $('#setup-distribution');
    if (loadEl) loadEl.value = state.loadApplied;
    if (distEl) distEl.value = state.weightDistribution;
    if (totalInput) totalInput.value = state.loadTotalKg;

    renderLoadPreview(rows);
    persist();
    setValidation('Distribution calculated from Weights.', false);
  }

  function bindStepInputs(stepId) {
    const bindText = (id, key) => {
      const el = $(id);
      if (!el) return;
      on(el, 'input', () => {
        state[key] = el.value;
        persist();
        setValidation('');
      });
    };

    switch (stepId) {
      case 'product':
        $$('input[name="setup-product"]').forEach((el) => {
          on(el, 'change', () => {
            state.productType = el.value;
            if (state.testType && !TEST_TYPES[state.productType === 'Chair' ? 'chair' : 'bed'].includes(state.testType)) {
              state.testType = '';
              state.testTypeOther = '';
            }
            persist();
            renderStep();
          });
        });
        break;

      case 'test-type': {
        const select = $('#setup-test-type');
        const otherWrap = $('#setup-test-other-wrap');
        const other = $('#setup-test-other');
        on(select, 'change', () => {
          state.testType = select.value;
          otherWrap?.classList.toggle('hidden', state.testType !== 'Other');
          persist();
          setValidation('');
        });
        on(other, 'input', () => {
          state.testTypeOther = other.value;
          persist();
        });
        break;
      }

      case 'cad':
        bindText('#setup-cad', 'cadVersion');
        break;
      case 'actuators':
        bindText('#setup-actuators', 'actuators');
        bindPhotoButtons();
        break;
      case 'load':
        bindText('#setup-load-total', 'loadTotalKg');
        bindText('#setup-load', 'loadApplied');
        bindText('#setup-distribution', 'weightDistribution');
        bindText('#setup-scales', 'scalesUsed');
        on($('#setup-calc-load-btn'), 'click', applyLoadDistribution);
        on($('#setup-load-total'), 'keydown', (e) => {
          if (e.key === 'Enter') applyLoadDistribution();
        });
        on($('#setup-open-weights-btn'), 'click', () => {
          const total = parseWeightInput($('#setup-load-total')?.value || state.loadTotalKg);
          if (!state.productType) {
            showToast('Select bed or chair first (step 1).');
            return;
          }
          openWeightsCalculator?.(state.productType, total);
          showView?.('weights');
          $$('.nav-btn').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.view === 'weights');
          });
          showToast('Weights tab opened with your total weight.');
        });
        {
          const total = parseWeightInput(state.loadTotalKg);
          if (total && state.productType) {
            renderLoadPreview(getDistributionForProduct(state.productType, total));
          }
        }
        bindPhotoButtons();
        break;
      case 'duty':
        bindText('#setup-duty', 'dutyCycle');
        bindText('#setup-cycle-notes', 'cycleTimeNotes');
        break;
      case 'counters':
        bindText('#setup-counters-qty', 'countersQty');
        bindPhotoButtons();
        break;
      case 'fan':
        $$('input[name="setup-fan"]').forEach((el) => {
          on(el, 'change', () => {
            state.coolingFanUsed = el.value === 'yes';
            if (!state.coolingFanUsed) state.coolingFanPhotos = [];
            persist();
            renderStep();
          });
        });
        bindPhotoButtons();
        break;
      case 'start': {
        const check = $('#setup-started-check');
        const stamp = $('#setup-timestamp-value');
        on(check, 'change', () => {
          if (check.checked) {
            state.testingStartedAt = new Date().toLocaleString();
          } else {
            state.testingStartedAt = null;
          }
          if (stamp) stamp.textContent = state.testingStartedAt || 'Not recorded yet';
          persist();
          setValidation('');
        });
        break;
      }
      default:
        break;
    }
  }

  function bindPhotoButtons() {
    $$('.setup-photo-btn').forEach((btn) => {
      on(btn, 'click', () => {
        activePhotoKey = btn.dataset.photoKey;
        if (btn.dataset.source === 'camera') {
          openSetupCamera();
        } else if (fileInput) {
          fileInput.click();
        }
      });
    });

    $$('.setup-photo-remove').forEach((btn) => {
      on(btn, 'click', () => {
        const key = btn.dataset.photoKey;
        const index = Number(btn.dataset.photoIndex);
        if (!key || !Array.isArray(state[key])) return;
        state[key].splice(index, 1);
        persist();
        renderStep();
      });
    });
  }

  async function openSetupCamera() {
    if (!cameraVideo || !cameraWrap) {
      fileInput?.click();
      return;
    }
    try {
      stopSetupCamera();
      if (!navigator.mediaDevices?.getUserMedia) {
        showToast('Camera not available — use Gallery.');
        fileInput?.click();
        return;
      }

      cameraReady = false;
      if (captureBtn) {
        captureBtn.disabled = true;
        captureBtn.textContent = 'Starting camera…';
      }

      cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });

      cameraVideo.setAttribute('playsinline', '');
      cameraVideo.setAttribute('webkit-playsinline', '');
      cameraVideo.muted = true;
      cameraVideo.srcObject = cameraStream;
      cameraWrap.classList.remove('hidden');

      await waitForVideoReady(cameraVideo);
      cameraReady = true;
      if (captureBtn) {
        captureBtn.disabled = false;
        captureBtn.textContent = 'Capture photo';
      }
    } catch {
      showToast('Could not open camera — use Gallery.');
      stopSetupCamera();
      fileInput?.click();
    }
  }

  function stopSetupCamera() {
    cameraReady = false;
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    if (cameraVideo) cameraVideo.srcObject = null;
    cameraWrap?.classList.add('hidden');
    if (captureBtn) {
      captureBtn.disabled = false;
      captureBtn.textContent = 'Capture photo';
    }
  }

  function addPhotoFromDataUrl(dataUrl) {
    if (!activePhotoKey || !dataUrl) return;
    if (!Array.isArray(state[activePhotoKey])) state[activePhotoKey] = [];
    state[activePhotoKey].push(dataUrl);
    persist();
    renderStep();
    setValidation('Photo added.', false);
  }

  async function processPhotoFile(file) {
    if (!file) return;
    try {
      const dataUrl = await fileToJpegDataUrl(file);
      addPhotoFromDataUrl(dataUrl);
    } catch {
      showToast('Could not read that photo — try another image.');
    }
  }

  function captureSetupPhoto() {
    if (!cameraVideo || !cameraStream || !cameraReady) {
      showToast('Camera not ready — wait a moment and try again.');
      return;
    }
    try {
      addPhotoFromDataUrl(captureVideoFrame(cameraVideo));
      stopSetupCamera();
    } catch {
      showToast('Could not capture photo — try Gallery instead.');
    }
  }

  function collectCurrentStepValues() {
    const step = SETUP_STEPS[stepIndex];
    if (!step) return;

    switch (step.id) {
      case 'test-type':
        state.testType = $('#setup-test-type')?.value || state.testType;
        state.testTypeOther = $('#setup-test-other')?.value || state.testTypeOther;
        break;
      case 'cad':
        state.cadVersion = $('#setup-cad')?.value || state.cadVersion;
        break;
      case 'actuators':
        state.actuators = $('#setup-actuators')?.value || state.actuators;
        break;
      case 'load':
        state.loadTotalKg = $('#setup-load-total')?.value || state.loadTotalKg;
        state.loadApplied = $('#setup-load')?.value || state.loadApplied;
        state.weightDistribution = $('#setup-distribution')?.value || state.weightDistribution;
        state.scalesUsed = $('#setup-scales')?.value || state.scalesUsed;
        break;
      case 'duty':
        state.dutyCycle = $('#setup-duty')?.value || state.dutyCycle;
        state.cycleTimeNotes = $('#setup-cycle-notes')?.value || state.cycleTimeNotes;
        break;
      case 'counters':
        state.countersQty = $('#setup-counters-qty')?.value || state.countersQty;
        break;
      default:
        break;
    }
    persist();
  }

  function goNext() {
    collectCurrentStepValues();
    const step = SETUP_STEPS[stepIndex];
    const result = validateStep(step.id, state);
    if (!result.ok) {
      setValidation(result.message);
      showToast(result.message);
      return;
    }

    if (stepIndex >= SETUP_STEPS.length - 1) {
      state.completedAt = new Date().toISOString();
      persist();
      renderSummary();
      return;
    }

    stepIndex += 1;
    persist();
    renderStep();
    contentEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goBack() {
    if (summaryCard && !summaryCard.classList.contains('hidden')) {
      summaryCard.classList.add('hidden');
      nextBtn?.classList.remove('hidden');
      renderStep();
      return;
    }
    if (stepIndex === 0) return;
    collectCurrentStepValues();
    stepIndex -= 1;
    persist();
    renderStep();
  }

  function renderSummary() {
    if (!summaryCard || !summaryBody) return;
    const testLabel = state.testType === 'Other' ? state.testTypeOther : state.testType;

    summaryBody.innerHTML = `
      <div class="setup-summary-grid">
        <div><span>Product</span><strong>${escapeHtml(state.productType)}</strong></div>
        <div><span>Test type</span><strong>${escapeHtml(testLabel)}</strong></div>
        <div><span>CAD version</span><strong>${escapeHtml(state.cadVersion)}</strong></div>
        <div class="setup-summary-wide"><span>Actuators</span><strong>${escapeHtml(state.actuators)}</strong></div>
        <div><span>Load applied</span><strong>${escapeHtml(state.loadApplied)}</strong></div>
        <div class="setup-summary-wide"><span>Weight distribution</span><strong>${escapeHtml(state.weightDistribution)}</strong></div>
        <div class="setup-summary-wide"><span>Scales used</span><strong>${escapeHtml(state.scalesUsed)}</strong></div>
        <div class="setup-summary-wide"><span>Duty / cycle time</span><strong>${escapeHtml(state.dutyCycle)}</strong></div>
        <div class="setup-summary-wide"><span>Cycle notes</span><strong>${escapeHtml(state.cycleTimeNotes)}</strong></div>
        <div><span>Counters qty</span><strong>${escapeHtml(state.countersQty)}</strong></div>
        <div><span>Cooling fan</span><strong>${state.coolingFanUsed ? 'Yes' : 'No'}</strong></div>
        <div class="setup-summary-wide"><span>Testing started</span><strong>${escapeHtml(state.testingStartedAt || '—')}</strong></div>
      </div>
      <p class="setup-photo-count">Photos captured: actuators ${state.actuatorPhotos.length}, load ${state.loadPhotos.length}, counters ${state.counterPhotos.length}, fan ${state.coolingFanPhotos.length}</p>
    `;

    contentEl.innerHTML = `
      <p class="setup-step-kicker">Setup complete</p>
      <h3 class="setup-step-title">All checks passed</h3>
      <p class="card-desc">This setup record is ready. Save a file for OneDrive or your database, then start a new setup when needed.</p>
    `;
    progressEl.innerHTML = SETUP_STEPS.map((step) => `
      <div class="setup-progress-step done" aria-current="false">
        <span class="setup-progress-dot">✓</span>
        <span class="setup-progress-label">${escapeHtml(step.short)}</span>
      </div>
    `).join('');

    summaryCard.classList.remove('hidden');
    if (backBtn) backBtn.disabled = false;
    if (nextBtn) nextBtn.classList.add('hidden');
    setValidation('Setup complete — saving file with photos…', false);
    autoSaveRecord();
  }

  async function autoSaveRecord() {
    try {
      await saveSetupRecord(state);
      showToast('ZIP saved with Word report and photos — open on your laptop or upload to OneDrive.');
    } catch {
      try {
        await downloadSetupWord(state);
        showToast('Word document saved with photos.');
      } catch {
        showToast('Could not auto-save — tap Save ZIP file.');
      }
    }
  }

  function resetWizard() {
    state = createSetupState();
    stepIndex = 0;
    persist();
    summaryCard?.classList.add('hidden');
    nextBtn?.classList.remove('hidden');
    renderStep();
  }

  async function shareSummary() {
    const text = buildSetupSummary(state);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Test setup record', text });
        return;
      } catch {
        /* fall through */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast('Setup summary copied to clipboard.');
    } catch {
      showToast('Could not share setup summary.');
    }
  }

  function saveWordDocument() {
    downloadSetupWord(state)
      .then(() => showToast('Word document saved with photos.'))
      .catch(() => showToast('Could not save Word document.'));
  }

  function saveZipRecord() {
    saveSetupRecord(state)
      .then(() => showToast('ZIP saved — includes photos folder and Word report.'))
      .catch(() => showToast('Could not save ZIP file.'));
  }

  function saveJsonRecord() {
    try {
      downloadSetupJson(state);
      showToast('JSON record saved for database import.');
    } catch {
      showToast('Could not save JSON record.');
    }
  }

  on(backBtn, 'click', goBack);
  on(nextBtn, 'click', goNext);
  on(newSetupBtn, 'click', resetWizard);
  on(shareSetupBtn, 'click', shareSummary);
  on(saveWordBtn, 'click', saveWordDocument);
  on(saveZipBtn, 'click', saveZipRecord);
  on(saveJsonBtn, 'click', saveJsonRecord);
  on(fileInput, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (file) await processPhotoFile(file);
    e.target.value = '';
  });
  on(captureBtn, 'click', captureSetupPhoto);
  on(cancelCameraBtn, 'click', stopSetupCamera);

  renderStep();

  return {
    resetWizard,
    getState: () => state,
  };
}

function $$(sel) {
  return Array.from(document.querySelectorAll(sel));
}
