/**
 * Shared type-code normalization and extraction for LINAK labels.
 */

import { repairOcrTypeCode, bestRepairedTypeCode } from './type-code-repair.js';

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

/** Any LINAK plus-format code — short or extended */
export const FLEXIBLE_PLUS_RE = /^\d{2}[A-Z0-9]{2,32}\+[A-Z0-9]{4,32}$/;

export const DASH_TYPE_RE = /^\d{6}-\d{6,10}[A-Z0-9]*$/;

/** Find plus-format codes in messy OCR text */
export const PLUS_TYPE_RE = /(\d{2}[A-Z0-9]{4,32}\+[A-Z0-9]{4,32}|\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*)/gi;

/** @deprecated use FLEXIBLE_PLUS_RE */
export const EXTENDED_PLUS_RE = FLEXIBLE_PLUS_RE;

const KNOWN_SUFFIXES = [
  /^1130\d{3}A?$/,
  /^113\d{4}A?$/,
  /^1[13]\d{5}A?$/,
  /^1011[A-Z]{0,2}\d{6,}[A-Z]?$/,
];

function isKnownPlusSuffix(s) {
  const clean = s.replace(/[^A-Z0-9]/gi, '').toUpperCase();
  return KNOWN_SUFFIXES.some((re) => re.test(clean));
}

function combinePlusParts(prefix, suffix) {
  const p = (prefix || '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const s = (suffix || '').replace(/^[:+]/, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  if (!p || !s) return null;
  return repairOcrTypeCode(`${p}+${s}`);
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
  if (c.length < 10) return false;
  if (!c.includes('+') && !c.includes('-')) return false;
  return SHORT_PLUS_RE.test(c) || FLEXIBLE_PLUS_RE.test(c) || DASH_TYPE_RE.test(c);
}

export function isExtendedPlusCode(code) {
  const c = sanitizeTypeCode(code);
  return FLEXIBLE_PLUS_RE.test(c) && !SHORT_PLUS_RE.test(c);
}

function pickLongestPlusMatch(hits) {
  if (!hits.length) return null;
  hits.sort((a, b) => b[1].length - a[1].length);
  return repairOcrTypeCode(hits[0][1]);
}

function finalizeCandidate(raw) {
  const repaired = repairOcrTypeCode(raw);
  return isValidTypeCode(repaired) ? repaired : null;
}

function extractSplitTypeCode(text) {
  const compact = text.replace(/\s/g, '').toUpperCase();

  const extSplit = compact.match(/(\d{2}[A-Z0-9]{4,32})[:+]+([A-Z0-9]{4,32})/);
  if (extSplit) {
    const combined = combinePlusParts(extSplit[1], extSplit[2]);
    if (combined && isValidTypeCode(combined)) return combined;
  }

  const split = compact.match(/(\d{4,8})[:+]+(\d{6,}[A-Z0-9]*)/);
  if (split) {
    const repaired = repairPlusTypeCode(split[1], split[2]);
    if (repaired && isValidTypeCode(repaired)) return repaired;
  }

  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length - 1; i++) {
    const left = lines[i].replace(/^Type:?\s*/i, '').replace(/[^A-Z0-9]/gi, '');
    const right = lines[i + 1].replace(/^[:+]/, '').replace(/[^A-Z0-9]/gi, '');
    if (left.length >= 4 && right.length >= 4) {
      const combined = combinePlusParts(left, right) || repairPlusTypeCode(left, right);
      if (combined && isValidTypeCode(combined)) return combined;
    }
  }

  return null;
}

function extractJoinedPlus(compact) {
  const plusIdx = compact.indexOf('+');
  if (plusIdx > 2) {
    const combined = finalizeCandidate(
      `${compact.substring(0, plusIdx)}+${compact.substring(plusIdx + 1)}`
    );
    if (combined) return combined;
  }

  const lostPlus = compact.match(/^(\d{2}[A-Z0-9]{6,32})(\d{2}[A-Z0-9]{6,32})$/);
  if (lostPlus) {
    const combined = combinePlusParts(lostPlus[1], lostPlus[2]);
    if (combined && isValidTypeCode(combined)) return combined;
  }

  return null;
}

/** Loose match — find anything that looks like a type code, then repair */
function extractLoosePlus(compact) {
  const loose = compact.match(/(\d{2}[A-Z0-9]{6,32}\+[A-Z0-9]{6,32})/);
  if (loose) return finalizeCandidate(loose[1]);
  return null;
}

export function extractTypeCode(text) {
  const normalized = normalizeLabelInput(text);
  if (!normalized) return null;

  const compact = sanitizeTypeCode(normalized);

  const direct = finalizeCandidate(compact);
  if (direct) return direct;

  const joined = extractJoinedPlus(compact);
  if (joined) return joined;

  const split = extractSplitTypeCode(normalized) || extractSplitTypeCode(compact);
  if (split) return split;

  const typeLine = normalized.match(/Type\.?\s*:?\s*([A-Z0-9+]{10,})/i);
  if (typeLine) {
    const candidate = finalizeCandidate(typeLine[1]);
    if (candidate) return candidate;

    const rest = normalized.match(/Type\.?\s*:?\s*[A-Z0-9+]+\s+([A-Z0-9]{4,})/i);
    if (rest) {
      const prefix = typeLine[1].replace(/[^A-Z0-9]/gi, '');
      const combined = combinePlusParts(prefix, rest[1]) || repairPlusTypeCode(prefix, rest[1]);
      if (combined && isValidTypeCode(combined)) return combined;
    }
  }

  const spaceJoin = compact.match(/^(\d{4,8}[A-Z0-9]?)(\d{6,}[A-Z0-9]*)$/);
  if (spaceJoin) {
    const repaired = repairPlusTypeCode(spaceJoin[1], spaceJoin[2]);
    if (repaired && isValidTypeCode(repaired)) return repaired;
  }

  const plusHits = [...compact.matchAll(PLUS_TYPE_RE)];
  const fromRegex = pickLongestPlusMatch(plusHits);
  if (fromRegex && isValidTypeCode(fromRegex)) return fromRegex;

  const dashHits = [...compact.matchAll(/(\d{6}-\d{6,10}[A-Z0-9]*)/gi)];
  if (dashHits.length) return finalizeCandidate(dashHits[0][1]);

  const suffixPatterns = [
    /(1130\d{3}A?)/,
    /(1011[A-Z]{0,2}\d{6,}[A-Z]?)/,
    /(\d{6,}[A-Z]\d{3,}[A-Z]?)/,
  ];

  for (const re of suffixPatterns) {
    const suffixMatch = compact.match(re);
    if (!suffixMatch) continue;
    const before = compact.substring(0, compact.indexOf(suffixMatch[1]));
    const prefixMatch = before.match(/(\d{2}[A-Z0-9]{4,32})$/);
    if (prefixMatch) {
      const combined = combinePlusParts(prefixMatch[1], suffixMatch[1]);
      if (combined && isValidTypeCode(combined)) return combined;
    }
  }

  return extractLoosePlus(compact);
}

export { repairOcrTypeCode, bestRepairedTypeCode };
