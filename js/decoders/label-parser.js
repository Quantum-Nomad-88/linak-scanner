/**
 * Parse OCR text from LINAK actuator labels into structured fields.
 */

const TYPE_CODE_RE = /\b([A-Z0-9]{4,6}[-–][A-Z0-9]{6,12})\b/gi;
const ITEM_NO_RE = /Item\s*(?:no|#)?\.?\s*:?\s*([0-9]{6}[-–][0-9A-Z]{2,4})/i;
const WO_RE = /W\s*\/\s*O\s*#?\s*(\d{7}[-–]\d{4})/i;
const PROD_DATE_RE = /Prod\.?\s*Date\.?\s*:?\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})/i;
const MAX_LOAD_RE = /Max\s*Load\.?\s*:?\s*(.+?)(?:\n|Power\s*Rate|Duty\s*Cycle|$)/is;
const POWER_RATE_RE = /Power\s*Rate\.?\s*:?\s*(.+?)(?:\n|Duty\s*Cycle|$)/is;
const DUTY_CYCLE_RE = /Duty\s*Cycle\.?\s*:?\s*(.+?)(?:\n|W\s*\/\s*O|$)/is;
const LA_MODEL_RE = /\b(LA\d{2}(?:\s*IC)?|BB3|BL4|BL1|LC2)\b/gi;
const IP_RE = /\b(IPX?\d(?:\s*Washable)?)\b/i;
const VOLTAGE_INLINE_RE = /(\d{1,2})\s*V\s*DC/i;
const STROKE_INLINE_RE = /Stroke\s*:?\s*(\d{2,4})\s*mm/i;

function normalizeText(raw) {
  return raw
    .replace(/\r/g, '\n')
    .replace(/[|]/g, 'I')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\n +/g, '\n')
    .trim();
}

function findTypeCode(text) {
  const lines = text.split(/\n/);
  for (const line of lines) {
    if (/Type\.?\s*:/i.test(line)) {
      const m = line.match(/Type\.?\s*:?\s*([A-Z0-9]{4,6}-[A-Z0-9]{6,12})/i);
      if (m) return m[1].toUpperCase();
    }
  }

  const matches = [...text.matchAll(TYPE_CODE_RE)];
  if (matches.length === 0) return null;

  const scored = matches.map((m) => {
    const code = m[1].toUpperCase();
    let score = 0;
    if (/^\d{6}-\d{6,8}$/.test(code)) score += 10;
    if (/^(12|22|23|27|28|29|30|31|32|34|36|43|44)/.test(code)) score += 5;
    return { code, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0].code;
}

function parseMaxLoad(line) {
  if (!line) return {};
  const result = {};
  const push = line.match(/Push\s*([\d.,]+)\s*([Nn])/i);
  const pull = line.match(/Pull\s*([\d.,]+)\s*([Nn])/i);
  if (push) result.maxLoadPush = `${push[1]} N`;
  if (pull) result.maxLoadPull = `${pull[1]} N`;
  const ip = line.match(IP_RE);
  if (ip) result.ipRating = ip[1].toUpperCase();
  return result;
}

function parsePowerRate(line) {
  if (!line) return {};
  const result = {};
  const v = line.match(/(\d{1,2})\s*V\s*DC/i);
  const a = line.match(/Max\.?\s*([\d.,]+)\s*Amp/i);
  if (v) result.voltage = `${v[1]} V DC`;
  if (a) result.maxCurrent = `${a[1]} A`;
  return result;
}

/**
 * @param {string} rawText
 * @returns {import('./engine.js').ParsedLabel}
 */
export function parseLabelText(rawText) {
  const text = normalizeText(rawText);
  const normalizedMultiline = rawText.replace(/\r/g, '\n');

  const typeCode = findTypeCode(normalizedMultiline);
  const itemMatch = normalizedMultiline.match(ITEM_NO_RE);
  const woMatch = normalizedMultiline.match(WO_RE);
  const dateMatch = normalizedMultiline.match(PROD_DATE_RE);
  const loadMatch = normalizedMultiline.match(MAX_LOAD_RE);
  const powerMatch = normalizedMultiline.match(POWER_RATE_RE);
  const dutyMatch = normalizedMultiline.match(DUTY_CYCLE_RE);
  const strokeInline = normalizedMultiline.match(STROKE_INLINE_RE);

  const models = [...normalizedMultiline.matchAll(LA_MODEL_RE)].map((m) => m[1].toUpperCase());
  const uniqueModels = [...new Set(models)];

  const fromLoad = parseMaxLoad(loadMatch?.[1]);
  const fromPower = parsePowerRate(powerMatch?.[1]);

  return {
    rawText: normalizedMultiline,
    typeCode,
    itemNo: itemMatch?.[1]?.toUpperCase() ?? null,
    workOrder: woMatch?.[1] ?? null,
    productionDate: dateMatch?.[1] ?? null,
    maxLoadLine: loadMatch?.[1]?.trim() ?? null,
    maxLoadPush: fromLoad.maxLoadPush ?? null,
    maxLoadPull: fromLoad.maxLoadPull ?? null,
    powerRateLine: powerMatch?.[1]?.trim() ?? null,
    voltage: fromPower.voltage ?? null,
    maxCurrent: fromPower.maxCurrent ?? null,
    dutyCycle: dutyMatch?.[1]?.trim() ?? null,
    ipRating: fromLoad.ipRating ?? null,
    detectedModels: uniqueModels,
    strokeFromText: strokeInline ? parseInt(strokeInline[1], 10) : null,
  };
}
