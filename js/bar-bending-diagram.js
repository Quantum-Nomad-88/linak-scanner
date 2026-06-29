/**
 * Live bent-bracket preview (SVG, auto-fitted to screen).
 */

function fmt(n) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function buildBentPoints(flanges, directions) {
  let x = 0;
  let y = 0;
  let angle = 0;
  const points = [{ x, y }];

  flanges.forEach((len, i) => {
    const length = Math.max(Number(len) || 0, 0);
    x += Math.cos(angle) * length;
    y -= Math.sin(angle) * length;
    points.push({ x, y });

    if (i < flanges.length - 1) {
      const dir = directions[i] === -1 ? -1 : 1;
      angle += dir * (Math.PI / 2);
    }
  });

  return points;
}

function segmentMidpoints(points) {
  const mids = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    mids.push({
      x: (points[i].x + points[i + 1].x) / 2,
      y: (points[i].y + points[i + 1].y) / 2,
    });
  }
  return mids;
}

function boundsFromPoints(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  });

  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const pad = Math.max(18, spanX * 0.18, spanY * 0.18);

  return {
    minX: minX - pad,
    minY: minY - pad,
    width: spanX + pad * 2,
    height: spanY + pad * 2,
  };
}

export function renderBarBendingDiagram(container, result) {
  if (!container) return;

  const flanges = (result?.flanges || []).filter((n) => Number(n) > 0);
  const directions = result?.foldDirections || [];

  if (!flanges.length) {
    container.innerHTML = '<p class="bend-preview-empty">Enter flange lengths to see the bent bracket preview.</p>';
    return;
  }

  const points = buildBentPoints(flanges, directions);
  const bounds = boundsFromPoints(points);
  const mids = segmentMidpoints(points);

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(' ');

  const labels = mids
    .map((mid, i) => {
      const dim = `<text x="${mid.x.toFixed(2)}" y="${(mid.y - 10).toFixed(2)}" class="bend-dim-label" text-anchor="middle">${fmt(flanges[i])} mm</text>`;
      if (i >= directions.length) return dim;
      const dir = directions[i] === -1 ? '-90' : '+90';
      const dirLabel = `<text x="${mid.x.toFixed(2)}" y="${(mid.y + 14).toFixed(2)}" class="bend-fold-label" text-anchor="middle">${dir}</text>`;
      return dim + dirLabel;
    })
    .join('');

  const joints = points
    .map((p) => `<circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="5" class="bend-joint" />`)
    .join('');

  container.innerHTML = `
    <svg
      class="bend-diagram-svg"
      viewBox="${bounds.minX.toFixed(2)} ${bounds.minY.toFixed(2)} ${bounds.width.toFixed(2)} ${bounds.height.toFixed(2)}"
      width="100%"
      height="300"
      role="img"
      aria-label="Bent bracket preview"
      preserveAspectRatio="xMidYMid meet"
    >
      <path d="${pathD}" class="bend-profile-path" />
      ${joints}
      ${labels}
    </svg>
  `;
}
