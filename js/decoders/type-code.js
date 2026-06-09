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

/** Short Careline e.g. 27210B+1130504A */
export const SHORT_PLUS_RE = /^\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*$/;

/** Extended desk/column e.g. 300402000D0MC26+1011AA149060E */
export const EXTENDED_PLUS_RE = /^\d{2}[A-Z0-9]{4,22}\+[A-Z0-9]{6,24}$/;

export const DASH_TYPE_RE = /^\d{6}-\d{6,8}[A-Z0-9]*$/;

/** Find plus-format codes in messy OCR text — extended first */
export const PLUS_TYPE_RE = /(\d{2}[A-Z0-9]{8,22}\+[A-Z0-9]{10,24}|\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*)/gi;

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

function combinePlusParts(prefix, suffix) {
  const p = (prefix || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const s = (suffix || '').replace(/^[:+]/, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!p || !s) return null;
  const combined = `${p}+${s}`;
  return isValidTypeCode(combined) ? combined : null;
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
    if (p.endsWith('8')) p = p.slice(0, -1) + 'B';
    if (p.length >= 5 && p[0] === '7' && !p.startsWith('27')) p = '2' + p;
    if (p.endsWith('8') && p.startsWith('27')) p = p.slice(0, -1) + 'B';
    if (p.startsWith('27') && p.length === 5 && /^\d+$/.test(p)) p += 'B';
  }

  return combinePlusParts(p, s);
}

export function isValidTypeCode(code) {
  if (!code) return false;
  const c = sanitizeTypeCode(code);
  return SHORT_PLUS_RE.test(c) || EXTENDED_PLUS_RE.test(c) || DASH_TYPE_RE.test(c);
}

export function isExtendedPlusCode(code) {
  return EXTENDED_PLUS_RE.test(sanitizeTypeCode(code));
}

function pickLongestPlusMatch(hits) {
  if (!hits.length) return null;
  hits.sort((a, b) => b[1].length - a[1].length);
  return sanitizeTypeCode(hits[0][1]);
}

/**
 * Find type code split across OCR columns or broken at '+'
 */
function extractSplitTypeCode(text) {
  const compact = text.replace(/\s/g, '').toUpperCase();

  // Extended split e.g. 300402000D0MC26:+1011AA149060E
  const extSplit = compact.match(/(\d{2}[A-Z0-9]{8,22})[:+]+([A-Z0-9]{8,24})/);
  if (extSplit) {
    const combined = combinePlusParts(extSplit[1], extSplit[2]);
    if (combined) return combined;
  }

  // Short split e.g. 72108:+1130504A
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
    if (left.length >= 4 && right.length >= 6) {
      const combined = combinePlusParts(left, right) || repairPlusTypeCode(left, right);
      if (combined) return combined;
    }
  }

  return null;
}

/** Rejoin type code when '+' was lost or OCR merged/split characters */
function extractJoinedPlus(compact) {
  const plusIdx = compact.indexOf('+');
  if (plusIdx > 2) {
    const combined = combinePlusParts(
      compact.substring(0, plusIdx),
      compact.substring(plusIdx + 1)
    );
    if (combined) return combined;
  }

  // Missing '+' between long prefix and suffix
  const lostPlus = compact.match(/^(\d{2}[A-Z0-9]{8,22})(\d{2}[A-Z0-9]{8,22})$/);
  if (lostPlus) {
    const combined = combinePlusParts(lostPlus[1], lostPlus[2]);
    if (combined) return combined;
  }

  return null;
}

export function extractTypeCode(text) {
  const normalized = normalizeLabelInput(text);
  if (!normalized) return null;

  const compact = sanitizeTypeCode(normalized);

  if (isValidTypeCode(compact)) return compact;

  const joined = extractJoinedPlus(compact);
  if (joined) return joined;

  const split = extractSplitTypeCode(normalized) || extractSplitTypeCode(compact);
  if (split) return split;

  // Type: line — allow long alphanumeric strings
  const typeLine = normalized.match(/Type\.?\s*:?\s*([A-Z0-9+]{10,})/i);
  if (typeLine) {
    const candidate = sanitizeTypeCode(typeLine[1]);
    if (isValidTypeCode(candidate)) return candidate;

    const rest = normalized.match(/Type\.?\s*:?\s*[A-Z0-9+]+\s+([A-Z0-9]{6,})/i);
    if (rest) {
      const prefix = typeLine[1].replace(/[^A-Z0-9]/gi, '');
      const combined = combinePlusParts(prefix, rest[1]) || repairPlusTypeCode(prefix, rest[1]);
      if (combined) return combined;
    }
  }

  const spaceJoin = compact.match(/^(\d{4,6}[A-Z0-9]?)(\d{6,}[A-Z0-9]*)$/);
  if (spaceJoin) {
    const repaired = repairPlusTypeCode(spaceJoin[1], spaceJoin[2]);
    if (repaired) return repaired;
  }

  const plusHits = [...compact.matchAll(PLUS_TYPE_RE)];
  const fromRegex = pickLongestPlusMatch(plusHits);
  if (fromRegex) return fromRegex;

  const dashHits = [...compact.matchAll(/(\d{6}-\d{6,8}[A-Z0-9]*)/gi)];
  if (dashHits.length) return sanitizeTypeCode(dashHits[0][1]);

  // LA27 suffix fallback
  const suffixMatch = compact.match(/(1130\d{3}A?)/);
  if (suffixMatch) {
    const before = compact.substring(0, compact.indexOf(suffixMatch[1]));
    const prefixMatch = before.match(/(\d{4,6})[A-Z0-9]?$/);
    if (prefixMatch) {
      const repaired = repairPlusTypeCode(prefixMatch[1], suffixMatch[1]);
      if (repaired) return repaired;
    }
  }

  // Extended suffix fallback e.g. ...1011AA149060E
  const extSuffix = compact.match(/(1011[A-Z]{0,2}\d{6,}[A-Z]?)/);
  if (extSuffix) {
    const before = compact.substring(0, compact.indexOf(extSuffix[1]));
    const prefixMatch = before.match(/(\d{2}[A-Z0-9]{8,22})$/);
    if (prefixMatch) {
      const combined = combinePlusParts(prefixMatch[1], extSuffix[1]);
      if (combined) return combined;
    }
  }

  return null;
}
