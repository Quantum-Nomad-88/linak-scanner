/**
 * LA40 modification calculations from LA-40 Calc.xlsx
 * User inputs: install (retracted length) and stroke.
 */

export const LA40_CONSTANTS = {
  HOLE_TO_SHAFT: 94,
  SHAFT_END_OFFSET: 18,
  THREADED_ROD_BASE: 61 + 25,
  THREADED_ROD_STD: 150,
  THREADED_ROD_MIN: 170,
  JIG_DATUM: 380,
  JIG_OG: 267 + 4,
  JIG_OUTER: 266,
  JIG_THREADED: 273,
  JIG_LIMIT: 170,
};

/**
 * @param {number} installMm - retracted install length (D1)
 * @param {number} strokeMm - stroke (D2)
 */
export function calcLa40Modifications(installMm, strokeMm) {
  const { HOLE_TO_SHAFT, SHAFT_END_OFFSET, THREADED_ROD_BASE, THREADED_ROD_STD, THREADED_ROD_MIN, JIG_DATUM } = LA40_CONSTANTS;

  const outerTubeMm = installMm - HOLE_TO_SHAFT - SHAFT_END_OFFSET;
  const shaftMm = outerTubeMm;
  const threadedRodMm = THREADED_ROD_BASE + strokeMm;
  const limitSwitchMm = strokeMm;
  const fullyExtendedMm = installMm + strokeMm;
  const threadedRodStdMm = THREADED_ROD_STD + strokeMm;
  const threadedRodMinMm = THREADED_ROD_MIN + strokeMm;
  const verifyInstallMm = shaftMm + SHAFT_END_OFFSET + HOLE_TO_SHAFT;

  const jigFromRef = (ref) => installMm - (JIG_DATUM - ref);

  return {
    installMm,
    strokeMm,
    outerTubeMm,
    shaftMm,
    threadedRodMm,
    limitSwitchMm,
    fullyExtendedMm,
    threadedRodStdMm,
    threadedRodMinMm,
    verifyInstallMm,
    jigPositions: {
      og: jigFromRef(LA40_CONSTANTS.JIG_OG),
      outer: jigFromRef(LA40_CONSTANTS.JIG_OUTER),
      threadedRod: jigFromRef(LA40_CONSTANTS.JIG_THREADED),
      limitSwitch: jigFromRef(LA40_CONSTANTS.JIG_LIMIT),
    },
    formulas: {
      outerTube: `Install − 94 − 18 = ${outerTubeMm} mm`,
      shaft: `Install − 94 − 18 = ${shaftMm} mm`,
      threadedRod: `61 + 25 + Stroke = ${threadedRodMm} mm`,
      limitSwitch: `Stroke = ${limitSwitchMm} mm`,
      fullyExtended: `Install + Stroke = ${fullyExtendedMm} mm`,
      threadedRodStd: `150 + Stroke = ${threadedRodStdMm} mm`,
      threadedRodMin: `Min 170 + Stroke = ${threadedRodMinMm} mm`,
    },
  };
}

export const LA40_COMPONENTS = [
  {
    id: 'outer',
    name: 'Outer tube',
    image: 'images/la40/outer-assembly.jpeg',
    lengthKey: 'outerTubeMm',
    formulaKey: 'outerTube',
    note: 'Overall outer housing length',
  },
  {
    id: 'threaded-rod',
    name: 'Threaded rod',
    image: 'images/la40/threaded-rod.jpeg',
    lengthKey: 'threadedRodMm',
    formulaKey: 'threadedRod',
    note: 'Min 170 + stroke · std 150 + stroke',
  },
  {
    id: 'shaft',
    name: 'Shaft',
    image: 'images/la40/tubes.jpeg',
    lengthKey: 'shaftMm',
    formulaKey: 'shaft',
    note: '94 mm = hole to shaft',
  },
  {
    id: 'limit-switch',
    name: 'Limit switch',
    image: 'images/la40/limit-switch.jpeg',
    lengthKey: 'limitSwitchMm',
    formulaKey: 'limitSwitch',
    note: '60 mm to start point',
  },
];
