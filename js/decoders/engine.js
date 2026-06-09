import { ACTUATOR_FAMILIES, findFamilyByTypeCode } from './families.js';
import { parseLabelText } from './label-parser.js';
import { extractTypeCode, sanitizeTypeCode } from './type-code.js';
import { decodePlusTypeCode } from './plus-decode.js';
import { formatInstallFormula, fullyExtended } from './dimensions.js';

function mergeField(labelVal, decodedVal, sources, key) {
  if (labelVal) { sources.push(`${key}: label`); return labelVal; }
  if (decodedVal) { sources.push(`${key}: type code`); return decodedVal; }
  return null;
}

/**
 * Direct decode from a type code string — most reliable path for paste.
 */
export function decodeByTypeCode(typeCode) {
  const clean = sanitizeTypeCode(typeCode);
  if (!clean) return null;

  const family = findFamilyByTypeCode(clean);
  let decoded = {};

  if (family) {
    decoded = family.decodeTypeCode(clean);
  } else if (clean.includes('+')) {
    decoded = decodePlusTypeCode(clean) || {};
  }

  const strokeMm = decoded.strokeMm ?? null;
  const backFixture = decoded.backFixture ?? null;
  let installLengthMm = null;
  let fullyExtendedMm = null;
  let installFormula = null;

  if (strokeMm && family?.builtInDimension) {
    installLengthMm = family.builtInDimension(strokeMm, backFixture);
    fullyExtendedMm = fullyExtended(installLengthMm, strokeMm);
    installFormula = formatInstallFormula(strokeMm, backFixture, installLengthMm);
  }

  return {
    model: family?.id ?? (decoded.familyDigits ? `LA${decoded.familyDigits}` : null),
    typeCode: clean,
    strokeMm,
    strokeSource: decoded.strokeSource ?? null,
    installLengthMm,
    builtInMm: installLengthMm,
    fullyExtendedMm,
    installFormula,
    backFixture,
    backFixtureDesc: decoded.backFixtureDesc ?? null,
    voltage: decoded.voltage ?? null,
    ipRating: decoded.ipRating ?? null,
    spindlePitch: decoded.spindlePitch ?? null,
    feedback: decoded.feedback ?? null,
    motorVariant: decoded.motorVariant ?? null,
    brake: decoded.brake ?? null,
    confidence: clean ? (strokeMm ? 80 : 40) : 0,
    warnings: strokeMm ? [] : ['Could not decode stroke from type code. Check the code is correct.'],
    sources: ['type code direct decode'],
  };
}

/**
 * @param {string} rawText
 */
export function decodeMotorSpecs(rawText) {
  const parsed = parseLabelText(rawText);
  const warnings = [];
  const sources = [];

  const typeCode = parsed.typeCode || extractTypeCode(rawText);

  // If we have a type code, use direct decode as primary (most reliable)
  if (typeCode) {
    const direct = decodeByTypeCode(typeCode);
    if (direct) {
      // Merge label fields (load, voltage, date) on top of type-code decode
      return {
        ...direct,
        itemNo: parsed.itemNo,
        workOrder: parsed.workOrder,
        productionDate: parsed.productionDate,
        maxCurrent: parsed.maxCurrent,
        maxLoadPush: parsed.maxLoadPush ?? direct.maxLoadPush,
        maxLoadPull: parsed.maxLoadPull ?? direct.maxLoadPull,
        dutyCycle: parsed.dutyCycle,
        voltage: parsed.voltage ?? direct.voltage,
        ipRating: parsed.ipRating ?? direct.ipRating,
        confidence: Math.min(100, direct.confidence + (parsed.maxLoadPush ? 10 : 0) + (parsed.workOrder ? 10 : 0)),
        warnings: direct.warnings,
        sources: [...direct.sources, 'label text merged'],
        _parsed: parsed,
      };
    }
  }

  warnings.push('No type code found — paste the Type code or scan the label.');
  return {
    model: parsed.detectedModels[0] ?? null,
    typeCode: null,
    strokeMm: null,
    installLengthMm: null,
    fullyExtendedMm: null,
    itemNo: parsed.itemNo,
    workOrder: parsed.workOrder,
    productionDate: parsed.productionDate,
    maxLoadPush: parsed.maxLoadPush,
    maxLoadPull: parsed.maxLoadPull,
    voltage: parsed.voltage,
    maxCurrent: parsed.maxCurrent,
    dutyCycle: parsed.dutyCycle,
    ipRating: parsed.ipRating,
    confidence: 10,
    warnings,
    sources,
    _parsed: parsed,
  };
}

export { ACTUATOR_FAMILIES, getAllSupportedModels } from './families.js';
export { parseLabelText } from './label-parser.js';
