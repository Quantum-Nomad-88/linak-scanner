/**
 * Shared type-code normalization and extraction for LINAK labels.
 */

/** Strip to valid type-code characters only */
export function sanitizeTypeCode(raw) {
  return (raw || '')
    .toUpperCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\uFF0B/g, '+')
    .replace(/[:]/g, '+') // OCR often reads + as :
    .replace(/\s*\+\s*/g, '+')
    .replace(/[^A-Z0-9+\-]/g, '')
    .trim();
}

export function normalizeLabelInput(raw) {
  return (raw || '')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\uFF0B/g, '+')
    .replace(/\s*\+\s*/g, '+')
    .trim();
}

export const PLUS_TYPE_RE = /(\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*)/gi;
export const DASH_TYPE_RE = /(\d{6}-\d{6,8}[A-Z0-9]*)/gi;

/** Known Careline suffix patterns (LA27 backrest etc.) */
const KNOWN_SUFFIXES = [
  /^1130\d{3}A?$/,
  /^113\d{4}A?$/,
  /^1[13]\d{5}A?$/,
];

function isKnownPlusSuffix(s) {
  const clean = s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return KNOWN_SUFFIXES.some((re) => re.test(clean));
}

/**
 * Repair OCR-damaged prefix when suffix is known.
 * e.g. 72108 + 1130504A → 27210B+1130504A
 */
export function repairPlusTypeCode(prefix, suffix) {
  let p = (prefix || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  let s = (suffix || '').replace(/^[:+]/, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!p || !s) return null;

  const la27Like = isKnownPlusSuffix(s) || s.startsWith('113');

  if (la27Like) {
    // Trailing 8 → B (fixture letter OCR error)
    if (p.endsWith('8')) p = p.slice(0, -1) + 'B';

    // Missing leading 2: 7210B → 27210B
    if (p.length >= 5 && p[0] === '7' && !p.startsWith('27')) {
      p = '2' + p;
    }

    // 272108 → 27210B (8 at end should be B)
    if (p.endsWith('8') && p.startsWith('27')) {
      p = p.slice(0, -1) + 'B';
    }

    // Ensure 6-char prefix with fixture letter for LA27
    if (p.startsWith('27') && p.length === 5 && /^\d+$/.test(p)) {
      p += 'B';
    }
  }

  const combined = `${p}+${s}`;
  if (isValidTypeCode(combined)) return combined;

  // Looser check
  if (/^\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*$/.test(combined)) return combined;

  return null;
}

export function isValidTypeCode(code) {
  if (!code) return false;
  const c = sanitizeTypeCode(code);
  return /^\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*$/.test(c) || /^\d{6}-\d{6,8}[A-Z0-9]*$/.test(c);
}

/**
 * Find type code split across OCR columns: "72108:+1130504A"
 */
function extractSplitTypeCode(text) {
  const compact = text.replace(/\s/g, '').toUpperCase();

  // Explicit split with : or +
  const split = compact.match(/(\d{4,6})[:+]+(\d{6,}[A-Z0-9]*)/);
  if (split) {
    const repaired = repairPlusTypeCode(split[1], split[2]);
    if (repaired) return repaired;
  }

  // Prefix and suffix on separate lines
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    const left = lines[i].replace(/^Type:?\s*/i, '').replace(/[^A-Z0-9]/gi, '');
    const right = lines[i + 1].replace(/^[:+]/, '').replace(/[^A-Z0-9]/gi, '');
    if (/^\d{4,6}$/.test(left) && /^\d{6,}/.test(right)) {
      const repaired = repairPlusTypeCode(left, right);
      if (repaired) return repaired;
    }
  }

  return null;
}

export function extractTypeCode(text) {
  const normalized = normalizeLabelInput(text);
  if (!normalized) return null;

  const compact = sanitizeTypeCode(normalized);

  if (isValidTypeCode(compact)) return compact;

  // Repair split OCR e.g. 72108:+1130504A
  const split = extractSplitTypeCode(normalized) || extractSplitTypeCode(compact);
  if (split) return split;

  const typeLine = normalized.match(/Type\.?\s*:?\s*(\S+)/i);
  if (typeLine) {
    let candidate = sanitizeTypeCode(typeLine[1]);
    if (isValidTypeCode(candidate)) return candidate;
    // Type line might be partial — try repair with next token
    const rest = normalized.match(/Type\.?\s*:?\s*\S+\s+(\d{6,}[A-Z0-9]*)/i);
    if (rest) {
      const prefix = typeLine[1].replace(/[^A-Z0-9]/gi, '');
      const repaired = repairPlusTypeCode(prefix, rest[1]);
      if (repaired) return repaired;
    }
  }

  const spaceJoin = compact.match(/^(\d{4,6}[A-Z0-9]?)(\d{6,}[A-Z0-9]*)$/);
  if (spaceJoin) {
    const repaired = repairPlusTypeCode(spaceJoin[1], spaceJoin[2]);
    if (repaired) return repaired;
  }

  const plusHits = [...compact.matchAll(PLUS_TYPE_RE)];
  if (plusHits.length) return sanitizeTypeCode(plusHits[0][1]);

  const dashHits = [...compact.matchAll(DASH_TYPE_RE)];
  if (dashHits.length) return sanitizeTypeCode(dashHits[0][1]);

  // Last resort: find suffix 1130504A and nearby prefix digits
  const suffixMatch = compact.match(/(1130\d{3}A?)/);
  if (suffixMatch) {
    const before = compact.substring(0, compact.indexOf(suffixMatch[1]));
    const prefixMatch = before.match(/(\d{4,6})[A-Z0-9]?$/);
    if (prefixMatch) {
      const repaired = repairPlusTypeCode(prefixMatch[1], suffixMatch[1]);
      if (repaired) return repaired;
    }
  }

  return null;
}
