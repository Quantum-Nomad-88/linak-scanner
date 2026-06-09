/**
 * Decode LINAK plus-format type codes.
 * Short:  27210B+1130504A
 * Extended: 300402000D0MC26+1011AA149060E
 */

import { SPINDLE_PITCH, IP_RATINGS, FEEDBACK_TYPES } from './constants.js';
import { sanitizeTypeCode, SHORT_PLUS_RE, FLEXIBLE_PLUS_RE as EXTENDED_PLUS_RE } from './type-code.js';

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
  if (!clean.includes('+')) return null;

  const idx = clean.indexOf('+');
  const before = clean.substring(0, idx);
  const after = clean.substring(idx + 1);

  if (SHORT_PLUS_RE.test(clean)) {
    return { before, after, full: clean, format: 'short' };
  }
  if (EXTENDED_PLUS_RE.test(clean)) {
    return { before, after, full: clean, format: 'extended' };
  }

  return null;
}

export function decodePlusPrefix(before, format = 'short') {
  const b = before.toUpperCase();
  const familyDigits = b.substring(0, 2);
  const motorCode = b.length > 2 ? b[2] : null;

  const base = {
    familyDigits,
    motorCode,
    motorVariant: motorCode ? (MOTOR_VARIANT[motorCode] ?? null) : null,
    spindlePitch: motorCode ? (SPINDLE_PITCH[motorCode] ?? null) : null,
  };

  if (format === 'extended' || b.length > 8) {
    return {
      ...base,
      extendedConfig: b,
      voltage: '24 V DC',
    };
  }

  const trailingLetter = /[A-Z]$/.test(b) ? b[b.length - 1] : null;
  return {
    ...base,
    backFixture: trailingLetter,
    backFixtureDesc: trailingLetter ? (BACK_FIXTURES[trailingLetter] ?? `Fixture ${trailingLetter}`) : null,
  };
}

/**
 * Decode suffix after '+' e.g. 1130504A → stroke 305 mm
 */
export function decodePlusSuffix(suffix, minStroke, maxStroke, format = 'short') {
  const raw = suffix.toUpperCase();
  const trailingLetter = /[A-Z]$/.test(raw) ? raw[raw.length - 1] : null;
  const digits = raw.replace(/[A-Z]/g, '');

  const result = {
    feedback: trailingLetter
      ? (FEEDBACK_TYPES[trailingLetter] ?? (trailingLetter === 'A' ? 'Reed switch' : null))
      : null,
    strokeSource: null,
  };

  // Extended suffix: stroke often after letter block e.g. AA149
  if (format === 'extended') {
    const afterLetters = raw.match(/[A-Z]{1,4}(\d{3})/);
    if (afterLetters) {
      const n = parseInt(afterLetters[1], 10);
      if (n >= minStroke && n <= maxStroke) {
        result.strokeMm = n;
        result.strokeSource = 'type code (extended suffix)';
        return result;
      }
    }
  }

  const candidates = [];
  for (let i = 0; i <= digits.length - 3; i++) {
    const n = parseInt(digits.substring(i, i + 3), 10);
    if (n >= minStroke && n <= maxStroke) {
      let score = 0;
      if (format === 'short' && i === 2) score += 20;
      if (format === 'extended' && i >= 4) score += 15;
      if (n % 5 === 0) score += 5;
      if (n >= 100) score += 3;
      candidates.push({ n, score });
    }
  }

  candidates.sort((a, b) => b.score - a.score || b.n - a.n);
  if (candidates.length) {
    result.strokeMm = candidates[0].n;
    result.strokeSource = candidates[0].score >= 15
      ? 'type code suffix'
      : 'type code (estimated from suffix)';
  }

  return result;
}

export function decodePlusTypeCode(typeCode, minStroke = 50, maxStroke = 1200) {
  const parts = parsePlusTypeCode(typeCode);
  if (!parts) return null;

  const prefix = decodePlusPrefix(parts.before, parts.format);
  const suffix = decodePlusSuffix(parts.after, minStroke, maxStroke, parts.format);

  return {
    ...suffix,
    ...prefix,
    voltage: prefix.voltage || '24 V DC',
    ipRating: 'IPX6',
  };
}
