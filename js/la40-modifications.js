/**
 * LA40 modification component lengths from install and stroke.
 */

export const LA40_CONSTANTS = {
  HOLE_TO_SHAFT: 94,
  SHAFT_END_OFFSET: 18,
  THREADED_ROD_BASE: 61 + 25,
};

/**
 * @param {number} installMm - retracted install length
 * @param {number} strokeMm - stroke
 */
export function calcLa40Modifications(installMm, strokeMm) {
  const { HOLE_TO_SHAFT, SHAFT_END_OFFSET, THREADED_ROD_BASE } = LA40_CONSTANTS;

  const outerTubeMm = installMm - HOLE_TO_SHAFT - SHAFT_END_OFFSET;
  const shaftMm = outerTubeMm;
  const threadedRodMm = THREADED_ROD_BASE + strokeMm;
  const limitSwitchMm = strokeMm;
  const fullyExtendedMm = installMm + strokeMm;

  return {
    installMm,
    strokeMm,
    outerTubeMm,
    shaftMm,
    threadedRodMm,
    limitSwitchMm,
    fullyExtendedMm,
  };
}

export const LA40_CYCLE_DEFAULTS = {
  STROKE_SPEED_MM_S: 2.5,
  CYCLE_COUNT: 3000,
  SECONDS_PER_DAY: 86400,
  DUTY_PRESETS: [
    { label: '25%', fraction: 0.25 },
    { label: '50%', fraction: 0.5 },
    { label: '75%', fraction: 0.75 },
    { label: '100%', fraction: 1.0 },
  ],
};

/** @param {number} timeToExtendS */
export function dwellFromDutyFraction(timeToExtendS, fraction) {
  if (fraction >= 1) return 0;
  return timeToExtendS / fraction - timeToExtendS;
}

/** @param {number} timeToExtendS */
export function dutyFractionFromDwell(timeToExtendS, dwellTimeS) {
  if (dwellTimeS <= 0) return 1;
  return timeToExtendS / (timeToExtendS + dwellTimeS);
}

/**
 * @param {number} fraction
 * @returns {number | null} matching preset fraction, or null
 */
export function matchDutyPreset(fraction) {
  for (const preset of LA40_CYCLE_DEFAULTS.DUTY_PRESETS) {
    if (Math.abs(fraction - preset.fraction) < 0.005) return preset.fraction;
  }
  return null;
}

/**
 * @param {number} strokeMm
 * @param {{ strokeSpeedMmS?: number, cycleCount?: number, dutyFraction?: number }} options
 */
export function calcLa40CycleScenario(strokeMm, options = {}) {
  const strokeSpeedMmS = options.strokeSpeedMmS ?? LA40_CYCLE_DEFAULTS.STROKE_SPEED_MM_S;
  const cycleCount = options.cycleCount ?? LA40_CYCLE_DEFAULTS.CYCLE_COUNT;
  const dutyFraction = options.dutyFraction ?? 0.5;
  const { SECONDS_PER_DAY } = LA40_CYCLE_DEFAULTS;

  const timeToExtendS = strokeMm / strokeSpeedMmS;
  const dwellTimeS = dwellFromDutyFraction(timeToExtendS, dutyFraction);
  const activeTimePerCycleS = 2 * timeToExtendS;
  const daysAtFullDuty = (cycleCount * activeTimePerCycleS) / SECONDS_PER_DAY;
  const daysToComplete = daysAtFullDuty / dutyFraction;

  return {
    strokeMm,
    strokeSpeedMmS,
    cycleCount,
    dutyFraction,
    dutyPercent: dutyFraction * 100,
    timeToExtendS,
    dwellTimeS,
    activeTimePerCycleS,
    daysToComplete,
  };
}

/**
 * Reference table for all preset duty cycles.
 *
 * @param {number} strokeMm
 * @param {{ strokeSpeedMmS?: number, cycleCount?: number }} [options]
 */
export function calcLa40CycleTimes(strokeMm, options = {}) {
  const strokeSpeedMmS = options.strokeSpeedMmS ?? LA40_CYCLE_DEFAULTS.STROKE_SPEED_MM_S;
  const cycleCount = options.cycleCount ?? LA40_CYCLE_DEFAULTS.CYCLE_COUNT;
  const { SECONDS_PER_DAY, DUTY_PRESETS } = LA40_CYCLE_DEFAULTS;

  const timeToExtendS = strokeMm / strokeSpeedMmS;
  const activeTimePerCycleS = 2 * timeToExtendS;
  const daysAtFullDuty = (cycleCount * activeTimePerCycleS) / SECONDS_PER_DAY;

  const rows = DUTY_PRESETS.map(({ label, fraction }) => ({
    label: `${label} duty cycle`,
    fraction,
    dwellTimeS: dwellFromDutyFraction(timeToExtendS, fraction),
    daysToComplete: daysAtFullDuty / fraction,
  }));

  return {
    strokeMm,
    strokeSpeedMmS,
    cycleCount,
    timeToExtendS,
    activeTimePerCycleS,
    rows,
  };
}

export const LA40_COMPONENTS = [
  {
    id: 'outer',
    name: 'Outer tube',
    image: 'images/la40/outer-assembly.jpeg',
    lengthKey: 'outerTubeMm',
    note: 'Overall outer housing length',
  },
  {
    id: 'threaded-rod',
    name: 'Threaded rod',
    image: 'images/la40/threaded-rod.jpeg',
    lengthKey: 'threadedRodMm',
    note: 'Lead screw cut length',
  },
  {
    id: 'shaft',
    name: 'Shaft',
    image: 'images/la40/tubes.jpeg',
    lengthKey: 'shaftMm',
    note: 'Inner extension tube',
  },
  {
    id: 'limit-switch',
    name: 'Limit switch',
    image: 'images/la40/limit-switch.jpeg',
    lengthKey: 'limitSwitchMm',
    note: 'Limit switch strip — 60 mm to start point',
  },
];
