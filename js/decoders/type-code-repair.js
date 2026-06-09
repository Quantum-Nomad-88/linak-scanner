/**
 * OCR repair for LINAK type codes — fixes common misreads across all actuator families.
 */

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

function isValidTypeCode(code) {
  const c = sanitize(code);
  if (c.length < 10) return false;
  if (!c.includes('+') && !c.includes('-')) return false;
  return SHORT_PLUS_RE.test(c) || FLEXIBLE_PLUS_RE.test(c) || DASH_TYPE_RE.test(c);
}

const FAMILY_PREFIXES = new Set([
  '12', '18', '20', '22', '23', '25', '27', '28', '29', '30',
  '31', '32', '34', '35', '36', '40', '42', '43', '44',
]);

const TRAILING_SUFFIX_FIX = { F: 'E', G: 'E', P: 'E', O: 'E', 8: 'B', 6: 'G' };

function unique(arr) {
  return [...new Set(arr.filter(Boolean))];
}

/** Apply one pass of prefix OCR fixes */
function fixPrefixOnce(p) {
  let out = p;

  // O/Q misread as zero in leading numeric runs
  const head = out.match(/^(\d+)/);
  if (head) {
    const fixed = head[1].replace(/[OQ]/g, '0');
    out = fixed + out.slice(head[1].length);
  }

  // Spurious zero between M and C  (00M0C → D0MC is separate)
  out = out.replace(/M0C/g, 'MC');

  // D misread as 0 after long digit block: 30040200000M0C → 300402000D0MC
  out = out.replace(/^(\d{9,})0{2,}M0C(\d*)$/, '$1D0MC$2');
  out = out.replace(/^(\d{9,})00M0C(\d*)$/, '$1D0MC$2');
  out = out.replace(/^(\d{9,})0{2,}M(\d*)$/, '$1D0M$2');
  out = out.replace(/^(\d{9,})0{3,}M/, '$1D0M');

  // Digit run + 00 + letter → D0 + letter
  out = out.replace(/^(\d{8,})0{2,}([A-Z])/, '$1D0$2');

  // Extra zeros before config letters: 30040200000X → 300402000DX
  out = out.replace(/^(\d{9})0+([A-Z])/, '$1D0$2');

  // 0 misread as D in short Careline: 272108 → 27210B handled elsewhere
  return out;
}

/** Apply one pass of suffix OCR fixes */
function fixSuffixOnce(s) {
  let out = s.replace(/[OQ]/g, '0');

  const last = out[out.length - 1];
  if (TRAILING_SUFFIX_FIX[last]) {
    out = out.slice(0, -1) + TRAILING_SUFFIX_FIX[last];
  }

  return out;
}

function expandPrefixRepairs(prefix) {
  const variants = new Set([prefix]);
  for (let pass = 0; pass < 4; pass++) {
    for (const v of [...variants]) {
      variants.add(fixPrefixOnce(v));
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
 */
export function scoreTypeCodeCandidate(code, ocrRaw = '') {
  if (!isValidTypeCode(code)) return 0;

  let score = 30;
  const [pfx, sfx] = code.split('+');

  if (FAMILY_PREFIXES.has(pfx.substring(0, 2))) score += 20;
  if (SHORT_PLUS_RE.test(code)) score += 15;
  if (code.length >= 20) score += 10;
  if (/\+1130\d{3}A?$/i.test(code)) score += 25;
  if (/^\d{5}B\+/i.test(code)) score += 10;
  if (/D0MC/.test(pfx)) score += 18;
  if (/D0M/.test(pfx)) score += 12;

  // Prefer letters in extended config block (real codes have letters; OCR zero-goop does not)
  const letters = (pfx.match(/[A-Z]/g) || []).length;
  score += letters * 4;

  // Penalise long runs of zeros in prefix (OCR noise)
  for (const run of pfx.match(/0{4,}/g) || []) score -= run.length * 2;

  // Penalise if much longer than OCR original (extra inserted zeros)
  if (ocrRaw && pfx.length > (ocrRaw.split('+')[0]?.length || 0)) score -= 8;

  // Suffix with embedded stroke-like triple digits
  if (/[A-Z]{1,3}\d{3}\d{3}/.test(sfx) || /\d{3}0\d{2}/.test(sfx)) score += 8;

  if (/[A-Z]$/.test(sfx)) score += 3;

  return score;
}

/**
 * Repair OCR misreads in a type code string.
 * Returns best valid candidate, or sanitized original.
 */
export function repairOcrTypeCode(raw) {
  const clean = sanitize(raw);
  if (!clean) return '';

  if (isValidTypeCode(clean)) {
    const repaired = tryRepairParts(clean);
    return pickBest([clean, ...repaired], clean);
  }

  if (!clean.includes('+')) {
    return clean;
  }

  const repaired = tryRepairParts(clean);
  const best = pickBest(repaired, clean);
  return best || clean;
}

function tryRepairParts(code) {
  const idx = code.indexOf('+');
  const pfx = code.substring(0, idx);
  const sfx = code.substring(idx + 1);

  const prefixes = expandPrefixRepairs(pfx);
  const suffixes = expandSuffixRepairs(sfx);
  const candidates = [];

  for (const p of prefixes) {
    for (const s of suffixes) {
      candidates.push(`${p}+${s}`);
    }
  }

  return unique(candidates);
}

function pickBest(candidates, ocrRaw) {
  const valid = unique(candidates).filter(isValidTypeCode);
  if (!valid.length) return null;
  valid.sort((a, b) => scoreTypeCodeCandidate(b, ocrRaw) - scoreTypeCodeCandidate(a, ocrRaw));
  return valid[0];
}

/**
 * Pick best type code from multiple OCR blobs.
 */
export function bestRepairedTypeCode(candidates, ocrRaw = '') {
  const all = [];
  for (const c of candidates) {
    all.push(repairOcrTypeCode(c));
    if (c?.includes('+')) {
      all.push(...tryRepairParts(sanitize(c)));
    }
  }
  return pickBest(all, ocrRaw) || pickBest(all.map(repairOcrTypeCode), ocrRaw);
}
