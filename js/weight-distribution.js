export function parseWeightInput(raw) {
  const cleaned = String(raw || '').trim().replace(',', '.');
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

export function formatKg(value) {
  return `${value.toFixed(2)} kg`;
}

export function formatPlates(valueKg) {
  return `${(valueKg / 5).toFixed(2)} × 5 kg plates`;
}

export function getBedDistribution(totalKg) {
  return [
    { label: 'Backrest', pct: '45%', kg: totalKg * 0.45 },
    { label: 'Centre', pct: '25%', kg: totalKg * 0.25 },
    { label: 'Legrest', pct: '30%', kg: totalKg * 0.30 },
  ];
}

export function getSeatDistribution(totalKg) {
  return [
    { label: 'Backrest', pct: '58.75%', kg: totalKg * 0.5875 },
    { label: 'Seat', pct: '24.38%', kg: totalKg * 0.2438 },
    { label: 'Legrest', pct: '16.88%', kg: totalKg * 0.1688 },
  ];
}

export function getDistributionForProduct(productType, totalKg) {
  if (productType === 'Chair') return getSeatDistribution(totalKg);
  return getBedDistribution(totalKg);
}

export function formatDistributionSummary(rows) {
  return rows.map((row) => `${row.label} ${row.pct} (${formatKg(row.kg)}, ${formatPlates(row.kg)})`).join('\n');
}
