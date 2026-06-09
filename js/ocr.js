import { extractLabelFromOcr } from './label-extract.js';
import {
  extractTypeCode,
  repairPlusTypeCode,
  repairOcrTypeCode,
  bestRepairedTypeCode,
  sanitizeTypeCode,
  isValidTypeCode,
} from './decoders/type-code.js';
import { scoreTypeCodeCandidate } from './decoders/type-code-repair.js';
import { buildDecodeHints } from './decoders/motor-catalog.js';

let worker = null;

const CHAR_WHITELIST = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz+-.:/%#, ';
const TYPE_CODE_WHITELIST = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+';

async function getWorker() {
  if (!worker) {
    worker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          document.dispatchEvent(new CustomEvent('ocr-progress', { detail: Math.round((m.progress || 0) * 100) }));
        }
      },
    });
    await worker.setParameters({
      tessedit_char_whitelist: CHAR_WHITELIST,
      preserve_interword_spaces: '1',
    });
  }
  return worker;
}

function upscaleCanvas(source, minWidth = 1800) {
  if (source.width >= minWidth) return source;
  const scale = minWidth / source.width;
  const out = document.createElement('canvas');
  out.width = Math.round(source.width * scale);
  out.height = Math.round(source.height * scale);
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out;
}

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
    const v = Math.min(255, Math.max(0, (g - 100) * 1.35 + 105));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function binarizeCanvas(source, threshold = 135) {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = g >= threshold ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Invert colours — helps when photo lighting or negative image */
function invertCanvas(source) {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  ctx.drawImage(source, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = 255 - d[i];
    d[i + 1] = 255 - d[i + 1];
    d[i + 2] = 255 - d[i + 2];
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

/** Rotate 180° — handles upside-down photos */
function rotateCanvas180(source) {
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d');
  ctx.translate(out.width, out.height);
  ctx.rotate(Math.PI);
  ctx.drawImage(source, 0, 0);
  return out;
}

function averageLuminance(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 16) {
    sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    n++;
  }
  return n ? sum / n : 128;
}

/** Normal, inverted, and rotated variants for robust OCR */
function buildTypeCodeVariants(upscaled) {
  const enhanced = enhanceCanvas(upscaled);
  const variants = [
    enhanced,
    binarizeCanvas(enhanced, 130),
    invertCanvas(enhanced),
    rotateCanvas180(enhanced),
    invertCanvas(rotateCanvas180(enhanced)),
  ];
  if (averageLuminance(upscaled) < 95) {
    variants.unshift(invertCanvas(binarizeCanvas(invertCanvas(upscaled), 140)));
  }
  return variants;
}

/** Sources for full-label OCR including flipped orientations */
function buildLabelSources(upscaled) {
  const enhanced = enhanceCanvas(upscaled);
  const sources = [enhanced, invertCanvas(enhanced), rotateCanvas180(enhanced)];
  if (averageLuminance(upscaled) < 95) {
    sources.unshift(invertCanvas(upscaled));
  }
  return sources;
}

function bestTypeCodeFromBlobs(blobs) {
  const rawCandidates = [];
  const ocrRaw = blobs.join('');
  const hints = buildDecodeHints(ocrRaw);

  for (const blob of blobs) {
    if (!blob) continue;
    rawCandidates.push(blob);
    rawCandidates.push(extractTypeCode(blob, hints));

    const compact = blob.replace(/\s/g, '').toUpperCase();
    const extSplit = compact.match(/(\d{2}[A-Z0-9]{4,32})[:+]+([A-Z0-9]{4,32})/);
    if (extSplit) rawCandidates.push(`${extSplit[1]}+${extSplit[2]}`);

    const split = compact.match(/(\d{4,8})[:+B8]?(\d{6,}[A-Z0-9]*)/);
    if (split) rawCandidates.push(repairPlusTypeCode(split[1], split[2], hints));

    const digitsOnly = compact.replace(/[^0-9+A-Z]/g, '');
    const joined = digitsOnly.match(/^(\d{5,6}[A-Z]?)(\d{6,}[A-Z0-9]*)$/);
    if (joined) rawCandidates.push(repairPlusTypeCode(joined[1], joined[2], hints));

    const extJoined = digitsOnly.match(/^(\d{2}[A-Z0-9]{6,32})(\d{2}[A-Z0-9]{6,32})$/);
    if (extJoined) rawCandidates.push(`${extJoined[1]}+${extJoined[2]}`);

    const loose = compact.match(/(\d{2}[A-Z0-9]{6,32}\+[A-Z0-9]{6,32})/);
    if (loose) rawCandidates.push(loose[1]);
  }

  const best = bestRepairedTypeCode(rawCandidates.filter(Boolean), ocrRaw, hints);
  if (best && isValidTypeCode(best)) return best;

  const repaired = rawCandidates.map((c) => repairOcrTypeCode(c, hints)).filter(isValidTypeCode);
  repaired.sort((a, b) => scoreTypeCodeCandidate(b, ocrRaw, hints) - scoreTypeCodeCandidate(a, ocrRaw, hints));
  return repaired[0] || null;
}

function cropCanvas(source, x0, y0, x1, y1) {
  const sx = Math.floor(source.width * x0);
  const sy = Math.floor(source.height * y0);
  const sw = Math.max(1, Math.floor(source.width * (x1 - x0)));
  const sh = Math.max(1, Math.floor(source.height * (y1 - y0)));
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}

/** Crop to sticker area — skip LINAK header and barcode footer */
function cropStickerArea(canvas) {
  return cropCanvas(canvas, 0.04, 0.10, 0.96, 0.80);
}

function lineCenterY(words) {
  return words.reduce((s, w) => s + (w.bbox.y0 + w.bbox.y1) / 2, 0) / words.length;
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
        line.yCenter = (line.yCenter * (line.words.length - 1) + yc) / line.words.length;
        placed = true;
        break;
      }
    }
    if (!placed) lines.push({ yCenter: yc, words: [word] });
  }
  return lines.map((l) => l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0));
}

function wordsToLine(words) {
  return words.map((w) => w.text).join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Split words into left (labels) and right (values) columns, pair by row.
 */
function pairColumns(data, imageWidth) {
  const words = (data.words || []).filter(
    (w) => w.text?.trim() && (w.confidence ?? 0) > 35
  );
  if (words.length < 2) return [];

  const splitX = imageWidth * 0.40;
  const left = words.filter((w) => (w.bbox.x0 + w.bbox.x1) / 2 < splitX);
  const right = words.filter((w) => (w.bbox.x0 + w.bbox.x1) / 2 >= splitX);

  const heights = words.map((w) => w.bbox.y1 - w.bbox.y0).filter((h) => h > 0);
  heights.sort((a, b) => a - b);
  const tol = Math.max((heights[Math.floor(heights.length / 2)] || 20) * 0.75, 14);

  const leftLines = groupWordsIntoLines(left, tol);
  const rightLines = groupWordsIntoLines(right, tol);

  const paired = [];
  const usedRight = new Set();

  for (const lWords of leftLines) {
    const lText = wordsToLine(lWords);
    if (!lText || lText.length < 2) continue;

    const ly = lineCenterY(lWords);
    let best = null;
    let bestDist = Infinity;

    for (let i = 0; i < rightLines.length; i++) {
      if (usedRight.has(i)) continue;
      const ry = lineCenterY(rightLines[i]);
      const dist = Math.abs(ly - ry);
      if (dist < bestDist) { bestDist = dist; best = i; }
    }

    if (best !== null && bestDist < tol * 2.5) {
      const rText = wordsToLine(rightLines[best]);
      usedRight.add(best);
      if (rText) {
        // Detect split type code: left=72108 right=1130504A or +1130504A
        const typeRepair = repairPlusTypeCode(
          lText.replace(/[^A-Z0-9]/gi, ''),
          rText.replace(/^[:+]/, '')
        );
        if (typeRepair) {
          paired.push(`Type: ${typeRepair}`);
          continue;
        }
        const label = lText.replace(/:+$/, '').trim();
        if (/^type$/i.test(label)) {
          paired.push(`Type: ${rText.replace(/^[:+]/, '')}`);
        } else {
          paired.push(`${label}: ${rText}`);
        }
        continue;
      }
    }
    paired.push(lText);
  }

  // Unpaired right-column lines (e.g. type code value without label detected)
  for (let i = 0; i < rightLines.length; i++) {
    if (!usedRight.has(i)) {
      const t = wordsToLine(rightLines[i]);
      if (t) paired.push(t);
    }
  }

  return paired;
}

async function ocrCanvas(canvas, psm) {
  const w = await getWorker();
  await w.setParameters({ tessedit_pageseg_mode: psm });
  return (await w.recognize(canvas)).data;
}

/**
 * OCR optimised for a cropped type-code line only.
 */
async function ocrTypeCodeImage(canvas, w) {
  const blobs = [];
  for (const psm of [Tesseract.PSM.SINGLE_LINE, Tesseract.PSM.SINGLE_BLOCK, Tesseract.PSM.RAW_LINE]) {
    if (!psm) continue;
    await w.setParameters({
      tessedit_pageseg_mode: psm,
      tessedit_char_whitelist: TYPE_CODE_WHITELIST,
    });
    const { data } = await w.recognize(canvas);
    if (data.text?.trim()) blobs.push(data.text.trim());
  }
  return blobs;
}

export async function recognizeTypeCodeOnly(image) {
  if (!(image instanceof HTMLCanvasElement)) {
    const data = await ocrCanvas(image, Tesseract.PSM.SINGLE_LINE);
    const code = bestTypeCodeFromBlobs([data.text || '']);
    return makeTypeCodeResult(code, data.text || '');
  }

  const upscaled = upscaleCanvas(image, 2800);
  const variants = [
    enhanceCanvas(upscaled),
    binarizeCanvas(upscaled, 130),
    binarizeCanvas(enhanceCanvas(upscaled), 150),
  ];

  const w = await getWorker();
  const blobs = [];

  for (const variant of variants) {
    blobs.push(...await ocrTypeCodeImage(variant, w));
  }

  await w.setParameters({ tessedit_char_whitelist: CHAR_WHITELIST });

  const rawBlob = blobs.join('\n');
  const code = bestTypeCodeFromBlobs(blobs);
  return makeTypeCodeResult(code, rawBlob);
}

function makeTypeCodeResult(code, rawBlob) {
  return {
    cleanText: code ? `Type: ${code}` : '',
    rawBlob,
    typeCode: code,
    foundCount: code ? 1 : 0,
  };
}

/**
 * @returns {Promise<{ cleanText: string, rawBlob: string, typeCode: string|null, foundCount: number }>}
 */
export async function recognizeText(image) {
  if (!(image instanceof HTMLCanvasElement)) {
    const data = await ocrCanvas(image, Tesseract.PSM.AUTO);
    const extracted = extractLabelFromOcr(data.text || '');
    return {
      cleanText: extracted.cleanText || data.text || '',
      rawBlob: data.text || '',
      typeCode: extracted.fields.typeCode,
      foundCount: extracted.foundCount,
    };
  }

  const upscaled = upscaleCanvas(image);
  const enhanced = enhanceCanvas(upscaled);
  const sticker = cropStickerArea(enhanced);

  const blobs = [];

  // Strategy A: column pairing on sticker crop (best for two-column labels)
  const colData = await ocrCanvas(sticker, Tesseract.PSM.AUTO);
  const paired = pairColumns(colData, sticker.width);
  if (paired.length) blobs.push(paired.join('\n'));
  blobs.push(colData.text || '');

  // Strategy B: separate left / right column OCR
  const leftCrop = cropCanvas(sticker, 0.0, 0.0, 0.42, 1.0);
  const rightCrop = cropCanvas(sticker, 0.38, 0.0, 1.0, 1.0);
  const [leftData, rightData] = await Promise.all([
    ocrCanvas(leftCrop, Tesseract.PSM.SINGLE_BLOCK),
    ocrCanvas(rightCrop, Tesseract.PSM.SINGLE_BLOCK),
  ]);

  const leftLines = (leftData.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const rightLines = (rightData.text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (leftLines.length && rightLines.length) {
    const manual = [];
    const n = Math.max(leftLines.length, rightLines.length);
    for (let i = 0; i < n; i++) {
      const label = (leftLines[i] || '').replace(/:+$/, '');
      const val = rightLines[i] || '';
      if (label && val) manual.push(`${label}: ${val}`);
      else if (val) manual.push(val);
    }
    if (manual.length) blobs.push(manual.join('\n'));
  }
  blobs.push(leftData.text || '', rightData.text || '');

  const rawBlob = blobs.join('\n');
  const extracted = extractLabelFromOcr(rawBlob);

  return {
    cleanText: extracted.cleanText,
    rawBlob,
    typeCode: extracted.fields.typeCode,
    foundCount: extracted.foundCount,
  };
}

export async function terminateOcr() {
  if (worker) { await worker.terminate(); worker = null; }
}
