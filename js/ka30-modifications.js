/**
 * KA30 shortening component lengths from desired install and stroke.
 *
 * Logic source: "Testing Calc (1).xlsx" -> "KA-30" sheet.
 */

export const KA30_CONSTANTS = {
  INSTALL_TO_OUTER_BODY: 102,
  INSTALL_TO_INNER_SHAFT: 112,
  INSTALL_TO_LEAD_SCREW: 60,
  STROKE_TO_LIMIT_SWITCH_OFFSET: -4,
};

/**
 * @param {number} installMm - desired retracted install length
 * @param {number} strokeMm - stroke
 */
export function calcKa30Modifications(installMm, strokeMm) {
  const {
    INSTALL_TO_OUTER_BODY,
    INSTALL_TO_INNER_SHAFT,
    INSTALL_TO_LEAD_SCREW,
    STROKE_TO_LIMIT_SWITCH_OFFSET,
  } = KA30_CONSTANTS;

  const outerBodyMm = installMm - INSTALL_TO_OUTER_BODY;
  const innerShaftMm = installMm - INSTALL_TO_INNER_SHAFT;
  const leadScrewMm = installMm - INSTALL_TO_LEAD_SCREW;
  const limitSwitchMm = strokeMm - STROKE_TO_LIMIT_SWITCH_OFFSET;
  const fullyExtendedMm = installMm + strokeMm;

  return {
    installMm,
    strokeMm,
    outerBodyMm,
    innerShaftMm,
    leadScrewMm,
    limitSwitchMm,
    fullyExtendedMm,
  };
}

export const KA30_COMPONENTS = [
  {
    id: 'outer-body',
    name: 'Outer body',
    lengthKey: 'outerBodyMm',
    note: 'Cut size = desired install - 102',
  },
  {
    id: 'inner-shaft',
    name: 'Inner shaft',
    lengthKey: 'innerShaftMm',
    note: 'Cut size = desired install - 112',
  },
  {
    id: 'lead-screw',
    name: 'Lead screw',
    lengthKey: 'leadScrewMm',
    note: 'Cut size = desired install - 60',
  },
  {
    id: 'limit-switch',
    name: 'Limit switch',
    lengthKey: 'limitSwitchMm',
    note: 'Cut size = stroke + 4',
  },
];
