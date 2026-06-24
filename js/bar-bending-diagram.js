/**
 * Live SVG diagram for bent profile.
 */

function fmt(n) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function renderBentProfile(svg, result, width, height) {
  const sourceFlanges = result.activeFlanges || result.flanges || [];
  const flanges = sourceFlanges.length ? sourceFlanges : [1];
  const directions = result.foldDirections || [];
  const maxLeg = Math.max(...flanges, 1);
  const unit = (height * 0.55) / maxLeg;
  const originX = width * 0.12;
  const originY = height * 0.82;

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  let x = originX;
  let y = originY;
  let angle = 0;

  const points = [{ x, y }];
  flanges.forEach((len, i) => {
    const px = Math.cos(angle) * len * unit;
    const py = -Math.sin(angle) * len * unit;
    x += px;
    y += py;
    points.push({ x, y, len, fold: i });

    if (i < flanges.length - 1) {
      const dir = directions[i] === -1 ? -1 : 1;
      angle += dir * (Math.PI / 2);
    }
  });

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  path.setAttribute('d', d);
  path.setAttribute('class', 'bend-profile-path');
  g.appendChild(path);

  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', mx);
    label.setAttribute('y', my - 6);
    label.setAttribute('class', 'bend-dim-label');
    label.textContent = `${fmt(flanges[i])}`;
    g.appendChild(label);

    if (i < directions.length) {
      const bendDir = directions[i] === -1 ? '-90' : '+90';
      const dirLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dirLabel.setAttribute('x', mx);
      dirLabel.setAttribute('y', my + 12);
      dirLabel.setAttribute('class', 'bend-fold-label');
      dirLabel.textContent = bendDir;
      g.appendChild(dirLabel);
    }
  }

  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.setAttribute('x', width * 0.12);
  title.setAttribute('y', height * 0.14);
  title.setAttribute('class', 'bend-diagram-title');
  title.textContent = 'Bent profile (90° folds)';
  g.appendChild(title);

  svg.appendChild(g);
}

export function renderBarBendingDiagram(container, result) {
  if (!container) return;

  const width = container.clientWidth || 320;
  const height = 260;

  container.innerHTML = `
    <svg class="bend-diagram-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Bent bracket profile"></svg>
  `;
  renderBentProfile(container.querySelector('svg'), result, width, height);
}
