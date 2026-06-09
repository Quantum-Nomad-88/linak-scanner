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

/**
 * Boost contrast / grayscale to help OCR on curved glossy labels.
 * @param {HTMLCanvasElement} source
 * @returns {HTMLCanvasElement}
 */
function preprocessCanvas(source) {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, out.width, out.height);
  const d = imageData.data;

  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const boosted = Math.min(255, Math.max(0, (gray - 128) * 1.6 + 128));
    const binary = boosted > 145 ? 255 : boosted < 95 ? 0 : boosted;
    d[i] = d[i + 1] = d[i + 2] = binary;
  }

  ctx.putImageData(imageData, 0, 0);
  return out;
}

/**
 * Crop a horizontal slice of the canvas (fractions 0–1).
 */
function cropCanvas(source, x0, y0, x1, y1) {
  const out = document.createElement('canvas');
  const sx = Math.floor(source.width * x0);
  const sy = Math.floor(source.height * y0);
  const sw = Math.floor(source.width * (x1 - x0));
  const sh = Math.floor(source.height * (y1 - y0));
  out.width = sw;
  out.height = sh;
  out.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

function medianWordHeight(words) {
  const heights = words.map((w) => w.bbox.y1 - w.bbox.y0).filter((h) => h > 0);
  if (!heights.length) return 20;
  heights.sort((a, b) => a - b);
  return heights[Math.floor(heights.length / 2)];
}

function groupWordsIntoLines(words, tolerance) {
  const sorted = [...words].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const lines = [];

  for (const word of sorted) {
    const yCenter = (word.bbox.y0 + word.bbox.y1) / 2;
    let placed = false;

    for (const line of lines) {
      const lineY = line.yCenter;
      if (Math.abs(yCenter - lineY) <= tolerance) {
        line.words.push(word);
        line.yCenter = (line.yCenter * (line.words.length - 1) + yCenter) / line.words.length;
        placed = true;
        break;
      }
    }

    if (!placed) {
      lines.push({ yCenter, words: [word] });
    }
  }

  return lines.map((l) => l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0));
}

/**
 * Merge words on one visual row into "Label: value" when columns are split.
 */
function lineToText(words) {
  if (!words.length) return '';

  const text = words.map((w) => w.text).join(' ');
  if (text.includes(':')) return text;

  let maxGap = 0;
  let gapAfter = -1;

  for (let i = 0; i < words.length - 1; i++) {
    const gap = words[i + 1].bbox.x0 - words[i].bbox.x1;
    if (gap > maxGap) {
      maxGap = gap;
      gapAfter = i;
    }
  }

  const avgWidth = words.reduce((s, w) => s + (w.bbox.x1 - w.bbox.x0), 0) / words.length;
  const gapThreshold = Math.max(avgWidth * 0.35, 18);

  if (gapAfter >= 0 && maxGap >= gapThreshold) {
    const left = words.slice(0, gapAfter + 1).map((w) => w.text).join(' ');
    const right = words.slice(gapAfter + 1).map((w) => w.text).join(' ');
    if (right.trim()) return `${left}: ${right}`;
  }

  return text;
}

/**
 * Reconstruct label text from word bounding boxes (fixes two-column labels).
 */
function reconstructFromWords(data) {
  const words = (data.words || []).filter(
    (w) => w.text && w.text.trim() && (w.confidence ?? 100) > 25
  );

  if (!words.length) return data.text || '';

  const tolerance = Math.max(medianWordHeight(words) * 0.65, 12);
  const lines = groupWordsIntoLines(words, tolerance);
  return lines.map(lineToText).filter(Boolean).join('\n');
}

async function recognizeOnce(image, psm) {
  const w = await getWorker();
  await w.setParameters({ tessedit_pageseg_mode: psm });
  const { data } = await w.recognize(image);
  return data;
}

/**
 * @param {string|HTMLImageElement|HTMLCanvasElement|Blob} image
 * @returns {Promise<string>}
 */
export async function recognizeText(image) {
  let canvas = image;

  if (image instanceof HTMLCanvasElement) {
    canvas = preprocessCanvas(image);
  }

  const results = [];

  // Pass 1: layout-aware full image (best for two-column labels)
  const fullData = await recognizeOnce(canvas, Tesseract.PSM.AUTO);
  const layoutText = reconstructFromWords(fullData);
  if (layoutText.trim()) results.push(layoutText);

  // Pass 2: sparse text mode
  const sparseData = await recognizeOnce(canvas, Tesseract.PSM.SPARSE_TEXT);
  const sparseLayout = reconstructFromWords(sparseData);
  if (sparseLayout.trim()) results.push(sparseLayout);

  // Pass 3: OCR right column only (values) and pair with known labels
  if (canvas instanceof HTMLCanvasElement) {
    const rightCrop = cropCanvas(canvas, 0.38, 0.18, 0.98, 0.82);
    const rightData = await recognizeOnce(rightCrop, Tesseract.PSM.AUTO);
    const rightText = (rightData.text || '').trim();
    if (rightText) results.push(rightText);

    const leftCrop = cropCanvas(canvas, 0.02, 0.18, 0.42, 0.82);
    const leftData = await recognizeOnce(leftCrop, Tesseract.PSM.AUTO);
    const leftLines = (leftData.text || '').split(/\n/).map((l) => l.trim()).filter(Boolean);
    const rightLines = rightText.split(/\n/).map((l) => l.trim()).filter(Boolean);

    if (leftLines.length && rightLines.length) {
      const paired = [];
      const count = Math.min(leftLines.length, rightLines.length);
      for (let i = 0; i < count; i++) {
        const label = leftLines[i].replace(/:+$/, '').trim();
        const value = rightLines[i].replace(/^:/, '').trim();
        if (label && value) paired.push(`${label}: ${value}`);
      }
      if (paired.length) results.push(paired.join('\n'));
    }
  }

  // Pass 4: plain full text fallback
  if (fullData.text?.trim()) results.push(fullData.text.trim());

  return mergeOcrResults(results);
}

/**
 * Combine multiple OCR passes, preferring lines with colons (label: value).
 */
function mergeOcrResults(chunks) {
  const lineMap = new Map();

  for (const chunk of chunks) {
    for (const rawLine of chunk.split(/\n/)) {
      const line = rawLine.replace(/\s+/g, ' ').trim();
      if (!line || line.length < 2) continue;

      const key = line
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 12);
      const score = scoreLine(line);
      const prev = lineMap.get(key);
      if (!prev || score > prev.score) lineMap.set(key, { line, score });
    }
  }

  const lines = [...lineMap.values()]
    .sort((a, b) => b.score - a.score)
    .map((v) => v.line);

  const priority = [
    /type\s*:/i,
    /item\s*no/i,
    /date\s*:/i,
    /max\s*load/i,
    /power\s*rate/i,
    /duty\s*cycle/i,
    /w\s*\/\s*o/i,
  ];

  const ordered = [];
  const used = new Set();

  for (const re of priority) {
    const found = lines.find((l) => re.test(l) && !used.has(l));
    if (found) {
      ordered.push(found);
      used.add(found);
    }
  }

  for (const l of lines) {
    if (!used.has(l)) ordered.push(l);
  }

  return ordered.join('\n');
}

function scoreLine(line) {
  let s = 0;
  if (/:/.test(line)) s += 5;
  if (/\d{4}[.\-/]\d{2}/.test(line)) s += 4;
  if (/\d+\s*V/i.test(line)) s += 3;
  if (/push\s*\d+/i.test(line)) s += 3;
  if (/\+\d{6,}/.test(line)) s += 4;
  if (/\d{6}-\d{2,}/.test(line)) s += 3;
  if (/w\s*\/\s*o/i.test(line)) s += 3;
  if (line.length > 80) s -= 2;
  return s;
}

export async function terminateOcr() {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
