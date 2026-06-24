/** Bar bending calculator — 3 mm radius + 50 mm V die */

export const BAR_BEND_TOOLING = '3 mm radius + 50 mm V';

export const BAR_SIZES = {
  10: { label: '10 mm bar', deduction: 16, half: 8 },
  8: { label: '8 mm bar', deduction: 12.5, half: 6.25 },
  4: { label: '4 mm bar', deduction: 6.8, half: 3.4 },
};

const MAX_FLANGES = 7;

/**
 * @param {number[]} flanges - flange lengths (up to 7)
 * @param {number} numFolds
 * @param {10|8|4} barSizeKey
 */
export function calcBarBending(flanges, numFolds, barSizeKey) {
  const bar = BAR_SIZES[barSizeKey];
  if (!bar) throw new Error('Invalid bar size');

  const normalized = Array.from({ length: MAX_FLANGES }, (_, i) => {
    const v = Number(flanges[i]);
    return Number.isFinite(v) && v >= 0 ? v : 0;
  });

  const folds = Math.max(1, Math.min(MAX_FLANGES, Math.round(numFolds)));
  const flangeSum = normalized.reduce((sum, n) => sum + n, 0);
  const cutLength = flangeSum - folds * bar.deduction;

  const cutByBar = Object.fromEntries(
    Object.entries(BAR_SIZES).map(([key, cfg]) => [
      key,
      flangeSum - folds * cfg.deduction,
    ])
  );

  const backstops = normalized.map((flange, index) => ({
    fold: index + 1,
    flangeMm: flange,
    backstopMm: Math.round((flange - bar.half) * 100) / 100,
  }));

  const activeFlanges = normalized.slice(0, folds + 1);
  while (activeFlanges.length > 1 && activeFlanges[activeFlanges.length - 1] === 0) {
    activeFlanges.pop();
  }

  return {
    tooling: BAR_BEND_TOOLING,
    flanges: normalized,
    numFolds: folds,
    barSizeKey,
    bar,
    flangeSum,
    cutLength: Math.round(cutLength * 100) / 100,
    cutByBar: Object.fromEntries(
      Object.entries(cutByBar).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    backstops,
    activeFlanges,
    activeBackstops: backstops.slice(0, folds + 1),
  };
}

export function parseBarNumber(raw) {
  const cleaned = String(raw ?? '').trim().replace(',', '.');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}
