/**
 * Install length (built-in / retracted) calculations from LINAK data sheets.
 * BID = center-to-center when fully retracted.
 */

const FIXTURE_AB = new Set(['A', 'B', 'a', 'b']);

/**
 * Standard Careline / Medline bed actuator install dimensions.
 * @param {number} stroke - stroke in mm
 * @param {string|null} fixtureLetter - back fixture letter from type code (e.g. B, 5, A)
 */
export function carelineBuiltIn(stroke, fixtureLetter = null) {
  const isAB = fixtureLetter && FIXTURE_AB.has(fixtureLetter);

  if (stroke <= 115) return 288;

  if (stroke <= 250) return stroke + (isAB ? 176 : 173);
  if (stroke <= 300) return stroke + (isAB ? 195 : 192);
  return stroke + (isAB ? 215 : 212);
}

/** LA36: built-in = 200+S (<300) or 250+S (≥300), min 300 */
export function la36BuiltIn(stroke) {
  if (stroke < 300) return Math.max(300, 200 + stroke);
  return 250 + stroke;
}

/** LA12 small actuator */
export function la12BuiltIn(stroke) {
  return stroke + 120;
}

/**
 * @param {number} builtIn
 * @param {number} stroke
 */
export function fullyExtended(builtIn, stroke) {
  return builtIn + stroke;
}

export function formatInstallFormula(stroke, fixtureLetter, builtIn) {
  const isAB = fixtureLetter && FIXTURE_AB.has(fixtureLetter);
  if (stroke <= 115) return '288 mm (short stroke minimum)';
  if (stroke <= 250) return `S + ${isAB ? 176 : 173} = ${builtIn} mm`;
  if (stroke <= 300) return `S + ${isAB ? 195 : 192} = ${builtIn} mm`;
  return `S + ${isAB ? 215 : 212} = ${builtIn} mm`;
}
