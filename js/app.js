import { decodeMotorSpecs, decodeByTypeCode } from './decoders/engine.js';
import {
  extractTypeCode,
  isValidTypeCode,
  normalizeLabelInput,
  repairOcrTypeCode,
} from './decoders/type-code.js';
import { buildDecodeHints } from './decoders/motor-catalog.js';
import { recognizeCapture } from './ocr.js';
import { drawMaskOverlay, getMaskForMode } from './scan-frame.js';
import { calcLa40Modifications, LA40_COMPONENTS } from './la40-modifications.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function on(el, event, handler) {
  if (el) el.addEventListener(event, handler);
}

let currentSpecs = null;
let currentImageDataUrl = null;

// --- Navigation ---
function initNavigation() {
  $$('.nav-btn').forEach((btn) => {
    on(btn, 'click', () => {
      const view = btn.dataset.view;
      showView(view);
      $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
    });
  });
}

function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `view-${name}`));
}

// --- Camera / file ---
const video = $('#camera-video');
const previewCanvas = $('#camera-preview');
const canvas = $('#capture-canvas');
const cameraWrap = $('#camera-wrap');
const scanFrameHint = $('#scan-frame-hint');
const fileInput = $('#file-input');
const cameraBtn = $('#camera-btn');
const galleryBtn = $('#gallery-btn');
const captureBtn = $('#capture-btn');
const stopCameraBtn = $('#stop-camera-btn');
let stream = null;
let previewRaf = null;

function getScanMode() {
  const checked = document.querySelector('input[name="scan-mode"]:checked');
  return checked?.value === 'full' ? 'full' : 'type';
}

function applyScanFrameUi() {
  if (!scanFrameHint) return;
  const mask = getMaskForMode(getScanMode());
  scanFrameHint.textContent = mask.label;
}

function initCameraUi() {
  applyScanFrameUi();

  $$('input[name="scan-mode"]').forEach((el) => {
    on(el, 'change', applyScanFrameUi);
  });

  on(cameraBtn, 'click', startCamera);
  on(galleryBtn, 'click', () => fileInput?.click());
  on(captureBtn, 'click', captureFromCamera);
  on(stopCameraBtn, 'click', stopCamera);

  on(fileInput, 'change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageFile(file);
    fileInput.value = '';
  });
}

async function startCamera() {
  try {
    if (!video || !cameraWrap) {
      showToast('Camera UI not ready — reload the page.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Camera not supported. Use Gallery instead.');
      return;
    }

    stopCamera();

    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.muted = true;
    video.srcObject = stream;

    cameraWrap.classList.remove('hidden');
    applyScanFrameUi();
    captureBtn.classList.remove('hidden');
    stopCameraBtn.classList.remove('hidden');
    cameraBtn.classList.add('hidden');

    await new Promise((resolve, reject) => {
      if (video.videoWidth > 0) {
        resolve();
        return;
      }
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Video failed to load'));
      setTimeout(() => resolve(), 3000);
    });

    await video.play();
    startPreviewLoop();
    scanFrameHint?.classList.remove('hidden');
  } catch (err) {
    console.error('Camera error:', err);
    showToast(err?.name === 'NotAllowedError'
      ? 'Camera permission denied.'
      : 'Camera failed — try Gallery instead.');
    stopCamera();
  }
}

function stopPreviewLoop() {
  if (previewRaf) {
    cancelAnimationFrame(previewRaf);
    previewRaf = null;
  }
}

function startPreviewLoop() {
  stopPreviewLoop();
  if (!previewCanvas || !video) return;

  const paint = () => {
    if (!stream) return;

    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (vw > 0 && vh > 0) {
      if (previewCanvas.width !== vw || previewCanvas.height !== vh) {
        previewCanvas.width = vw;
        previewCanvas.height = vh;
      }
      const ctx = previewCanvas.getContext('2d');
      ctx.drawImage(video, 0, 0, vw, vh);
      drawMaskOverlay(ctx, vw, vh, getMaskForMode(getScanMode()));
    }

    previewRaf = requestAnimationFrame(paint);
  };

  previewRaf = requestAnimationFrame(paint);
}

function stopCamera() {
  stopPreviewLoop();
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (video) video.srcObject = null;
  cameraWrap?.classList.add('hidden');
  scanFrameHint?.classList.add('hidden');
  captureBtn?.classList.add('hidden');
  stopCameraBtn?.classList.add('hidden');
  cameraBtn?.classList.remove('hidden');
}

async function captureFromCamera() {
  if (!stream) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  stopCamera();
  await runOcrOnCapture(canvas);
}

async function processImageFile(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = async () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    await runOcrOnCapture(canvas);
  };
  img.src = url;
}

async function runOcrOnCapture(sourceCanvas) {
  const mode = getScanMode();
  setLoading(true, mode === 'type' ? 'Reading type code…' : 'Reading label…');
  progressWrap.classList.remove('hidden');
  progressBar.style.width = '0%';

  try {
    const { result, preview } = await recognizeCapture(sourceCanvas, mode);
    currentImageDataUrl = preview.toDataURL('image/jpeg', 0.95);

    rawTextArea.value = result.cleanText || '';

    if (result.typeCode) {
      $('#type-code-input').value = result.typeCode;
    }

    decodeAndShow(result.cleanText || result.rawBlob || result.typeCode || '');

    if (result.foundCount === 0 && !result.typeCode) {
      showToast(mode === 'type'
        ? 'Could not read type code — try Full label mode or paste manually.'
        : 'Could not read label — paste type code manually.');
    } else if (mode === 'full' && result.foundCount < 3 && !result.typeCode) {
      showToast(`Partial read (${result.foundCount} fields) — check and edit below.`);
    } else if (result.typeCode) {
      showToast('Label read — specifications decoded.');
    }
  } catch (err) {
    showToast('OCR failed. Paste type code manually.');
    console.error(err);
  } finally {
    setLoading(false);
    progressWrap.classList.add('hidden');
  }
}

// --- OCR ---
const progressBar = $('#ocr-progress');
const progressWrap = $('#ocr-progress-wrap');
const rawTextArea = $('#raw-text');

function initOcrUi() {
  document.addEventListener('ocr-progress', (e) => {
    if (progressBar) progressBar.style.width = `${e.detail}%`;
  });

  on($('#decode-btn'), 'click', () => {
    decodeAndShow(rawTextArea?.value || '');
  });

  on($('#type-code-input'), 'keydown', (e) => {
    if (e.key === 'Enter') decodeAndShow(rawTextArea?.value || '');
  });

  on($('#type-code-input'), 'paste', () => {
    setTimeout(() => decodeAndShow(rawTextArea?.value || ''), 50);
  });

  on(rawTextArea, 'paste', () => {
    setTimeout(() => decodeAndShow(rawTextArea?.value || ''), 50);
  });
}

function decodeAndShow(text) {
  const bodyText = normalizeLabelInput(text);
  const hints = buildDecodeHints(bodyText);
  const typeOverride = repairOcrTypeCode($('#type-code-input').value, hints);

  const codeFromField = typeOverride && isValidCode(typeOverride) ? typeOverride : null;
  const codeFromBody = extractTypeCode(bodyText, hints);
  const directCode = codeFromField || codeFromBody;

  if (directCode) {
    const fromCode = decodeByTypeCode(directCode, hints);
    const fromLabel = decodeMotorSpecs(bodyText);
    currentSpecs = fromCode
      ? { ...fromCode, ...pickLabelFields(fromLabel), confidence: Math.max(fromCode.confidence, fromLabel.confidence) }
      : fromLabel;
  } else {
    currentSpecs = decodeMotorSpecs(bodyText);
  }

  if (currentImageDataUrl) {
    const preview = $('#preview-img');
    if (preview) {
      preview.src = currentImageDataUrl;
      preview.classList.remove('hidden');
    }
  }

  renderResults(currentSpecs);
}

function isValidCode(c) {
  return isValidTypeCode(c);
}

function pickLabelFields(specs) {
  if (!specs) return {};
  return {
    itemNo: specs.itemNo,
    workOrder: specs.workOrder,
    productionDate: specs.productionDate,
    maxLoadPush: specs.maxLoadPush,
    maxLoadPull: specs.maxLoadPull,
    maxCurrent: specs.maxCurrent,
    dutyCycle: specs.dutyCycle,
    voltage: specs.voltage || undefined,
    ipRating: specs.ipRating || undefined,
  };
}

// --- Results ---
function renderResults(specs) {
  const grid = $('#results-grid');
  grid.innerHTML = '';

  const fields = [
    ['Model', specs.model],
    ['Type code', specs.typeCode],
    ['Stroke', specs.strokeMm != null ? `${specs.strokeMm} mm` : null],
    ['Install length (retracted)', specs.installLengthMm != null ? `${specs.installLengthMm} mm` : null],
    ['Fully extended', specs.fullyExtendedMm != null ? `${specs.fullyExtendedMm} mm` : null],
    ['Install formula', specs.installFormula],
    ['Back fixture', specs.backFixtureDesc || specs.backFixture],
    ['Item no.', specs.itemNo],
    ['W/O #', specs.workOrder],
    ['Voltage', specs.voltage],
    ['Max current', specs.maxCurrent],
    ['Max load (push)', specs.maxLoadPush],
    ['Max load (pull)', specs.maxLoadPull],
    ['Duty cycle', specs.dutyCycle],
    ['IP rating', specs.ipRating],
    ['Spindle pitch', specs.spindlePitch],
    ['Feedback', specs.feedback],
    ['Motor variant', specs.motorVariant],
    ['Brake', specs.brake],
    ['Production date', specs.productionDate],
  ];

  let shown = 0;
  for (const [label, value] of fields) {
    if (value == null || value === '') continue;
    shown++;
    const row = document.createElement('div');
    row.className = 'spec-row';
    row.innerHTML = `<span class="spec-label">${label}</span><span class="spec-value">${escapeHtml(String(value))}</span>`;
    grid.appendChild(row);
  }

  if (shown === 0) {
    grid.innerHTML = '<p class="empty">No specifications decoded. Paste a type code in the field above.</p>';
  }

  const conf = $('#confidence');
  conf.textContent = `${specs.confidence}%`;
  conf.className = 'confidence ' + (specs.confidence >= 70 ? 'high' : specs.confidence >= 40 ? 'med' : 'low');

  const warnings = $('#warnings');
  warnings.innerHTML = '';
  if (specs.warnings.length) {
    specs.warnings.forEach((w) => {
      const li = document.createElement('li');
      li.textContent = w;
      warnings.appendChild(li);
    });
    warnings.parentElement.classList.remove('hidden');
  } else {
    warnings.parentElement.classList.add('hidden');
  }

  $('#results-section').classList.remove('hidden');

  if (specs.model === 'LA40' && specs.installLengthMm != null && specs.strokeMm != null) {
    const installInput = $('#la40-install');
    const strokeInput = $('#la40-stroke');
    if (installInput) installInput.value = String(specs.installLengthMm);
    if (strokeInput) strokeInput.value = String(specs.strokeMm);
  }

  showView('scan');
}

function initResultsUi() {
  on($('#share-btn'), 'click', async () => {
    if (!currentSpecs) return;
    const text = formatSpecsText(currentSpecs);
    try {
      await navigator.share({ title: 'LINAK Actuator Specs', text });
    } catch {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard');
    }
  });
}

function formatSpecsText(s) {
  const lines = [
    `LINAK ${s.model || 'Actuator'} Specifications`,
    s.typeCode ? `Type: ${s.typeCode}` : null,
    s.strokeMm != null ? `Stroke: ${s.strokeMm} mm` : null,
    s.installLengthMm != null ? `Install length: ${s.installLengthMm} mm` : null,
    s.fullyExtendedMm != null ? `Fully extended: ${s.fullyExtendedMm} mm` : null,
    s.voltage ? `Voltage: ${s.voltage}` : null,
    s.maxLoadPush ? `Push: ${s.maxLoadPush}` : null,
    s.maxLoadPull ? `Pull: ${s.maxLoadPull}` : null,
    s.dutyCycle ? `Duty: ${s.dutyCycle}` : null,
    s.workOrder ? `W/O: ${s.workOrder}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

// --- LA40 modifications ---
function initLa40ModsUi() {
  on($('#la40-mods-calc-btn'), 'click', calculateLa40Modifications);
  on($('#la40-install'), 'keydown', (e) => {
    if (e.key === 'Enter') calculateLa40Modifications();
  });
  on($('#la40-stroke'), 'keydown', (e) => {
    if (e.key === 'Enter') calculateLa40Modifications();
  });
}

function calculateLa40Modifications() {
  const install = parseWeightInput($('#la40-install')?.value);
  const stroke = parseWeightInput($('#la40-stroke')?.value);

  if (!install || !stroke) {
    showToast('Enter valid install and stroke values in mm.');
    $('#la40-mods-summary')?.classList.add('hidden');
    $('#la40-components')?.classList.add('hidden');
    return;
  }

  const result = calcLa40Modifications(install, stroke);
  renderLa40Modifications(result);
}

function renderLa40Modifications(result) {
  const summary = $('#la40-mods-summary');
  const fullyExtended = $('#la40-fully-extended');
  const componentsEl = $('#la40-components');

  if (fullyExtended) fullyExtended.textContent = `${result.fullyExtendedMm} mm`;
  summary?.classList.remove('hidden');

  if (componentsEl) {
    componentsEl.innerHTML = LA40_COMPONENTS.map((comp) => {
      const length = result[comp.lengthKey];
      return `
        <article class="card la40-component-card">
          <div class="la40-component-layout">
            <div class="la40-component-info">
              <h3>${escapeHtml(comp.name)}</h3>
              <p class="la40-component-length">${escapeHtml(String(length))} <span>mm</span></p>
              <p class="la40-component-note">${escapeHtml(comp.note)}</p>
            </div>
            <img class="la40-component-photo" src="${comp.image}" alt="${escapeHtml(comp.name)}" loading="lazy" />
          </div>
        </article>
      `;
    }).join('');
    componentsEl.classList.remove('hidden');
  }
}

// --- Weight calculators ---
function initWeightCalculatorUi() {
  on($('#bed-calc-btn'), 'click', calculateBedDistribution);
  on($('#seat-calc-btn'), 'click', calculateSeatDistribution);

  on($('#bed-total-weight'), 'keydown', (e) => {
    if (e.key === 'Enter') calculateBedDistribution();
  });
  on($('#seat-total-weight'), 'keydown', (e) => {
    if (e.key === 'Enter') calculateSeatDistribution();
  });
}

function parseWeightInput(raw) {
  const cleaned = String(raw || '').trim().replace(',', '.');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

function formatKg(value) {
  return `${value.toFixed(2)} kg`;
}

function formatPlates(valueKg) {
  return `${(valueKg / 5).toFixed(2)} × 5 kg plates`;
}

function renderWeightCards(targetEl, rows) {
  if (!targetEl) return;
  targetEl.innerHTML = '';
  rows.forEach((row) => {
    const card = document.createElement('div');
    card.className = 'weight-card';
    card.innerHTML = `
      <div>
        <div class="weight-card-label">${escapeHtml(row.label)}</div>
        <div class="weight-card-pct">${escapeHtml(row.pct)}</div>
      </div>
      <div class="weight-card-values">
        <div class="weight-card-kg">${escapeHtml(formatKg(row.kg))}</div>
        <div class="weight-card-plates">${escapeHtml(formatPlates(row.kg))}</div>
      </div>
    `;
    targetEl.appendChild(card);
  });
  targetEl.classList.remove('hidden');
}

function calculateBedDistribution() {
  const input = $('#bed-total-weight');
  const results = $('#bed-results');
  const totalKg = parseWeightInput(input?.value);

  if (!totalKg) {
    showToast('Enter a valid total bed weight in kg.');
    results?.classList.add('hidden');
    return;
  }

  renderWeightCards(results, [
    { label: 'Backrest', pct: '45%', kg: totalKg * 0.45 },
    { label: 'Centre', pct: '25%', kg: totalKg * 0.25 },
    { label: 'Legrest', pct: '30%', kg: totalKg * 0.30 },
  ]);
}

function calculateSeatDistribution() {
  const input = $('#seat-total-weight');
  const results = $('#seat-results');
  const totalKg = parseWeightInput(input?.value);

  if (!totalKg) {
    showToast('Enter a valid total seat weight in kg.');
    results?.classList.add('hidden');
    return;
  }

  renderWeightCards(results, [
    { label: 'Backrest', pct: '58.75%', kg: totalKg * 0.5875 },
    { label: 'Seat', pct: '24.38%', kg: totalKg * 0.2438 },
    { label: 'Legrest', pct: '16.88%', kg: totalKg * 0.1688 },
  ]);
}

// --- Helpers ---
function setLoading(on, msg) {
  $('#loading').classList.toggle('hidden', !on);
  if (msg) $('#loading-text').textContent = msg;
}

function showToast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// --- PWA ---
function initServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function bootApp() {
  try {
    initNavigation();
    initCameraUi();
    initOcrUi();
    initResultsUi();
    initLa40ModsUi();
    initWeightCalculatorUi();
    initServiceWorker();
    showView('scan');
  } catch (err) {
    console.error('LINAK app init failed:', err);
    window.__linakShowBootError?.('App init failed: ' + (err.message || 'unknown error'));
  }
}

bootApp();
