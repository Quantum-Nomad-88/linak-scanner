/**
 * OCR repair for LINAK type codes — fixes common misreads across all actuator families.
 */

import {
  isValidFamilyPrefix,
  familyFromPrefix,
  alignPrefixToHint,
  typeCodePrefix,
} from './motor-catalog.js';

const SHORT_PLUS_RE = /^\d{5}[A-Z0-9]?\+\d{6,}[A-Z0-9]*$/;
const FLEXIBLE_PLUS_RE = /^\d{2}[A-Z0-9]{2,32}\+[A-Z0-9]{4,32}$/;
const DASH_TYPE_RE = /^\d{6}-\d{6,10}[A-Z0-9]*$/;

function sanitize(raw) {
  return (raw || '')
    .toUpperCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\uFF0B/g, '+')
    .replace(/[:]/g, '+')
    .replace(/\s*\+\s*/g, '+')
    .replace(/[^A-Z0-9+\-]/g, '')
    .trim();
}

function hasValidFamilyPrefix(code) {
  const pfx = typeCodePrefix(code);
  return pfx ? isValidFamilyPrefix(pfx) : false;
}

export function isValidTypeCode(code) {
  const c = sanitize(code);
  if (c.length < 10) return false;
  if (!c.includes('+') && !c.includes('-')) return false;
  if (!SHORT_PLUS_RE.test(c) && !FLEXIBLE_PLUS_RE.test(c) && !DASH_TYPE_RE.test(c)) return false;
  return hasValidFamilyPrefix(c);
}

const TRAILING_SUFFIX_FIX = { F: 'E', G: 'E', P: 'E', O: 'E', 8: 'B', 6: 'G' };

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

function fixPrefixOnce(p) {
  let out = p;

  const head = out.match(/^(\d+)/);
  if (head) {
    const fixed = head[1].replace(/[OQ]/g, '0');
    out = fixed + out.slice(head[1].length);
  }

  out = out.replace(/M0C/g, 'MC');
  out = out.replace(/^(\d{9,})0{2,}M0C(\d*)$/, '$1D0MC$2');
  out = out.replace(/^(\d{9,})00M0C(\d*)$/, '$1D0MC$2');
  out = out.replace(/^(\d{9,})0{2,}M(\d*)$/, '$1D0M$2');
  out = out.replace(/^(\d{9,})0{3,}M/, '$1D0M');
  out = out.replace(/^(\d{8,})0{2,}([A-Z])/, '$1D0$2');
  out = out.replace(/^(\d{9})0+([A-Z])/, '$1D0$2');

  return out;
}

function fixSuffixOnce(s) {
  let out = s.replace(/[OQ]/g, '0');
  const last = out[out.length - 1];
  if (TRAILING_SUFFIX_FIX[last]) {
    out = out.slice(0, -1) + TRAILING_SUFFIX_FIX[last];
  }
  return out;
}

function expandPrefixRepairs(prefix, hints = {}) {
  const variants = new Set([prefix]);

  for (let pass = 0; pass < 4; pass++) {
    for (const v of [...variants]) {
      variants.add(fixPrefixOnce(v));
    }
  }

  const pfx2 = prefix.substring(0, 2);
  for (const alt of alignPrefixToHint(pfx2, hints.expectedPrefixes)) {
    if (alt !== pfx2) {
      variants.add(alt + prefix.substring(2));
      for (const v of [...variants]) {
        variants.add(fixPrefixOnce(v));
      }
    }
  }

  return [...variants];
}

function expandSuffixRepairs(suffix) {
  const variants = new Set([suffix]);
  for (let pass = 0; pass < 3; pass++) {
    for (const v of [...variants]) {
      variants.add(fixSuffixOnce(v));
    }
  }
  return [...variants];
}

/**
 * Score a repaired candidate — higher is better.
 * @param {object} hints - { expectedFamilies, expectedPrefixes }
 */
export function scoreTypeCodeCandidate(code, ocrRaw = '', hints = {}) {
  if (!isValidTypeCode(code)) return 0;

  let score = 30;
  const [pfx, sfx] = code.split('+');
  const prefix2 = pfx.substring(0, 2);
  const family = familyFromPrefix(prefix2);

  score += 25;

  if (hints.expectedPrefixes?.includes(prefix2)) score += 55;
  else if (hints.expectedFamilies?.length) score -= 35;

  if (hints.expectedFamilies?.includes(family)) score += 20;

  if (SHORT_PLUS_RE.test(code)) score += 15;
  if (code.length >= 20) score += 10;
  if (/\+1130\d{3}A?$/i.test(code)) score += 25;
  if (/^\d{5}B\+/i.test(code)) score += 10;
  if (/D0MC/.test(pfx)) score += 18;
  if (/D0M/.test(pfx)) score += 12;

  const letters = (pfx.match(/[A-Z]/g) || []).length;
  score += letters * 4;

  for (const run of pfx.match(/0{4,}/g) || []) score -= run.length * 2;

  if (ocrRaw && pfx.length > (ocrRaw.split('+')[0]?.length || 0)) score -= 8;

  if (/[A-Z]{1,3}\d{3}\d{3}/.test(sfx) || /\d{3}0\d{2}/.test(sfx)) score += 8;
  if (/[A-Z]$/.test(sfx)) score += 3;

  return score;
}

export function repairOcrTypeCode(raw, hints = {}) {
  const clean = sanitize(raw);
  if (!clean) return '';

  if (isValidTypeCode(clean)) {
    const repaired = tryRepairParts(clean, hints);
    return pickBest([clean, ...repaired], clean, hints);
  }

  if (!clean.includes('+')) return clean;

  const repaired = tryRepairParts(clean, hints);
  const best = pickBest(repaired, clean, hints);
  return best || clean;
}

function tryRepairParts(code, hints = {}) {
  const idx = code.indexOf('+');
  const pfx = code.substring(0, idx);
  const sfx = code.substring(idx + 1);

  const prefixes = expandPrefixRepairs(pfx, hints);
  const suffixes = expandSuffixRepairs(sfx);
  const candidates = [];

  for (const p of prefixes) {
    for (const s of suffixes) {
      candidates.push(`${p}+${s}`);
    }
  }

  return unique(candidates);
}

function pickBest(candidates, ocrRaw, hints = {}) {
  const valid = unique(candidates).filter(isValidTypeCode);
  if (!valid.length) return null;
  valid.sort((a, b) => scoreTypeCodeCandidate(b, ocrRaw, hints) - scoreTypeCodeCandidate(a, ocrRaw, hints));
  return valid[0];
}

export function bestRepairedTypeCode(candidates, ocrRaw = '', hints = {}) {
  const all = [];
  for (const c of candidates) {
    all.push(repairOcrTypeCode(c, hints));
    if (c?.includes('+')) {
      all.push(...tryRepairParts(sanitize(c), hints));
    }
  }
  return pickBest(all, ocrRaw, hints) || pickBest(all.map((c) => repairOcrTypeCode(c, hints)), ocrRaw, hints);
}
