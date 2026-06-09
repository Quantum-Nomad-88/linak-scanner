/**
 * Camera mask regions (fractions of image width/height).
 * Tuned for LINAK labels — type code is the first spec row on the right.
 */

/**
 * Tight crop — right column Type value only (skips "Type:" label and rows below).
 * e.g. 27210B+1130504A or 300402000D0MC26+1011AA149060E
 */
export const TYPE_CODE_MASK = {
  x: 0.36,
  y: 0.275,
  w: 0.60,
  h: 0.065,
  label: 'Line up the Type code only (right side)',
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
export function maskRect(width, height, mask) {
  return {
    x: Math.floor(width * mask.x),
    y: Math.floor(height * mask.y),
    w: Math.max(1, Math.floor(width * mask.w)),
    h: Math.max(1, Math.floor(height * mask.h)),
  };
}

/**
 * Draw darkened mask + blue scan box on a canvas (visible on all mobile browsers).
 * @param {CanvasRenderingContext2D} ctx
 */
export function drawMaskOverlay(ctx, width, height, mask) {
  const r = maskRect(width, height, mask);
  const shade = 'rgba(0, 0, 0, 0.65)';

  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, r.y);
  ctx.fillRect(0, r.y + r.h, width, height - r.y - r.h);
  ctx.fillRect(0, r.y, r.x, r.h);
  ctx.fillRect(r.x + r.w, r.y, width - r.x - r.w, r.h);

  const line = Math.max(3, Math.round(width * 0.004));
  ctx.strokeStyle = '#0088ee';
  ctx.lineWidth = line;
  ctx.strokeRect(r.x + line / 2, r.y + line / 2, r.w - line, r.h - line);

  const corner = Math.min(24, Math.round(r.w * 0.07));
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = Math.max(3, Math.round(width * 0.005));
  ctx.lineCap = 'square';

  function cornerMark(x, y, dx, dy) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx * corner, y);
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + dy * corner);
    ctx.stroke();
  }

  cornerMark(r.x, r.y, 1, 1);
  cornerMark(r.x + r.w, r.y, -1, 1);
  cornerMark(r.x, r.y + r.h, 1, -1);
  cornerMark(r.x + r.w, r.y + r.h, -1, -1);

  const fontSize = Math.max(14, Math.round(height * 0.028));
  ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = 4;
  ctx.fillText(mask.label, width / 2, Math.min(height - 8, r.y + r.h + fontSize + 10));
  ctx.shadowBlur = 0;

  return r;
}

export function cropToMask(source, mask) {
  const r = maskRect(source.width, source.height, mask);
  const out = document.createElement('canvas');
  out.width = r.w;
  out.height = r.h;
  out.getContext('2d').drawImage(source, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return out;
}
