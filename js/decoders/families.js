/**
 * LINAK actuator family definitions and type-code decoders.
 * Based on public LINAK ordering code structures from user manuals / data sheets.
 */

import { decodePlusTypeCode } from './plus-decode.js';
import { carelineBuiltIn, la36BuiltIn, la12BuiltIn } from './dimensions.js';
import { SPINDLE_PITCH, IP_RATINGS, MOTOR_VOLTAGE, FEEDBACK_TYPES } from './constants.js';

export { SPINDLE_PITCH, IP_RATINGS, MOTOR_VOLTAGE, FEEDBACK_TYPES };

/**
 * Unified type-code decoder for dash (+) and plus formats.
 */
function decodeTypeCodeForFamily(typeCode, family) {
  const parts = splitTypeCode(typeCode);
  if (!parts) return {};

  if (parts.separator === '+') {
    const decoded = decodePlusTypeCode(
      typeCode,
      family.strokeMin ?? 50,
      family.strokeMax ?? 1200
    );
    return decoded || {};
  }

  const { before, after } = parts;
  let result;

  if (family.id === 'LA31') {
    result = pickBestStroke(
      after,
      [
        { strokeStart: 4, strokeLen: 3, voltageStart: 7 },
        { strokeStart: 1, strokeLen: 3, voltageStart: 4 },
        { strokeStart: 5, strokeLen: 3, voltageStart: 8 },
      ],
      family.strokeMin,
      family.strokeMax
    );
    const motorType = before[2];
    result.motorVariant =
      { '0': '24 V DC Standard', '1': '24 V DC Basic L1', '3': '24 V DC Fast L3' }[motorType] ||
      result.motorVariant;
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

  if (result.strokeMm && !result.strokeSource) {
    result.strokeSource = 'type code after dash';
  }

  return result;
}

/** @type {import('./engine.js').ActuatorFamily[]} */
export const ACTUATOR_FAMILIES = [
  {
    id: 'LA12',
    names: ['LA12'],
    typePrefixes: ['12'],
    strokeMin: 19,
    strokeMax: 130,
    strokeStep: 1,
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
    builtInDimension(stroke) {
      return la12BuiltIn(stroke);
    },
  },
  {
    id: 'LA20',
    names: ['LA20'],
    typePrefixes: ['20'],
    strokeMin: 50,
    strokeMax: 300,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA22',
    names: ['LA22', 'LA20'],
    typePrefixes: ['22'],
    altPatterns: [/22[Ee]\d{3}-\d{8}/],
    strokeMin: 50,
    strokeMax: 600,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA23',
    names: ['LA23'],
    typePrefixes: ['23'],
    strokeMin: 100,
    strokeMax: 400,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA25',
    names: ['LA25'],
    typePrefixes: ['25'],
    strokeMin: 100,
    strokeMax: 600,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA27',
    names: ['LA27', 'LA27CS'],
    typePrefixes: ['27'],
    altPatterns: [/27\d{3}[A-Z]?\+\d{6,}/i],
    strokeMin: 100,
    strokeMax: 400,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA28',
    names: ['LA28'],
    typePrefixes: ['28'],
    altPatterns: [/282\d{3}-\d{8}/],
    strokeMin: 50,
    strokeMax: 400,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA29',
    names: ['LA29'],
    typePrefixes: ['29'],
    strokeMin: 50,
    strokeMax: 250,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA30',
    names: ['LA30'],
    typePrefixes: ['30'],
    strokeMin: 100,
    strokeMax: 400,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA31',
    names: ['LA31'],
    typePrefixes: ['31'],
    strokeMin: 50,
    strokeMax: 350,
    strokeStep: 5,
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
    builtInDimension(stroke, backFixture) {
      return carelineBuiltIn(stroke, backFixture);
    },
  },
  {
    id: 'LA32',
    names: ['LA32'],
    typePrefixes: ['32'],
    strokeMin: 100,
    strokeMax: 400,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA34',
    names: ['LA34'],
    typePrefixes: ['34'],
    strokeMin: 100,
    strokeMax: 400,
    strokeStep: 5,
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
  },
  {
    id: 'LA35',
    names: ['LA35'],
    typePrefixes: ['35'],
    strokeMin: 100,
    strokeMax: 700,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA36',
    names: ['LA36'],
    typePrefixes: ['36'],
    strokeMin: 50,
    strokeMax: 1200,
    strokeStep: 50,
    builtInDimension(stroke) {
      return la36BuiltIn(stroke);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA40',
    names: ['LA40'],
    typePrefixes: ['40'],
    strokeMin: 100,
    strokeMax: 600,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA42',
    names: ['LA42'],
    typePrefixes: ['42'],
    strokeMin: 100,
    strokeMax: 400,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA43',
    names: ['LA43', 'LA43 IC'],
    typePrefixes: ['43'],
    strokeMin: 100,
    strokeMax: 400,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA44',
    names: ['LA44', 'LA44 IC'],
    typePrefixes: ['44'],
    strokeMin: 100,
    strokeMax: 400,
    strokeStep: 5,
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
  },
  {
    id: 'BB3',
    names: ['BB3'],
    typePrefixes: [],
    altPatterns: [/BB3/i],
    strokeMin: 350,
    strokeMax: 750,
    builtInDimension(stroke) {
      return stroke + 250;
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'BL4',
    names: ['BL4'],
    typePrefixes: [],
    altPatterns: [/BL4/i],
    strokeMin: 350,
    strokeMax: 750,
    builtInDimension(stroke) {
      return stroke + 250;
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
  {
    id: 'LA18',
    names: ['LA18'],
    typePrefixes: ['18'],
    strokeMin: 50,
    strokeMax: 300,
    builtInDimension(stroke, fixture) {
      return carelineBuiltIn(stroke, fixture);
    },
    decodeTypeCode(typeCode) {
      return decodeTypeCodeForFamily(typeCode, this);
    },
  },
];

export function splitTypeCode(typeCode) {
  if (!typeCode) return null;
  const cleaned = typeCode.replace(/\s/g, '').toUpperCase();

  const dash = cleaned.match(/^([A-Z0-9]{4,6})-([A-Z0-9]{6,12})$/);
  if (dash) return { before: dash[1], after: dash[2], full: cleaned, separator: '-' };

  const plus = cleaned.match(/^(\d{5}[A-Z0-9]?)\+(\d{6,9}[A-Z]?)$/);
  if (plus) return { before: plus[1], after: plus[2], full: cleaned, separator: '+' };

  return null;
}

/**
 * Standard Techline after-dash decode: [spindle][stroke 3][voltage 2][ip][...]
 */
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
      best = { ...candidate, strokeSource: 'type code after dash' };
    }
  }

  return best;
}

export function decodeStandardAfterDash(after, { strokeStart = 1, strokeLen = 3, voltageStart = 4 } = {}) {
  const result = {};

  if (after.length > 0) {
    const spindle = after[0];
    result.spindlePitch = SPINDLE_PITCH[spindle] || null;
  }

  if (after.length >= strokeStart + strokeLen) {
    const strokeStr = after.substring(strokeStart, strokeStart + strokeLen);
    const stroke = parseInt(strokeStr, 10);
    if (!Number.isNaN(stroke) && stroke > 0) {
      result.strokeMm = stroke;
    }
  }

  if (after.length >= voltageStart + 2) {
    const vCode = after.substring(voltageStart, voltageStart + 2);
    result.voltage = MOTOR_VOLTAGE[vCode] || `${vCode} V`;
  }

  const ipPos = voltageStart + 2;
  if (after.length > ipPos) {
    result.ipRating = IP_RATINGS[after[ipPos]] || null;
  }

  if (after.length > ipPos + 1) {
    const fb = after[ipPos + 1];
    result.feedback = FEEDBACK_TYPES[fb] || null;
  }

  return result;
}

export function getAllSupportedModels() {
  return ACTUATOR_FAMILIES.map((f) => f.id).sort();
}
