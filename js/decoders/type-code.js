/**
 * Shared type-code normalization and extraction for LINAK labels.
 */

/** Clean invisible chars and spaces around + */
export function normalizeLabelInput(raw) {
  return (raw || '')
    .replace(/\r/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\uFF0B/g, '+')
    .replace(/\s*\+\s*/g, '+')
    .trim();
}

/**
 * Match LINAK plus-format codes e.g. 27210B+1130504A, 314100+1130004A
 */
export const PLUS_TYPE_RE = /(\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*)/gi;

/**
 * Match standard dash-format codes e.g. 311100-00100240
 */
export const DASH_TYPE_RE = /(\d{6}-\d{6,8}[A-Z0-9]*)/gi;

/**
 * Extract a type code from plain text (paste, OCR, or override field).
 * @param {string} text
 * @returns {string|null}
 */
export function extractTypeCode(text) {
  const normalized = normalizeLabelInput(text);
  if (!normalized) return null;

  const compact = normalized.replace(/\s/g, '').toUpperCase();

  // Entire input is just a type code
  const barePlus = compact.match(/^(\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*)$/);
  if (barePlus) return barePlus[1];

  const bareDash = compact.match(/^(\d{6}-\d{6,8}[A-Z0-9]*)$/);
  if (bareDash) return bareDash[1];

  // "Type: 27210B+1130504A" or "Type.: ..."
  const typeLine = normalized.match(/Type\.?\s*:?\s*(\S+)/i);
  if (typeLine) {
    const candidate = typeLine[1].replace(/\s/g, '').toUpperCase();
    if (isValidTypeCode(candidate)) return candidate;
  }

  // Search anywhere in text
  const plusHits = [...compact.matchAll(PLUS_TYPE_RE)];
  if (plusHits.length) return plusHits[0][1];

  const dashHits = [...compact.matchAll(DASH_TYPE_RE)];
  if (dashHits.length) {
    return dashHits.sort((a, b) => scoreTypeCode(b[1]) - scoreTypeCode(a[1]))[0][1];
  }

  return null;
}

export function isValidTypeCode(code) {
  if (!code) return false;
  const c = code.toUpperCase();
  return /^\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*$/.test(c) || /^\d{6}-\d{6,8}[A-Z0-9]*$/.test(c);
}

function scoreTypeCode(code) {
  let s = 0;
  if (/^\d{6}-\d{6,8}$/.test(code)) s += 10;
  if (/^(12|22|23|27|28|29|30|31|32|34|36|43|44)/.test(code)) s += 5;
  if (/\+/.test(code)) s += 8;
  return s;
}
