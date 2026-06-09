/**
 * Shared type-code normalization and extraction for LINAK labels.
 */

/** Strip to valid type-code characters only */
export function sanitizeTypeCode(raw) {
  return (raw || '')
    .toUpperCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\uFF0B/g, '+')
    .replace(/\s*\+\s*/g, '+')
    .replace(/[^A-Z0-9+\-]/g, '')
    .trim();
}

/** Clean invisible chars and spaces around + */
export function normalizeLabelInput(raw) {
  return (raw || '')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\uFF0B/g, '+')
    .replace(/\s*\+\s*/g, '+')
    .trim();
}

/** Plus format: 27210B+1130504A */
export const PLUS_TYPE_RE = /(\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*)/gi;

/** Dash format: 311100-00100240 */
export const DASH_TYPE_RE = /(\d{6}-\d{6,8}[A-Z0-9]*)/gi;

export function isValidTypeCode(code) {
  if (!code) return false;
  const c = sanitizeTypeCode(code);
  return /^\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*$/.test(c) || /^\d{6}-\d{6,8}[A-Z0-9]*$/.test(c);
}

/**
 * Extract a type code from plain text (paste, OCR, or override field).
 * @param {string} text
 * @returns {string|null}
 */
export function extractTypeCode(text) {
  const normalized = normalizeLabelInput(text);
  if (!normalized) return null;

  const compact = sanitizeTypeCode(normalized);

  // Entire input is just a type code
  if (isValidTypeCode(compact)) return compact;

  // "Type: 27210B+1130504A"
  const typeLine = normalized.match(/Type\.?\s*:?\s*(\S+)/i);
  if (typeLine) {
    const candidate = sanitizeTypeCode(typeLine[1]);
    if (isValidTypeCode(candidate)) return candidate;
  }

  // Space instead of + (common OCR error): 27210B 1130504A
  const spaceJoin = compact.match(/^(\d{5}[A-Z0-9]?)(\d{6,}[A-Z0-9]*)$/);
  if (spaceJoin) {
    const joined = `${spaceJoin[1]}+${spaceJoin[2]}`;
    if (isValidTypeCode(joined)) return joined;
  }

  // Search anywhere in text
  const plusHits = [...compact.matchAll(PLUS_TYPE_RE)];
  if (plusHits.length) return sanitizeTypeCode(plusHits[0][1]);

  const dashHits = [...compact.matchAll(DASH_TYPE_RE)];
  if (dashHits.length) return sanitizeTypeCode(dashHits[0][1]);

  return null;
}
