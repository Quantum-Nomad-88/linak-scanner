import { decodeMotorSpecs, decodeByTypeCode, getAllSupportedModels } from './decoders/engine.js';
import { extractTypeCode, normalizeLabelInput, sanitizeTypeCode } from './decoders/type-code.js';
import { recognizeText, recognizeTypeCodeOnly } from './ocr.js';
import { cropToMask, getMaskForMode } from './scan-frame.js';
import { addToHistory, getHistory, getHistoryEntry, deleteHistoryEntry, clearHistory } from './history.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

let currentSpecs = null;
let currentImageDataUrl = null;

// --- Navigation ---
$$('.nav-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const view = btn.dataset.view;
    showView(view);
    $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  });
});

function showView(name) {
  $$('.view').forEach((v) => v.classList.toggle('hidden', v.id !== `view-${name}`));
  if (name === 'history') renderHistory();
  if (name === 'models') renderModels();
}

// --- Camera / file ---
const video = $('#camera-video');
const canvas = $('#capture-canvas');
const cameraWrap = $('#camera-wrap');
const scanFrame = $('#scan-frame');
const scanFrameHint = $('#scan-frame-hint');
const fileInput = $('#file-input');
const cameraBtn = $('#camera-btn');
const galleryBtn = $('#gallery-btn');
const captureBtn = $('#capture-btn');
const stopCameraBtn = $('#stop-camera-btn');
let stream = null;

function getScanMode() {
  const checked = document.querySelector('input[name="scan-mode"]:checked');
  return checked?.value === 'full' ? 'full' : 'type';
}

function applyScanFrameUi() {
  if (!cameraWrap || !scanFrameHint) return;
  const mask = getMaskForMode(getScanMode());
  cameraWrap.style.setProperty('--frame-x', `${mask.x * 100}%`);
  cameraWrap.style.setProperty('--frame-y', `${mask.y * 100}%`);
  cameraWrap.style.setProperty('--frame-w', `${mask.w * 100}%`);
  cameraWrap.style.setProperty('--frame-h', `${mask.h * 100}%`);
  scanFrameHint.textContent = mask.label;
}

$$('input[name="scan-mode"]').forEach((el) => {
  el.addEventListener('change', applyScanFrameUi);
});

cameraBtn.addEventListener('click', startCamera);
galleryBtn.addEventListener('click', () => fileInput.click());
captureBtn.addEventListener('click', captureFromCamera);
stopCameraBtn.addEventListener('click', stopCamera);

fileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  await processImageFile(file);
  fileInput.value = '';
});

async function startCamera() {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Camera not supported here. Use Gallery instead.');
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

    // Show camera area before play() so layout has size (required on iOS)
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
  } catch (err) {
    console.error('Camera error:', err);
    showToast(err?.name === 'NotAllowedError'
      ? 'Camera permission denied — allow camera in browser settings.'
      : 'Camera failed — try Gallery instead.');
    stopCamera();
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  cameraWrap.classList.add('hidden');
  captureBtn.classList.add('hidden');
  stopCameraBtn.classList.add('hidden');
  cameraBtn.classList.remove('hidden');
}

function prepareScanCanvas(sourceCanvas) {
  const mode = getScanMode();
  const mask = getMaskForMode(mode);
  const cropped = cropToMask(sourceCanvas, mask);
  currentImageDataUrl = cropped.toDataURL('image/jpeg', 0.95);
  return { cropped, mode };
}

async function captureFromCamera() {
  if (!stream) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  stopCamera();
  const { cropped, mode } = prepareScanCanvas(canvas);
  await runOcr(cropped, mode);
}

async function processImageFile(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = async () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const { cropped, mode } = prepareScanCanvas(canvas);
    await runOcr(cropped, mode);
  };
  img.src = url;
}

// --- OCR ---
const progressBar = $('#ocr-progress');
const progressWrap = $('#ocr-progress-wrap');
const rawTextArea = $('#raw-text');

document.addEventListener('ocr-progress', (e) => {
  progressBar.style.width = `${e.detail}%`;
});

async function runOcr(imageSource, mode = getScanMode()) {
  setLoading(true, mode === 'type' ? 'Reading type code…' : 'Reading label…');
  progressWrap.classList.remove('hidden');
  progressBar.style.width = '0%';

  try {
    const result = mode === 'type'
      ? await recognizeTypeCodeOnly(imageSource)
      : await recognizeText(imageSource);

    rawTextArea.value = result.cleanText || '';

    if (result.typeCode) {
      $('#type-code-input').value = result.typeCode;
    }

    decodeAndShow(result.cleanText || result.rawBlob || result.typeCode || '');

    if (result.foundCount === 0) {
      showToast(mode === 'type'
        ? 'Could not read type code — adjust framing or paste manually.'
        : 'Could not read label — paste type code manually.');
    } else if (mode === 'full' && result.foundCount < 3) {
      showToast(`Partial read (${result.foundCount} fields) — check and edit below.`);
    } else if (mode === 'type' && result.typeCode) {
      showToast('Type code read — specs decoded.');
    }
  } catch (err) {
    showToast('OCR failed. Paste type code manually.');
    console.error(err);
  } finally {
    setLoading(false);
    progressWrap.classList.add('hidden');
  }
}

$('#decode-btn').addEventListener('click', () => {
  decodeAndShow(rawTextArea.value);
});

$('#type-code-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') decodeAndShow(rawTextArea.value);
});

$('#type-code-input').addEventListener('paste', () => {
  setTimeout(() => decodeAndShow(rawTextArea.value), 50);
});

rawTextArea.addEventListener('paste', () => {
  setTimeout(() => decodeAndShow(rawTextArea.value), 50);
});

function decodeAndShow(text) {
  const typeOverride = sanitizeTypeCode($('#type-code-input').value);
  const bodyText = normalizeLabelInput(text);

  // Direct type-code decode is most reliable (paste field or bare code)
  const codeFromField = typeOverride && isValidCode(typeOverride) ? typeOverride : null;
  const codeFromBody = extractTypeCode(bodyText);
  const directCode = codeFromField || codeFromBody;

  if (directCode) {
    const fromCode = decodeByTypeCode(directCode);
    const fromLabel = decodeMotorSpecs(bodyText);
    currentSpecs = fromCode
      ? { ...fromCode, ...pickLabelFields(fromLabel), confidence: Math.max(fromCode.confidence, fromLabel.confidence) }
      : fromLabel;
  } else {
    currentSpecs = decodeMotorSpecs(bodyText);
  }

  renderResults(currentSpecs);
}

function isValidCode(c) {
  return /^\d{5}[A-Z0-9]?\+\d{6,}/.test(c) || /^\d{6}-\d{6,}/.test(c);
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

  if (currentImageDataUrl) {
    $('#preview-img').src = currentImageDataUrl;
    $('#preview-img').classList.remove('hidden');
  }
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
    grid.innerHTML = '<p class="empty">No specs decoded. Paste type code e.g. <strong>27210B+1130504A</strong> in the field below.</p>';
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
  showView('scan');
}

$('#save-btn').addEventListener('click', () => {
  if (!currentSpecs) return;
  addToHistory(currentSpecs);
  showToast('Saved to history');
});

$('#share-btn').addEventListener('click', async () => {
  if (!currentSpecs) return;
  const text = formatSpecsText(currentSpecs);
  try {
    await navigator.share({ title: 'LINAK Motor Specs', text });
  } catch {
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard');
  }
});

function formatSpecsText(s) {
  const lines = [
    `LINAK ${s.model || 'Actuator'} Specs`,
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

// --- History ---
function renderHistory() {
  const list = $('#history-list');
  const items = getHistory();
  list.innerHTML = '';

  if (!items.length) {
    list.innerHTML = '<p class="empty">No scans saved yet.</p>';
    return;
  }

  items.forEach((entry) => {
    const el = document.createElement('button');
    el.className = 'history-item';
    el.type = 'button';
    const date = new Date(entry.timestamp).toLocaleString();
    el.innerHTML = `
      <strong>${escapeHtml(entry.model)}</strong>
      <span>${escapeHtml(entry.typeCode || 'No type code')}</span>
      <span class="meta">${date}${entry.strokeMm ? ` · ${entry.strokeMm} mm` : ''}</span>
    `;
    el.addEventListener('click', () => {
      currentSpecs = entry.specs;
      renderResults(entry.specs);
      rawTextArea.value = entry.specs._parsed?.rawText || '';
      showView('scan');
      $$('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === 'scan'));
    });
    list.appendChild(el);
  });
}

$('#clear-history-btn').addEventListener('click', () => {
  if (confirm('Clear all saved scans?')) {
    clearHistory();
    renderHistory();
  }
});

// --- Models list ---
function renderModels() {
  const list = $('#models-list');
  list.innerHTML = getAllSupportedModels()
    .map((m) => `<li>${m}</li>`)
    .join('');
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
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

// Init
showView('scan');
