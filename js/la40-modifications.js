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
