/**
 * Pull structured LINAK label fields out of messy OCR text.
 */

import { extractTypeCode, sanitizeTypeCode } from './decoders/type-code.js';

/** Fix common OCR mistakes in codes */
function fixOcrCode(s) {
  return s
    .replace(/[Oo]/g, '0')
    .replace(/[Il|]/g, '1')
    .replace(/\s+/g, '')
    .replace(/([A-Z0-9])\s*\+\s*([A-Z0-9])/gi, '$1+$2');
}

/**
 * @param {string} blob - raw OCR output (may be garbage)
 * @returns {{ cleanText: string, fields: Record<string, string|null> }}
 */
export function extractLabelFromOcr(blob) {
  const flat = (blob || '').replace(/\r/g, '\n');
  const compact = fixOcrCode(flat);

  const fields = {};

  // Type code — hunt in full blob
  fields.typeCode = extractTypeCode(compact) || extractTypeCode(flat) || null;

  if (!fields.typeCode) {
    const plusGuess = compact.match(/(\d{5}[A-Z0-9]?[+\s]?\d{6,}[A-Z0-9]*)/i);
    if (plusGuess) fields.typeCode = sanitizeTypeCode(plusGuess[1].replace(/\s/g, ''));
  }

  const item = compact.match(/(\d{6}[-–]\d{2,4})/);
  if (item) fields.itemNo = item[1].toUpperCase();

  const date = flat.match(/(\d{4}[.\-/]\d{2}[.\-/]\d{2})/);
  if (date) fields.date = date[1];

  const wo = compact.match(/(\d{7,8}[-–]\d{4})/);
  if (wo) fields.workOrder = wo[1];

  const push = flat.match(/Push\s*([\d.,]+)\s*N/i);
  if (push) fields.maxLoadPush = `${push[1]} N`;

  const pull = flat.match(/Pull\s*([\d.,]+)\s*N/i);
  if (pull) fields.maxLoadPull = `${pull[1]} N`;

  const volts = flat.match(/(\d{1,2})\s*V\s*DC/i);
  if (volts) fields.voltage = `${volts[1]} V DC`;

  const amps = flat.match(/Max\.?\s*([\d.,]+)\s*(?:Amp|A)\b/i);
  if (amps) fields.maxCurrent = `${amps[1]} A`;

  const duty = flat.match(/(\d{1,3}\s*%[^.\n]{0,40})/i);
  if (duty && /min/i.test(duty[1])) fields.dutyCycle = duty[1].trim();

  const ip = flat.match(/\b(IPX?\d)\b/i);
  if (ip) fields.ipRating = ip[1].toUpperCase();

  // Build clean label text for display
  const lines = [];
  if (fields.typeCode) lines.push(`Type: ${fields.typeCode}`);
  if (fields.itemNo) lines.push(`Item No.: ${fields.itemNo}`);
  if (fields.date) lines.push(`Date: ${fields.date}`);
  if (fields.maxLoadPush || fields.maxLoadPull) {
    const parts = [];
    if (fields.maxLoadPush) parts.push(`Push ${fields.maxLoadPush}`);
    if (fields.maxLoadPull) parts.push(`Pull ${fields.maxLoadPull}`);
    let load = `Max Load: ${parts.join(' / ')}`;
    if (fields.ipRating) load += ` ${fields.ipRating}`;
    lines.push(load);
  }
  if (fields.voltage || fields.maxCurrent) {
    const p = [fields.voltage, fields.maxCurrent ? `Max. ${fields.maxCurrent}` : null].filter(Boolean);
    lines.push(`Power Rate: ${p.join(' / ')}`);
  }
  if (fields.dutyCycle) {
    let d = `Duty Cycle: ${fields.dutyCycle}`;
    if (fields.ipRating && !lines.some((l) => l.includes(fields.ipRating))) d += ` ${fields.ipRating}`;
    lines.push(d);
  }
  if (fields.workOrder) lines.push(`W/O# ${fields.workOrder}`);

  return {
    cleanText: lines.join('\n'),
    fields,
    foundCount: Object.values(fields).filter(Boolean).length,
  };
}
