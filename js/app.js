import { decodeMotorSpecs, getAllSupportedModels } from './decoders/engine.js';
import { extractTypeCode, normalizeLabelInput } from './decoders/type-code.js';
import { recognizeText } from './ocr.js';
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
const fileInput = $('#file-input');
const cameraBtn = $('#camera-btn');
const galleryBtn = $('#gallery-btn');
const captureBtn = $('#capture-btn');
const stopCameraBtn = $('#stop-camera-btn');
let stream = null;

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
    stopCamera();
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
    });
    video.srcObject = stream;
    video.classList.remove('hidden');
    captureBtn.classList.remove('hidden');
    stopCameraBtn.classList.remove('hidden');
    cameraBtn.classList.add('hidden');
  } catch (err) {
    showToast('Camera access denied. Use gallery upload instead.');
  }
}

function stopCamera() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
  video.classList.add('hidden');
  captureBtn.classList.add('hidden');
  stopCameraBtn.classList.add('hidden');
  cameraBtn.classList.remove('hidden');
}

async function captureFromCamera() {
  if (!stream) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  currentImageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  stopCamera();
  await runOcr(canvas);
}

async function processImageFile(file) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = async () => {
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    currentImageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    URL.revokeObjectURL(url);
    await runOcr(canvas);
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

async function runOcr(imageSource) {
  setLoading(true, 'Reading label…');
  progressWrap.classList.remove('hidden');
  progressBar.style.width = '0%';

  try {
    const text = await recognizeText(imageSource);
    rawTextArea.value = text;
    decodeAndShow(text);
    if (text.trim().length < 10) {
      showToast('Little text detected — edit the text box manually.');
    }
  } catch (err) {
    showToast('OCR failed. Paste label text manually.');
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
  const typeOverride = normalizeLabelInput($('#type-code-input').value);
  const bodyText = normalizeLabelInput(text);

  let fullText = bodyText;

  // Type override field always wins
  if (typeOverride) {
    fullText = `Type: ${typeOverride}\n${bodyText}`;
  } else {
    // Bare type code pasted alone e.g. "27210B+1130504A"
    const bare = extractTypeCode(bodyText);
    if (bare && bodyText.replace(/\s/g, '').toUpperCase() === bare) {
      fullText = `Type: ${bare}`;
    }
  }

  currentSpecs = decodeMotorSpecs(fullText);

  // Fallback: decode type override directly
  if (!currentSpecs.typeCode && typeOverride) {
    currentSpecs = decodeMotorSpecs(`Type: ${typeOverride}`);
  }

  renderResults(currentSpecs);

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
    ['Item no.', specs.itemNo],
    ['W/O #', specs.workOrder],
    ['Stroke', specs.strokeMm != null ? `${specs.strokeMm} mm` : null],
    ['Built-in (retracted)', specs.builtInMm != null ? `${specs.builtInMm} mm` : null],
    ['Fully extended', specs.fullyExtendedMm != null ? `${specs.fullyExtendedMm} mm` : null],
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

  for (const [label, value] of fields) {
    if (!value) continue;
    const row = document.createElement('div');
    row.className = 'spec-row';
    row.innerHTML = `<span class="spec-label">${label}</span><span class="spec-value">${escapeHtml(String(value))}</span>`;
    grid.appendChild(row);
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
