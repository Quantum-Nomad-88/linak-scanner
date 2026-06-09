let worker = null;

async function getWorker() {
  if (!worker) {
    worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const pct = Math.round((m.progress || 0) * 100);
          document.dispatchEvent(new CustomEvent('ocr-progress', { detail: pct }));
        }
      },
    });
  }
  return worker;
}

/** Mild contrast boost — does NOT binarize (binarization was destroying labels) */
function enhanceCanvas(source) {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.min(255, Math.max(0, (g - 110) * 1.4 + 110));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function cropCanvas(source, x0, y0, x1, y1) {
  const out = document.createElement('canvas');
  const sx = Math.floor(source.width * x0);
  const sy = Math.floor(source.height * y0);
  const sw = Math.max(1, Math.floor(source.width * (x1 - x0)));
  const sh = Math.max(1, Math.floor(source.height * (y1 - y0)));
  out.width = sw;
  out.height = sh;
  out.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

function medianWordHeight(words) {
  const h = words.map((w) => w.bbox.y1 - w.bbox.y0).filter((x) => x > 0);
  if (!h.length) return 20;
  h.sort((a, b) => a - b);
  return h[Math.floor(h.length / 2)];
}

function groupWordsIntoLines(words, tolerance) {
  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const lines = [];
  for (const word of sorted) {
    const yc = (word.bbox.y0 + word.bbox.y1) / 2;
    let placed = false;
    for (const line of lines) {
      if (Math.abs(yc - line.yCenter) <= tolerance) {
        line.words.push(word);
        line.yCenter = (line.yCenter + yc) / 2;
        placed = true;
        break;
      }
    }
    if (!placed) lines.push({ yCenter: yc, words: [word] });
  }
  return lines.map((l) => l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0));
}

function lineToText(words) {
  if (!words.length) return '';
  const joined = words.map((w) => w.text).join(' ');
  if (joined.includes(':')) return joined;

  let maxGap = 0, gapAt = -1;
  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].bbox.x0 - words[i].bbox.x1;
    if (gap > maxGap) { maxGap = gap; gapAt = i; }
  }
  const avgW = words.reduce((s, w) => s + (w.bbox.x1 - w.bbox.x0), 0) / words.length;
  if (gapAt >= 0 && maxGap > Math.max(avgW * 0.3, 15)) {
    const left = words.slice(0, gapAt + 1).map((w) => w.text).join(' ');
    const right = words.slice(gapAt + 1).map((w) => w.text).join(' ');
    if (right.trim()) return `${left}: ${right}`;
  }
  return joined;
}

function layoutText(data) {
  const words = (data.words || []).filter((w) => w.text?.trim() && (w.confidence ?? 100) > 20);
  if (!words.length) return data.text || '';
  const tol = Math.max(medianWordHeight(words) * 0.6, 10);
  return groupWordsIntoLines(words, tol).map(lineToText).filter(Boolean).join('\n');
}

async function ocrImage(img, psm) {
  const w = await getWorker();
  await w.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await w.recognize(img);
  return data;
}

/**
 * @param {HTMLCanvasElement|string|Blob} image
 * @returns {Promise<string>}
 */
export async function recognizeText(image) {
  if (!(image instanceof HTMLCanvasElement)) {
    const { data } = await ocrImage(image, Tesseract.PSM.AUTO);
    return data.text || '';
  }

  const original = image;
  const enhanced = enhanceCanvas(image);
  const chunks = [];

  // 1. Full image — original
  const d1 = await ocrImage(original, Tesseract.PSM.AUTO);
  chunks.push(layoutText(d1), d1.text || '');

  // 2. Full image — enhanced contrast
  const d2 = await ocrImage(enhanced, Tesseract.PSM.AUTO);
  chunks.push(layoutText(d2), d2.text || '');

  // 3. Right column crop (values: 27210B+1130504A, 3500 N, etc.)
  const right = cropCanvas(enhanced, 0.35, 0.15, 0.98, 0.85);
  const d3 = await ocrImage(right, Tesseract.PSM.AUTO);
  chunks.push(d3.text || '');

  // 4. Left column crop (labels: Type, Item No., etc.)
  const left = cropCanvas(enhanced, 0.02, 0.15, 0.38, 0.85);
  const d4 = await ocrImage(left, Tesseract.PSM.AUTO);
  const leftLines = (d4.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const rightLines = (d3.text || '').split('\n').map((l) => l.trim()).filter(Boolean);

  if (leftLines.length && rightLines.length) {
    const paired = [];
    const n = Math.min(leftLines.length, rightLines.length);
    for (let i = 0; i < n; i++) {
      const label = leftLines[i].replace(/:+$/, '');
      const val = rightLines[i].replace(/^:/, '');
      if (label && val) paired.push(`${label}: ${val}`);
    }
    if (paired.length) chunks.push(paired.join('\n'));
  }

  // Deduplicate lines, keep all unique content
  const seen = new Set();
  const out = [];
  for (const chunk of chunks) {
    for (const line of chunk.split('\n')) {
      const l = line.trim();
      if (!l || l.length < 2) continue;
      const key = l.toLowerCase();
      if (!seen.has(key)) { seen.add(key); out.push(l); }
    }
  }

  return out.join('\n');
}

export async function terminateOcr() {
  if (worker) { await worker.terminate(); worker = null; }
}
