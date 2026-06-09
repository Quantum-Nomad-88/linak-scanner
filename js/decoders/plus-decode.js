/**
 * Decode LINAK plus-format type codes e.g. 27210B+1130504A
 * Used on Careline/Medline labels.
 */

import { SPINDLE_PITCH, IP_RATINGS, FEEDBACK_TYPES } from './constants.js';

const BACK_FIXTURES = {
  '0': 'Standard with slot, quick-release',
  '1': 'Standard solid',
  '2': 'Standard painted',
  '3': 'Standard gold chromed',
  '5': 'Flexible back fixture',
  '6': 'Flexible back fixture',
  '7': 'Solid',
  '8': 'Solid',
  A: 'Standard with 12 mm slot',
  B: 'Standard with 12 mm slot',
  a: 'Standard with 12 mm slot',
  b: 'Standard with 12 mm slot',
};

const MOTOR_VARIANT = {
  '0': '24 V DC Standard',
  '1': '24 V DC Basic',
  '2': '24 V DC',
  '3': '24 V DC Fast',
};

/**
 * Decode prefix before '+' e.g. 27210B
 */
export function decodePlusPrefix(before) {
  const b = before.toUpperCase();
  const familyDigits = b.substring(0, 2);
  const motorCode = b.length > 2 ? b[2] : null;
  const trailingLetter = b.match(/[A-Z]$/) ? b[b.length - 1] : null;
  const mid = b.substring(3, trailingLetter ? b.length - 1 : b.length);

  return {
    familyDigits,
    motorCode,
    motorVariant: motorCode ? (MOTOR_VARIANT[motorCode] ?? null) : null,
    spindlePitch: motorCode ? (SPINDLE_PITCH[motorCode] ?? null) : null,
    backFixture: trailingLetter,
    backFixtureDesc: trailingLetter ? (BACK_FIXTURES[trailingLetter] ?? `Fixture ${trailingLetter}`) : null,
    optionsCode: mid || null,
  };
}

/**
 * Decode suffix after '+' e.g. 1130504A
 * Careline suffix layout: [1][opt][STROKE 3 digits][config][letter]
 */
export function decodePlusSuffix(suffix, minStroke, maxStroke) {
  const raw = suffix.toUpperCase();
  const trailingLetter = raw.match(/[A-Z]$/) ? raw[raw.length - 1] : null;
  const digits = raw.replace(/[A-Z]/g, '');

  const result = {
    feedback: trailingLetter ? (FEEDBACK_TYPES[trailingLetter] ?? (trailingLetter === 'A' ? 'Reed switch' : null)) : null,
    strokeSource: null,
  };

  // Primary: stroke at positions 3-5 (index 2-4) in digit string — e.g. 1130504 → 305
  if (digits.length >= 5) {
    const stroke = parseInt(digits.substring(2, 5), 10);
    if (stroke >= minStroke && stroke <= maxStroke) {
      result.strokeMm = stroke;
      result.strokeSource = 'type code digits 3–5 after +';
      return result;
    }
  }

  // Fallback: find best 3-digit stroke in suffix
  const matches = [...digits.matchAll(/\d{3}/g)];
  let best = null;
  let bestScore = -1;

  for (const m of matches) {
    const n = parseInt(m[1], 10);
    if (n < minStroke || n > maxStroke) continue;
    let score = 0;
    if (n % 5 === 0) score += 5;
    if (m.index === 2) score += 10;
    if (score > bestScore) {
      bestScore = score;
      best = n;
    }
  }

  if (best) {
    result.strokeMm = best;
    result.strokeSource = 'type code suffix (estimated)';
  }

  return result;
}

/**
 * Full plus-format decode
 */
export function decodePlusTypeCode(typeCode, minStroke, maxStroke) {
  const parts = typeCode.toUpperCase().match(/^(\d{5}[A-Z0-9]?)\+(\d{6,9}[A-Z]?)$/);
  if (!parts) return null;

  const prefix = decodePlusPrefix(parts[1]);
  const suffix = decodePlusSuffix(parts[2], minStroke, maxStroke);

  return {
    ...suffix,
    ...prefix,
    voltage: '24 V DC',
    ipRating: IP_RATINGS['5'] || 'IPX6',
  };
}
