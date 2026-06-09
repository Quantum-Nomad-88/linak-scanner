/**
 * LINAK actuator family definitions and type-code decoders.
 * Based on public LINAK ordering code structures from user manuals / data sheets.
 */

export const SPINDLE_PITCH = {
  '1': '2 mm',
  '2': '4 mm',
  '3': '6 mm',
  '4': '4 mm',
  '5': '5 mm',
  '6': '12 mm',
  '7': '6 mm',
  '8': '8 mm',
  '9': '9 mm',
};

export const IP_RATINGS = {
  '0': 'IPX1',
  '1': 'IPX4',
  '2': 'IP66',
  '3': 'IPX4',
  '4': 'IP54',
  '5': 'IPX6',
  '6': 'IPX6 Washable',
};

export const MOTOR_VOLTAGE = {
  '12': '12 V DC',
  '24': '24 V DC',
  '36': '36 V DC',
};

export const FEEDBACK_TYPES = {
  '0': 'None',
  B: 'Analogue 0–10 V',
  C: 'Analogue 0.5–4.5 V',
  E: 'Reed switch (10 pulses/rev)',
  M: 'Reed switch (4 pulses/rev)',
  P: 'Potentiometer',
  R: 'Reed switch (4 pulses/rev)',
  S: 'Single Hall',
  F: 'Analogue 0–10 V',
  K: 'Analogue 0.5–4.5 V',
  L: 'Hall (2 pulses/rev)',
  N: 'Hall (4 pulses/rev)',
  T: 'Potentiometer 0–10 V',
  D: 'None (no EOS out)',
};

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
      const after = splitTypeCode(typeCode)?.after;
      if (!after || after.length < 6) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
    builtInDimension(stroke) {
      return stroke <= 115 ? 288 : stroke + 173;
    },
  },
  {
    id: 'LA20',
    names: ['LA20'],
    typePrefixes: ['20'],
    strokeMin: 50,
    strokeMax: 300,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after || after.length < 6) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA22',
    names: ['LA22', 'LA20'],
    typePrefixes: ['22'],
    altPatterns: [/22[Ee]\d{3}-\d{8}/],
    strokeMin: 50,
    strokeMax: 600,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after || after.length < 6) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA23',
    names: ['LA23'],
    typePrefixes: ['23'],
    strokeMin: 100,
    strokeMax: 400,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after || after.length < 6) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA25',
    names: ['LA25'],
    typePrefixes: ['25'],
    strokeMin: 100,
    strokeMax: 600,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA27',
    names: ['LA27', 'LA27CS'],
    typePrefixes: ['27'],
    strokeMin: 100,
    strokeMax: 400,
    decodeTypeCode(typeCode) {
      const parts = splitTypeCode(typeCode);
      if (!parts) return {};

      if (parts.separator === '+') {
        const stroke = extractStrokeFromSuffix(parts.after, 100, 400);
        return {
          strokeMm: stroke,
          voltage: '24 V DC',
          ipRating: 'IPX6',
          feedback: parts.after.endsWith('A') ? 'Reed switch' : null,
        };
      }

      return decodeStandardAfterDash(parts.after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA28',
    names: ['LA28'],
    typePrefixes: ['28'],
    altPatterns: [/282\d{3}-\d{8}/],
    strokeMin: 50,
    strokeMax: 400,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA29',
    names: ['LA29'],
    typePrefixes: ['29'],
    strokeMin: 50,
    strokeMax: 250,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA30',
    names: ['LA30'],
    typePrefixes: ['30'],
    strokeMin: 100,
    strokeMax: 400,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
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
      const parts = splitTypeCode(typeCode);
      if (!parts) return {};
      const { before, after } = parts;
      const result = pickBestStroke(after, [
        { strokeStart: 4, strokeLen: 3, voltageStart: 7 },
        { strokeStart: 1, strokeLen: 3, voltageStart: 4 },
        { strokeStart: 5, strokeLen: 3, voltageStart: 8 },
      ], 50, 350);

      const motorType = before[2];
      result.motorVariant = { '0': '24 V DC Standard', '1': '24 V DC Basic L1', '3': '24 V DC Fast L3' }[motorType] || null;

      if (after.length > 1) {
        const brake = after[1];
        result.brake = { '0': 'None', '1': 'Brake push', '2': 'Brake pull' }[brake] || null;
      }

      return result;
    },
    builtInDimension(stroke, backFixture = '5') {
      if (stroke <= 115) return 288;
      const offset = ['A', 'B', 'a', 'b'].includes(backFixture) ? 195 : 173;
      if (stroke <= 300) return stroke + offset;
      return stroke + (['A', 'B', 'a', 'b'].includes(backFixture) ? 215 : 212);
    },
  },
  {
    id: 'LA32',
    names: ['LA32'],
    typePrefixes: ['32'],
    strokeMin: 100,
    strokeMax: 400,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
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
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
    builtInDimension(stroke) {
      return stroke <= 115 ? 288 : stroke + 173;
    },
  },
  {
    id: 'LA35',
    names: ['LA35'],
    typePrefixes: ['35'],
    strokeMin: 100,
    strokeMax: 700,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA36',
    names: ['LA36'],
    typePrefixes: ['36'],
    strokeMin: 50,
    strokeMax: 1200,
    strokeStep: 50,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
    builtInDimension(stroke) {
      if (stroke < 300) return Math.max(300, 200 + stroke);
      return 250 + stroke;
    },
  },
  {
    id: 'LA40',
    names: ['LA40'],
    typePrefixes: ['40'],
    strokeMin: 100,
    strokeMax: 600,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA42',
    names: ['LA42'],
    typePrefixes: ['42'],
    strokeMin: 100,
    strokeMax: 400,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA43',
    names: ['LA43', 'LA43 IC'],
    typePrefixes: ['43'],
    strokeMin: 100,
    strokeMax: 400,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
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
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
    builtInDimension(stroke) {
      return stroke <= 115 ? 288 : stroke + 173;
    },
  },
  {
    id: 'BB3',
    names: ['BB3'],
    typePrefixes: [],
    altPatterns: [/BB3/i],
    strokeMin: 350,
    strokeMax: 750,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'BL4',
    names: ['BL4'],
    typePrefixes: [],
    altPatterns: [/BL4/i],
    strokeMin: 350,
    strokeMax: 750,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
  {
    id: 'LA18',
    names: ['LA18'],
    typePrefixes: ['18'],
    strokeMin: 50,
    strokeMax: 300,
    decodeTypeCode(typeCode) {
      const after = splitTypeCode(typeCode)?.after;
      if (!after) return {};
      return decodeStandardAfterDash(after, { strokeStart: 1, strokeLen: 3, voltageStart: 4 });
    },
  },
];

export function splitTypeCode(typeCode) {
  if (!typeCode) return null;
  const cleaned = typeCode.replace(/\s/g, '').toUpperCase();

  const dash = cleaned.match(/^([A-Z0-9]{4,6})-([A-Z0-9]{6,12})$/);
  if (dash) return { before: dash[1], after: dash[2], full: cleaned, separator: '-' };

  const plus = cleaned.match(/^([A-Z0-9]{5,7})\+([A-Z0-9]{6,10}[A-Z]?)$/);
  if (plus) return { before: plus[1], after: plus[2], full: cleaned, separator: '+' };

  return null;
}

/** Extract stroke from plus-format suffix e.g. 1130504A → 305 mm */
function extractStrokeFromSuffix(suffix, minStroke, maxStroke) {
  const matches = [...suffix.matchAll(/\d{3}/g)];
  let best = null;

  for (const m of matches) {
    const n = parseInt(m[1], 10);
    if (n >= minStroke && n <= maxStroke) {
      if (!best || n % 5 === 0) best = n;
    }
  }

  return best;
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
      best = candidate;
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
