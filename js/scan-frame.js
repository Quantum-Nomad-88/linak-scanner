/**
 * Camera mask regions (fractions of image width/height).
 * Tuned for LINAK labels — type code is the first spec row on the right.
 */

/** Wide strip for a single type-code line e.g. 27210B+1130504A */
export const TYPE_CODE_MASK = {
  x: 0.04,
  y: 0.30,
  w: 0.92,
  h: 0.14,
  label: 'Align the Type code in the box',
};

/** Full sticker area for all label fields */
export const FULL_LABEL_MASK = {
  x: 0.04,
  y: 0.10,
  w: 0.92,
  h: 0.72,
  label: 'Fit the whole sticker in the box',
};

export function getMaskForMode(mode) {
  return mode === 'full' ? FULL_LABEL_MASK : TYPE_CODE_MASK;
}

/**
 * Crop canvas to mask region.
 * @param {HTMLCanvasElement} source
 * @param {{ x: number, y: number, w: number, h: number }} mask
 */
export function cropToMask(source, mask) {
  const sx = Math.floor(source.width * mask.x);
  const sy = Math.floor(source.height * mask.y);
  const sw = Math.max(1, Math.floor(source.width * mask.w));
  const sh = Math.max(1, Math.floor(source.height * mask.h));
  const out = document.createElement('canvas');
  out.width = sw;
  out.height = sh;
  out.getContext('2d').drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return out;
}
