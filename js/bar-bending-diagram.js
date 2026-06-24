/**
 * Live SVG diagrams for flat pattern and bent profile.
 */

function fmt(n) {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function scaleSegments(values, maxWidth) {
  const total = values.reduce((s, v) => s + v, 0) || 1;
  const padding = 24;
  const usable = maxWidth - padding * 2;
  return {
    total,
    padding,
    segments: values.map((v) => (v / total) * usable),
  };
}

function renderFlatPattern(svg, result, width, height) {
  const sourceFlanges = result.activeFlanges || result.flanges || [];
  const flanges = sourceFlanges.length ? sourceFlanges : [1];
  const { padding, segments } = scaleSegments(flanges, width);
  const barH = 18;
  const y = height * 0.38;
  let x = padding;

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

  segments.forEach((w, i) => {
    const flange = flanges[i];
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', Math.max(w, 2));
    rect.setAttribute('height', barH);
    rect.setAttribute('class', 'bend-bar-segment');
    g.appendChild(rect);

    if (w > 28) {
      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      label.setAttribute('x', x + w / 2);
      label.setAttribute('y', y + barH / 2 + 4);
      label.setAttribute('class', 'bend-dim-label');
      label.textContent = `${fmt(flange)}`;
      g.appendChild(label);
    }

    if (i < segments.length - 1 && w > 0) {
      const fold = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      fold.setAttribute('x1', x + w);
      fold.setAttribute('y1', y - 8);
      fold.setAttribute('x2', x + w);
      fold.setAttribute('y2', y + barH + 8);
      fold.setAttribute('class', 'bend-fold-line');
      g.appendChild(fold);

      const foldLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      foldLabel.setAttribute('x', x + w);
      foldLabel.setAttribute('y', y - 12);
      foldLabel.setAttribute('class', 'bend-fold-label');
      foldLabel.textContent = `F${i + 1}`;
      g.appendChild(foldLabel);
    }

    x += w;
  });

  const totalLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  totalLine.setAttribute('x1', padding);
  totalLine.setAttribute('y1', y + barH + 22);
  totalLine.setAttribute('x2', padding + segments.reduce((s, w) => s + w, 0));
  totalLine.setAttribute('y2', y + barH + 22);
  totalLine.setAttribute('class', 'bend-total-line');
  g.appendChild(totalLine);

  const totalLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  totalLabel.setAttribute('x', padding + segments.reduce((s, w) => s + w, 0) / 2);
  totalLabel.setAttribute('y', y + barH + 38);
  totalLabel.setAttribute('class', 'bend-total-label');
  totalLabel.textContent = `Cut ${fmt(result.cutLength)} mm`;
  g.appendChild(totalLabel);

  svg.appendChild(g);
}

function renderBentProfile(svg, result, width, height) {
  const sourceFlanges = result.activeFlanges || result.flanges || [];
  const flanges = sourceFlanges.length ? sourceFlanges : [1];
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
      angle += Math.PI / 2;
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
  const height = 220;

  container.innerHTML = `
    <svg class="bend-diagram-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" role="img" aria-label="Bar bending diagram">
      <text x="${width / 2}" y="18" class="bend-diagram-title" text-anchor="middle">Flat pattern</text>
    </svg>
  `;

  const svg = container.querySelector('svg');
  renderFlatPattern(svg, result, width, height * 0.52);

  const bentWrap = document.createElement('div');
  bentWrap.className = 'bend-diagram-bent';
  bentWrap.innerHTML = `
    <svg class="bend-diagram-svg" viewBox="0 0 ${width} ${height}" width="100%" height="${height}" aria-hidden="true"></svg>
  `;
  container.appendChild(bentWrap);
  renderBentProfile(bentWrap.querySelector('svg'), result, width, height);
}
