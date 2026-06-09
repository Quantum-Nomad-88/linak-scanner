import { ACTUATOR_FAMILIES, splitTypeCode } from './families.js';
import { parseLabelText } from './label-parser.js';
import { formatInstallFormula, fullyExtended } from './dimensions.js';

/**
 * @typedef {Object} ParsedLabel
 * @property {string} rawText
 * @property {string|null} typeCode
 * @property {string|null} itemNo
 * @property {string|null} workOrder
 * @property {string|null} productionDate
 * @property {string|null} maxLoadLine
 * @property {string|null} maxLoadPush
 * @property {string|null} maxLoadPull
 * @property {string|null} powerRateLine
 * @property {string|null} voltage
 * @property {string|null} maxCurrent
 * @property {string|null} dutyCycle
 * @property {string|null} ipRating
 * @property {string[]} detectedModels
 * @property {number|null} strokeFromText
 */

/**
 * @typedef {Object} MotorSpecs
 * @property {string|null} model
 * @property {string|null} typeCode
 * @property {string|null} itemNo
 * @property {string|null} workOrder
 * @property {string|null} productionDate
 * @property {number|null} strokeMm
 * @property {string|null} strokeSource
 * @property {number|null} installLengthMm
 * @property {number|null} builtInMm
 * @property {number|null} fullyExtendedMm
 * @property {string|null} installFormula
 * @property {string|null} backFixture
 * @property {string|null} backFixtureDesc
 * @property {string|null} voltage
 * @property {string|null} maxCurrent
 * @property {string|null} maxLoadPush
 * @property {string|null} maxLoadPull
 * @property {string|null} dutyCycle
 * @property {string|null} ipRating
 * @property {string|null} spindlePitch
 * @property {string|null} feedback
 * @property {string|null} motorVariant
 * @property {string|null} brake
 * @property {number} confidence
 * @property {string[]} warnings
 * @property {string[]} sources
 */

function detectFamily(parsed, typeCode) {
  for (const model of parsed.detectedModels) {
    const family = ACTUATOR_FAMILIES.find((f) =>
      f.names.some((n) => n.toUpperCase() === model.toUpperCase())
    );
    if (family) return family;
  }

  if (typeCode) {
    const parts = splitTypeCode(typeCode);
    if (parts) {
      const prefix2 = parts.before.substring(0, 2);
      const byPrefix = ACTUATOR_FAMILIES.find((f) =>
        f.typePrefixes?.some((p) => parts.before.startsWith(p) || prefix2 === p)
      );
      if (byPrefix) return byPrefix;

      for (const family of ACTUATOR_FAMILIES) {
        if (family.altPatterns?.some((re) => re.test(typeCode))) {
          return family;
        }
      }
    }
  }

  return null;
}

function mergeField(labelVal, decodedVal, sources, key) {
  if (labelVal) {
    sources.push(`${key}: label`);
    return labelVal;
  }
  if (decodedVal) {
    sources.push(`${key}: type code`);
    return decodedVal;
  }
  return null;
}

/**
 * @param {string} rawText
 * @returns {MotorSpecs}
 */
export function decodeMotorSpecs(rawText) {
  const parsed = parseLabelText(rawText);
  const warnings = [];
  const sources = [];

  const family = detectFamily(parsed, parsed.typeCode);
  let decoded = {};

  if (family && parsed.typeCode) {
    decoded = family.decodeTypeCode(parsed.typeCode);
    sources.push(`model: ${family.id} (type code)`);
  } else if (family) {
    sources.push(`model: ${family.id} (label text)`);
  } else if (parsed.typeCode) {
    warnings.push('Could not identify actuator family — showing label fields only.');
  } else {
    warnings.push('No type code found — enter or correct the type code manually.');
  }

  let strokeMm = parsed.strokeFromText ?? decoded.strokeMm ?? null;
  const strokeSource = decoded.strokeSource ?? (parsed.strokeFromText ? 'label text' : null);
  const backFixture = decoded.backFixture ?? null;

  if (strokeMm && family) {
    if (family.strokeMin && strokeMm < family.strokeMin) {
      warnings.push(`Stroke ${strokeMm} mm is below typical minimum for ${family.id} (${family.strokeMin} mm).`);
    }
    if (family.strokeMax && strokeMm > family.strokeMax) {
      warnings.push(`Stroke ${strokeMm} mm exceeds typical maximum for ${family.id} (${family.strokeMax} mm).`);
    }
  }

  const voltage = mergeField(parsed.voltage, decoded.voltage, sources, 'voltage');
  const ipRating = mergeField(parsed.ipRating, decoded.ipRating, sources, 'ip');

  let installLengthMm = null;
  let fullyExtendedMm = null;
  let installFormula = null;

  if (strokeMm && family?.builtInDimension) {
    installLengthMm = family.builtInDimension(strokeMm, backFixture);
    fullyExtendedMm = fullyExtended(installLengthMm, strokeMm);
    installFormula = formatInstallFormula(strokeMm, backFixture, installLengthMm);
    sources.push('install length: calculated from type code');
  }

  if (strokeMm && !strokeSource) {
    sources.push('stroke: type code');
  } else if (strokeMm && strokeSource) {
    sources.push(`stroke: ${strokeSource}`);
  }

  let confidence = 0;
  if (parsed.typeCode) confidence += 25;
  if (family) confidence += 20;
  if (strokeMm) confidence += 20;
  if (installLengthMm) confidence += 15;
  if (parsed.maxLoadPush || parsed.maxLoadPull) confidence += 10;
  if (parsed.voltage) confidence += 5;
  if (parsed.workOrder) confidence += 5;

  return {
    model: family?.id ?? parsed.detectedModels[0] ?? null,
    typeCode: parsed.typeCode,
    itemNo: parsed.itemNo,
    workOrder: parsed.workOrder,
    productionDate: parsed.productionDate,
    strokeMm,
    strokeSource,
    installLengthMm,
    builtInMm: installLengthMm,
    fullyExtendedMm,
    installFormula,
    backFixture,
    backFixtureDesc: decoded.backFixtureDesc ?? null,
    voltage,
    maxCurrent: parsed.maxCurrent,
    maxLoadPush: parsed.maxLoadPush,
    maxLoadPull: parsed.maxLoadPull,
    dutyCycle: parsed.dutyCycle,
    ipRating,
    spindlePitch: decoded.spindlePitch ?? null,
    feedback: decoded.feedback ?? null,
    motorVariant: decoded.motorVariant ?? null,
    brake: decoded.brake ?? null,
    confidence: Math.min(100, confidence),
    warnings,
    sources,
    _parsed: parsed,
    _family: family?.id ?? null,
  };
}

export function decodeFromTypeCode(typeCode, modelHint) {
  const synthetic = modelHint ? `Type: ${typeCode}\n${modelHint}` : `Type: ${typeCode}`;
  return decodeMotorSpecs(synthetic);
}

export { ACTUATOR_FAMILIES, getAllSupportedModels } from './families.js';
export { parseLabelText } from './label-parser.js';
