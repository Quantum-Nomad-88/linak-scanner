/**
 * Image rotation for upside-down or sideways label photos.
 */

export const SCAN_ORIENTATIONS = [0, 180];

/**
 * @param {HTMLCanvasElement} source
 * @param {0|90|180|270} degrees
 */
export function rotateCanvas(source, degrees) {
  if (!degrees) return source;

  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  const rad = (degrees * Math.PI) / 180;

  if (degrees === 180) {
    out.width = source.width;
    out.height = source.height;
    ctx.translate(out.width, out.height);
    ctx.rotate(Math.PI);
    ctx.drawImage(source, 0, 0);
    return out;
  }

  out.width = degrees === 90 || degrees === 270 ? source.height : source.width;
  out.height = degrees === 90 || degrees === 270 ? source.width : source.height;

  if (degrees === 90) {
    ctx.translate(out.width, 0);
    ctx.rotate(rad);
  } else {
    ctx.translate(0, out.height);
    ctx.rotate(rad);
  }
  ctx.drawImage(source, 0, 0);
  return out;
}
