/**
 * Decode LINAK plus-format type codes e.g. 27210B+1130504A
 */

import { SPINDLE_PITCH, IP_RATINGS, FEEDBACK_TYPES } from './constants.js';
import { sanitizeTypeCode } from './type-code.js';

const BACK_FIXTURES = {
  A: 'Standard with 12 mm slot',
  B: 'Standard with 12 mm slot',
  a: 'Standard with 12 mm slot',
  b: 'Standard with 12 mm slot',
  '5': 'Flexible back fixture',
  '6': 'Flexible back fixture',
};

const MOTOR_VARIANT = {
  '0': '24 V DC Standard',
  '1': '24 V DC Basic',
  '2': '24 V DC',
  '3': '24 V DC Fast',
};

export function parsePlusTypeCode(typeCode) {
  const clean = sanitizeTypeCode(typeCode);
  const m = clean.match(/^(\d{5}[A-Z0-9]?)\+(\d{6,}[A-Z0-9]*)$/);
  if (!m) return null;
  return { before: m[1], after: m[2], full: clean };
}

export function decodePlusPrefix(before) {
  const b = before.toUpperCase();
  const trailingLetter = /[A-Z]$/.test(b) ? b[b.length - 1] : null;
  const motorCode = b.length > 2 ? b[2] : null;

  return {
    familyDigits: b.substring(0, 2),
    motorCode,
    motorVariant: motorCode ? (MOTOR_VARIANT[motorCode] ?? null) : null,
    spindlePitch: motorCode ? (SPINDLE_PITCH[motorCode] ?? null) : null,
    backFixture: trailingLetter,
    backFixtureDesc: trailingLetter ? (BACK_FIXTURES[trailingLetter] ?? `Fixture ${trailingLetter}`) : null,
  };
}

/**
 * Decode suffix after '+' e.g. 1130504A → stroke 305 mm
 */
export function decodePlusSuffix(suffix, minStroke, maxStroke) {
  const raw = suffix.toUpperCase();
  const trailingLetter = /[A-Z]$/.test(raw) ? raw[raw.length - 1] : null;
  const digits = raw.replace(/[A-Z]/g, '');

  const result = {
    feedback: trailingLetter
      ? (FEEDBACK_TYPES[trailingLetter] ?? (trailingLetter === 'A' ? 'Reed switch' : null))
      : null,
    strokeSource: null,
  };

  // Try stroke at every 3-digit window, prefer position 2-4 (LINAK Careline layout)
  const candidates = [];
  for (let i = 0; i <= digits.length - 3; i++) {
    const n = parseInt(digits.substring(i, i + 3), 10);
    if (n >= minStroke && n <= maxStroke) {
      let score = 0;
      if (i === 2) score += 20;
      if (n % 5 === 0) score += 5;
      candidates.push({ n, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length) {
    result.strokeMm = candidates[0].n;
    result.strokeSource = candidates[0].score >= 20
      ? 'type code (digits 3–5 after +)'
      : 'type code suffix';
  }

  return result;
}

export function decodePlusTypeCode(typeCode, minStroke = 50, maxStroke = 1200) {
  const parts = parsePlusTypeCode(typeCode);
  if (!parts) return null;

  const prefix = decodePlusPrefix(parts.before);
  const suffix = decodePlusSuffix(parts.after, minStroke, maxStroke);

  return {
    ...suffix,
    ...prefix,
    voltage: '24 V DC',
    ipRating: 'IPX6',
  };
}
