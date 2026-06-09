/**
 * Valid LINAK actuator families — used to validate type-code prefixes and guide OCR.
 */

/** @type {Record<string, string>} prefix digits → family id */
export const PREFIX_TO_FAMILY = {
  '12': 'LA12', '18': 'LA18', '20': 'LA20', '22': 'LA22', '23': 'LA23',
  '25': 'LA25', '27': 'LA27', '28': 'LA28', '29': 'LA29', '30': 'LA30',
  '31': 'LA31', '32': 'LA32', '34': 'LA34', '35': 'LA35', '36': 'LA36',
  '40': 'LA40', '42': 'LA42', '43': 'LA43', '44': 'LA44',
};

export const VALID_FAMILY_IDS = [
  ...Object.values(PREFIX_TO_FAMILY),
  'BB3', 'BL4',
];

export const VALID_PREFIXES = new Set(Object.keys(PREFIX_TO_FAMILY));

/** OCR digit swaps in family prefix position */
const PREFIX_DIGIT_FIXES = {
  '7': ['4', '1'], '4': ['7'], '8': ['0', '3'], '0': ['8'],
  '3': ['8'], '1': ['7'], '2': ['7'],
};

export function isValidFamilyPrefix(prefix) {
  return VALID_PREFIXES.has(prefix);
}

export function familyFromPrefix(prefix) {
  return PREFIX_TO_FAMILY[prefix] || null;
}

export function prefixFromFamily(familyId) {
  const id = (familyId || '').toUpperCase();
  const la = id.match(/^LA(\d{2})$/);
  if (la && VALID_PREFIXES.has(la[1])) return la[1];
  return null;
}

export function isKnownFamily(familyId) {
  return VALID_FAMILY_IDS.includes((familyId || '').toUpperCase());
}

export function typeCodePrefix(typeCode) {
  const clean = (typeCode || '').replace(/\s/g, '').toUpperCase();
  if (!clean) return null;
  if (clean.includes('+')) return clean.split('+')[0].substring(0, 2);
  if (clean.includes('-')) return clean.substring(0, 2);
  return clean.substring(0, 2);
}

/**
 * Infer expected actuator family from label text (item no, KA/LA mentions).
 * @returns {string[]} e.g. ['LA30', 'LA40']
 */
export function inferFamilyHintsFromLabel(text) {
  const hints = new Set();
  const blob = (text || '').toUpperCase();

  for (const m of blob.matchAll(/\bLA(\d{2})\b/g)) {
    const fam = familyFromPrefix(m[1]);
    if (fam) hints.add(fam);
  }

  for (const m of blob.matchAll(/\bKA(\d{2})[-–]/g)) {
    const fam = familyFromPrefix(m[1]);
    if (fam) hints.add(fam);
  }

  for (const m of blob.matchAll(/\bLC(\d{2})\b/g)) {
    const fam = familyFromPrefix(m[1]);
    if (fam) hints.add(fam);
  }

  if (/\bBB3\b/.test(blob)) hints.add('BB3');
  if (/\bBL4\b/.test(blob)) hints.add('BL4');

  return [...hints];
}

/**
 * Build decode hints object from label context.
 */
export function buildDecodeHints(labelText = '') {
  const families = inferFamilyHintsFromLabel(labelText);
  const prefixes = families.map(prefixFromFamily).filter(Boolean);
  return { expectedFamilies: families, expectedPrefixes: prefixes };
}

/**
 * Try to fix invalid prefix digits using expected family hint.
 */
export function alignPrefixToHint(prefix2, expectedPrefixes) {
  if (!prefix2 || !expectedPrefixes?.length) return [prefix2];
  if (expectedPrefixes.includes(prefix2)) return [prefix2];

  const variants = new Set([prefix2]);

  for (const expected of expectedPrefixes) {
    if (prefix2.length !== 2 || expected.length !== 2) continue;

    let rebuilt = '';
    for (let i = 0; i < 2; i++) {
      rebuilt += prefix2[i] === expected[i]
        ? expected[i]
        : expected[i];
    }
    variants.add(expected);

    for (let i = 0; i < 2; i++) {
      if (prefix2[i] !== expected[i]) {
        const fixes = PREFIX_DIGIT_FIXES[prefix2[i]] || [];
        for (const fix of fixes) {
          variants.add(prefix2.substring(0, i) + fix + prefix2.substring(i + 1));
        }
        variants.add(prefix2.substring(0, i) + expected[i] + prefix2.substring(i + 1));
      }
    }
  }

  return [...variants].filter(isValidFamilyPrefix);
}
