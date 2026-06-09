/**
 * Parse OCR text from LINAK actuator labels into structured fields.
 */

import { extractTypeCode, normalizeLabelInput } from './type-code.js';

const ITEM_NO_RE = /Item\s*(?:no|#)?\.?\s*:?\s*([A-Z]{0,2}[0-9]{2,4}[-–][0-9A-Z]{3,4}[-–][0-9A-Z]{2}|[0-9]{6}[-–][0-9A-Z]{2,4})/i;
const WO_RE = /W\s*\/\s*O\s*#?\s*(\d{7,8}[-–]\d{4})/i;
const DATE_RE = /(?:Prod\.?\s*)?Date\.?\s*:?\s*(\d{4}[.\-/]\d{2}[.\-/]\d{2})/i;
const MAX_LOAD_RE = /Max\s*Load\.?\s*:?\s*(.+?)(?:\n|Power\s*Rate|Duty\s*Cycle|$)/is;
const POWER_RATE_RE = /Power\s*Rate\.?\s*:?\s*(.+?)(?:\n|Duty\s*Cycle|$)/is;
const DUTY_CYCLE_RE = /Duty\s*Cycle\.?\s*:?\s*(.+?)(?:\n|W\s*\/\s*O|Made\s*in|$)/is;
const LA_MODEL_RE = /\b(LA\d{2}(?:\s*IC)?|BB3|BL4|BL1|LC2)\b/gi;
const IP_RE = /\b(IPX?\d(?:\s*Washable)?)\b/i;
const STROKE_INLINE_RE = /Stroke\s*:?\s*(\d{2,4})\s*mm/i;

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
  const v = line.match(/(\d{1,2})\s*V(?:\s*DC)?/i);
  const a = line.match(/Max\.?\s*([\d.,]+)\s*(?:Amp|A)\b/i);
  if (v) result.voltage = `${v[1]} V DC`;
  if (a) result.maxCurrent = `${a[1]} A`;
  return result;
}

function parseDutyCycle(line) {
  if (!line) return {};
  const result = { dutyCycle: line.trim() };
  const ip = line.match(IP_RE);
  if (ip) result.ipRating = ip[1].toUpperCase();
  return result;
}

function inferModelFromTypeCode(typeCode) {
  if (!typeCode) return [];
  const models = [];
  const compact = typeCode.replace(/\s/g, '').toUpperCase();
  const prefix2 = compact.substring(0, 2);

  const map = {
    '12': 'LA12', '18': 'LA18', '20': 'LA20', '22': 'LA22', '23': 'LA23',
    '25': 'LA25', '27': 'LA27', '28': 'LA28', '29': 'LA29', '30': 'LA30',
    '31': 'LA31', '32': 'LA32', '34': 'LA34', '35': 'LA35', '36': 'LA36',
    '40': 'LA40', '42': 'LA42', '43': 'LA43', '44': 'LA44',
  };

  if (map[prefix2]) models.push(map[prefix2]);
  return models;
}

/**
 * @param {string} rawText
 * @returns {import('./engine.js').ParsedLabel}
 */
export function parseLabelText(rawText) {
  const normalizedMultiline = normalizeLabelInput(rawText);

  const typeCode = extractTypeCode(normalizedMultiline);
  const itemMatch = normalizedMultiline.match(ITEM_NO_RE);
  const woMatch = normalizedMultiline.match(WO_RE);
  const dateMatch = normalizedMultiline.match(DATE_RE);
  const loadMatch = normalizedMultiline.match(MAX_LOAD_RE);
  const powerMatch = normalizedMultiline.match(POWER_RATE_RE);
  const dutyMatch = normalizedMultiline.match(DUTY_CYCLE_RE);
  const strokeInline = normalizedMultiline.match(STROKE_INLINE_RE);

  const models = [...normalizedMultiline.matchAll(LA_MODEL_RE)].map((m) => m[1].toUpperCase());
  const uniqueModels = [...new Set([...inferModelFromTypeCode(typeCode), ...models])];

  const fromLoad = parseMaxLoad(loadMatch?.[1]);
  const fromPower = parsePowerRate(powerMatch?.[1]);
  const fromDuty = parseDutyCycle(dutyMatch?.[1]);

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
    dutyCycle: fromDuty.dutyCycle ?? dutyMatch?.[1]?.trim() ?? null,
    ipRating: fromLoad.ipRating ?? fromDuty.ipRating ?? null,
    detectedModels: uniqueModels,
    strokeFromText: strokeInline ? parseInt(strokeInline[1], 10) : null,
  };
}
