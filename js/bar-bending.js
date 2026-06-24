/** Bar bending calculator — 3 mm radius + 50 mm V die */

export const BAR_BEND_TOOLING = '3 mm radius + 50 mm V';
export const MAX_FLANGES = 7;

export const BAR_SIZES = {
  10: { label: '10 mm bar', deduction: 16, half: 8 },
  8: { label: '8 mm bar', deduction: 12.5, half: 6.25 },
  4: { label: '4 mm bar', deduction: 6.8, half: 3.4 },
};

/**
 * Bends = number of flanges − 1 (2 flanges → 1 bend, 3 flanges → 2 bends, …)
 * @param {number[]} flanges - flange lengths in order
 * @param {10|8|4} barSizeKey
 * @param {number[]} [foldDirections] - 1 for +90, -1 for -90
 */
export function calcBarBending(flanges, barSizeKey, foldDirections = []) {
  const bar = BAR_SIZES[barSizeKey];
  if (!bar) throw new Error('Invalid bar size');

  const activeFlanges = flanges
    .map((v) => (Number.isFinite(v) && v >= 0 ? v : 0))
    .slice(0, MAX_FLANGES);

  const numFolds = Math.max(0, activeFlanges.length - 1);
  const normalizedDirections = Array.from({ length: numFolds }, (_, i) =>
    foldDirections[i] === -1 ? -1 : 1
  );
  const flangeSum = activeFlanges.reduce((sum, n) => sum + n, 0);
  const cutLength = flangeSum - numFolds * bar.deduction;

  const cutByBar = Object.fromEntries(
    Object.entries(BAR_SIZES).map(([key, cfg]) => [
      key,
      flangeSum - numFolds * cfg.deduction,
    ])
  );

  const backstops = activeFlanges.map((flange, index) => ({
    fold: index + 1,
    flangeMm: flange,
    backstopMm: Math.round((flange - bar.half) * 100) / 100,
  }));

  return {
    tooling: BAR_BEND_TOOLING,
    flanges: activeFlanges,
    numFolds,
    barSizeKey,
    bar,
    flangeSum,
    cutLength: Math.round(cutLength * 100) / 100,
    cutByBar: Object.fromEntries(
      Object.entries(cutByBar).map(([k, v]) => [k, Math.round(v * 100) / 100])
    ),
    backstops,
    activeBackstops: backstops,
    foldDirections: normalizedDirections,
  };
}

export function parseBarNumber(raw) {
  const cleaned = String(raw ?? '').trim().replace(',', '.');
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}
