/**
 * LINAK actuator family definitions and type-code decoders.
 */

import { decodePlusTypeCode, parsePlusTypeCode } from './plus-decode.js';
import { carelineBuiltIn, la36BuiltIn, la12BuiltIn } from './dimensions.js';
import { SPINDLE_PITCH, IP_RATINGS, MOTOR_VOLTAGE, FEEDBACK_TYPES } from './constants.js';
import { sanitizeTypeCode } from './type-code.js';
import { familyFromPrefix, isValidFamilyPrefix } from './motor-catalog.js';

export { SPINDLE_PITCH, IP_RATINGS, MOTOR_VOLTAGE, FEEDBACK_TYPES };

function decodeTypeCodeForFamily(typeCode, family) {
  const clean = sanitizeTypeCode(typeCode);
  const parts = splitTypeCode(clean);
  if (!parts) return {};

  if (parts.separator === '+') {
    return decodePlusTypeCode(clean, family.strokeMin ?? 50, family.strokeMax ?? 1200) || {};
  }

  const { before, after } = parts;
  let result;

  if (family.id === 'LA31') {
    result = pickBestStroke(
      after,
      [
        { strokeStart: 4, strokeLen: 3, voltageStart: 7 },
        { strokeStart: 1, strokeLen: 3, voltageStart: 4 },
      ],
      family.strokeMin,
      family.strokeMax
    );
    const motorType = before[2];
    result.motorVariant =
      { '0': '24 V DC Standard', '1': '24 V DC Basic L1', '3': '24 V DC Fast L3' }[motorType] || null;
    if (after.length > 1) {
      result.brake = { '0': 'None', '1': 'Brake push', '2': 'Brake pull' }[after[1]] || null;
    }
  } else {
    result = pickBestStroke(
      after,
      [
        { strokeStart: 1, strokeLen: 3, voltageStart: 4 },
        { strokeStart: 4, strokeLen: 3, voltageStart: 7 },
      ],
      family.strokeMin ?? 50,
      family.strokeMax ?? 1200
    );
  }

  if (result.strokeMm) result.strokeSource = 'type code after dash';
  return result;
}

/** @type {import('./engine.js').ActuatorFamily[]} */
export const ACTUATOR_FAMILIES = [
  { id: 'LA12', names: ['LA12'], typePrefixes: ['12'], strokeMin: 19, strokeMax: 130,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s) { return la12BuiltIn(s); } },
  { id: 'LA18', names: ['LA18'], typePrefixes: ['18'], strokeMin: 50, strokeMax: 300,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA20', names: ['LA20'], typePrefixes: ['20'], strokeMin: 50, strokeMax: 300,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA22', names: ['LA22'], typePrefixes: ['22'], strokeMin: 50, strokeMax: 600,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA23', names: ['LA23'], typePrefixes: ['23'], strokeMin: 100, strokeMax: 400,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA25', names: ['LA25'], typePrefixes: ['25'], strokeMin: 100, strokeMax: 600,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA27', names: ['LA27', 'LA27CS'], typePrefixes: ['27'], strokeMin: 100, strokeMax: 400,
    altPatterns: [/27\d{3}[A-Z]?\+/i],
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA28', names: ['LA28'], typePrefixes: ['28'], strokeMin: 50, strokeMax: 400,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA29', names: ['LA29'], typePrefixes: ['29'], strokeMin: 50, strokeMax: 250,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA30', names: ['LA30'], typePrefixes: ['30'], strokeMin: 100, strokeMax: 400,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA31', names: ['LA31'], typePrefixes: ['31'], strokeMin: 50, strokeMax: 350,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA32', names: ['LA32'], typePrefixes: ['32'], strokeMin: 100, strokeMax: 400,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA34', names: ['LA34'], typePrefixes: ['34'], strokeMin: 100, strokeMax: 400,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA35', names: ['LA35'], typePrefixes: ['35'], strokeMin: 100, strokeMax: 700,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA36', names: ['LA36'], typePrefixes: ['36'], strokeMin: 50, strokeMax: 1200,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s) { return la36BuiltIn(s); } },
  { id: 'LA40', names: ['LA40'], typePrefixes: ['40'], strokeMin: 100, strokeMax: 600,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA42', names: ['LA42'], typePrefixes: ['42'], strokeMin: 100, strokeMax: 400,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA43', names: ['LA43', 'LA43 IC'], typePrefixes: ['43'], strokeMin: 100, strokeMax: 400,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'LA44', names: ['LA44', 'LA44 IC'], typePrefixes: ['44'], strokeMin: 100, strokeMax: 400,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s, f) { return carelineBuiltIn(s, f); } },
  { id: 'BB3', names: ['BB3'], typePrefixes: [], altPatterns: [/BB3/i], strokeMin: 350, strokeMax: 750,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s) { return s + 250; } },
  { id: 'BL4', names: ['BL4'], typePrefixes: [], altPatterns: [/BL4/i], strokeMin: 350, strokeMax: 750,
    decodeTypeCode(tc) { return decodeTypeCodeForFamily(tc, this); },
    builtInDimension(s) { return s + 250; } },
];

export function findFamilyByTypeCode(typeCode) {
  const clean = sanitizeTypeCode(typeCode);
  const parts = splitTypeCode(clean);
  if (!parts) return null;

  const prefix2 = parts.before.substring(0, 2);
  const familyId = familyFromPrefix(prefix2);
  if (familyId && isValidFamilyPrefix(prefix2)) {
    const f = ACTUATOR_FAMILIES.find((x) => x.id === familyId);
    if (f) return f;
  }

  for (const family of ACTUATOR_FAMILIES) {
    if (family.altPatterns?.some((re) => re.test(clean))) return family;
  }

  return null;
}

export function splitTypeCode(typeCode) {
  if (!typeCode) return null;
  const cleaned = sanitizeTypeCode(typeCode);

  const plus = parsePlusTypeCode(cleaned);
  if (plus) return { ...plus, separator: '+' };

  const dash = cleaned.match(/^([A-Z0-9]{4,6})-([A-Z0-9]{6,12})$/);
  if (dash) return { before: dash[1], after: dash[2], full: cleaned, separator: '-' };

  return null;
}

function pickBestStroke(after, layouts, minStroke, maxStroke) {
  let best = {};
  let bestScore = -1;

  for (const layout of layouts) {
    const candidate = decodeStandardAfterDash(after, layout);
    if (!candidate.strokeMm) continue;
    let score = 0;
    if (candidate.strokeMm >= minStroke && candidate.strokeMm <= maxStroke) score += 10;
    if (candidate.strokeMm % 5 === 0) score += 3;
    if (candidate.voltage) score += 2;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

export function decodeStandardAfterDash(after, { strokeStart = 1, strokeLen = 3, voltageStart = 4 } = {}) {
  const result = {};

  if (after.length > 0) {
    result.spindlePitch = SPINDLE_PITCH[after[0]] || null;
  }

  if (after.length >= strokeStart + strokeLen) {
    const stroke = parseInt(after.substring(strokeStart, strokeStart + strokeLen), 10);
    if (!Number.isNaN(stroke) && stroke > 0) result.strokeMm = stroke;
  }

  if (after.length >= voltageStart + 2) {
    const vCode = after.substring(voltageStart, voltageStart + 2);
    result.voltage = MOTOR_VOLTAGE[vCode] || `${vCode} V`;
  }

  const ipPos = voltageStart + 2;
  if (after.length > ipPos) result.ipRating = IP_RATINGS[after[ipPos]] || null;
  if (after.length > ipPos + 1) result.feedback = FEEDBACK_TYPES[after[ipPos + 1]] || null;

  return result;
}

export function getAllSupportedModels() {
  return ACTUATOR_FAMILIES.map((f) => f.id).sort();
}
