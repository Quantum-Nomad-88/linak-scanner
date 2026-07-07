function pad2(n) {
  return String(n).padStart(2, '0');
}

export function buildRecordId(state) {
  const stamp = state.completedAt || new Date().toISOString();
  const date = new Date(stamp);
  const product = (state.productType || 'Setup').replace(/\s+/g, '');
  return `TS-${product}-${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

export function buildSetupRecord(state) {
  const testLabel = state.testType === 'Other' ? state.testTypeOther.trim() : state.testType;

  return {
    schemaVersion: 1,
    recordId: buildRecordId(state),
    exportedAt: new Date().toISOString(),
    completedAt: state.completedAt || null,
    productType: state.productType,
    testType: testLabel,
    cadVersion: state.cadVersion,
    actuators: state.actuators,
    loadApplied: state.loadApplied,
    loadTotalKg: state.loadTotalKg,
    weightDistribution: state.weightDistribution,
    scalesUsed: state.scalesUsed,
    dutyCycle: state.dutyCycle,
    cycleTimeNotes: state.cycleTimeNotes,
    countersQty: state.countersQty,
    coolingFanUsed: state.coolingFanUsed,
    testingStartedAt: state.testingStartedAt,
    photoCounts: {
      actuators: state.actuatorPhotos?.length || 0,
      load: state.loadPhotos?.length || 0,
      counters: state.counterPhotos?.length || 0,
      fan: state.coolingFanPhotos?.length || 0,
    },
  };
}

function escapeXml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rowHtml(label, value) {
  return `
    <tr>
      <td class="label">${escapeXml(label)}</td>
      <td class="value">${escapeXml(value || '—')}</td>
    </tr>
  `;
}

function photoSectionHtml(title, photos) {
  if (!photos?.length) {
    return `<h2>${escapeXml(title)}</h2><p class="muted">No photos captured.</p>`;
  }

  const images = photos.map((src, i) => `
    <div class="photo-block">
      <p class="photo-caption">${escapeXml(title)} — photo ${i + 1}</p>
      <img src="${src}" alt="${escapeXml(title)} ${i + 1}" width="480" />
    </div>
  `).join('');

  return `<h2>${escapeXml(title)}</h2>${images}`;
}

export function buildSetupWordHtml(state) {
  const record = buildSetupRecord(state);
  const title = `Test Setup Record — ${record.recordId}`;

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    body { font-family: Calibri, Arial, sans-serif; color: #1c1c1e; margin: 24px; }
    h1 { color: #c8102e; font-size: 22pt; margin-bottom: 6px; }
    .meta { color: #5c6570; font-size: 10pt; margin-bottom: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0 24px; }
    td { border: 1px solid #d8dde5; padding: 8px 10px; vertical-align: top; font-size: 11pt; }
    td.label { width: 34%; font-weight: bold; background: #f4f5f7; }
    h2 { font-size: 13pt; margin: 22px 0 10px; color: #1c1c1e; border-bottom: 2px solid #c8102e; padding-bottom: 4px; }
    .photo-block { margin: 12px 0 18px; page-break-inside: avoid; }
    .photo-caption { font-size: 10pt; color: #5c6570; margin-bottom: 6px; }
    img { max-width: 480px; height: auto; border: 1px solid #d8dde5; }
    .muted { color: #8b939e; font-size: 10pt; }
  </style>
</head>
<body>
  <h1>Test Setup Record</h1>
  <p class="meta">Record ID: ${escapeXml(record.recordId)}<br />
  Exported: ${escapeXml(new Date(record.exportedAt).toLocaleString())}<br />
  Testing started: ${escapeXml(record.testingStartedAt || '—')}</p>

  <h2>Setup details</h2>
  <table>
    ${rowHtml('Product', record.productType)}
    ${rowHtml('Test type', record.testType)}
    ${rowHtml('CAD version', record.cadVersion)}
    ${rowHtml('Actuators used', record.actuators)}
    ${rowHtml('Load applied', record.loadApplied)}
    ${rowHtml('Total weight (kg)', record.loadTotalKg)}
    ${rowHtml('Weight distribution', record.weightDistribution)}
    ${rowHtml('Scales used', record.scalesUsed)}
    ${rowHtml('Duty cycle / cycle time', record.dutyCycle)}
    ${rowHtml('Cycle notes', record.cycleTimeNotes)}
    ${rowHtml('Counters qty', record.countersQty)}
    ${rowHtml('Cooling fan applied', record.coolingFanUsed ? 'Yes' : 'No')}
    ${rowHtml('Testing started', record.testingStartedAt)}
  </table>

  ${photoSectionHtml('Actuator photos', state.actuatorPhotos)}
  ${photoSectionHtml('Load / scales photos', state.loadPhotos)}
  ${photoSectionHtml('Counter photos', state.counterPhotos)}
  ${state.coolingFanUsed ? photoSectionHtml('Cooling fan photo', state.coolingFanPhotos) : ''}
</body>
</html>`;
}

export function buildSetupFilename(state, extension) {
  const record = buildSetupRecord(state);
  const safeProduct = (state.productType || 'Setup').replace(/[^\w-]+/g, '-');
  return `${record.recordId}_${safeProduct}.${extension}`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function shareOrDownloadFile(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return true;
    } catch {
      /* fall through to download */
    }
  }
  downloadBlob(blob, filename);
  return true;
}

function addPhotosToZip(zip, folder, photos) {
  (photos || []).forEach((dataUrl, index) => {
    const base64 = String(dataUrl).split(',')[1];
    if (!base64) return;
    zip.file(`photos/${folder}-${index + 1}.jpg`, base64, { base64: true });
  });
}

let jsZipPromise;

function loadJSZip() {
  if (!jsZipPromise) {
    jsZipPromise = import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm').then((mod) => mod.default);
  }
  return jsZipPromise;
}

export async function downloadSetupZip(state) {
  const JSZip = await loadJSZip();
  const zip = new JSZip();
  const record = buildSetupRecord(state);
  const filename = buildSetupFilename(state, 'zip');

  zip.file('setup-record.json', JSON.stringify(record, null, 2));
  zip.file('setup-record.doc', '\ufeff' + buildSetupWordHtml(state));
  addPhotosToZip(zip, 'actuators', state.actuatorPhotos);
  addPhotosToZip(zip, 'load', state.loadPhotos);
  addPhotosToZip(zip, 'counters', state.counterPhotos);
  addPhotosToZip(zip, 'fan', state.coolingFanPhotos);

  const blob = await zip.generateAsync({ type: 'blob' });
  await shareOrDownloadFile(blob, filename, 'Test setup record');
  return filename;
}

export async function downloadSetupWord(state) {
  const html = buildSetupWordHtml(state);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
  await shareOrDownloadFile(blob, buildSetupFilename(state, 'doc'), 'Test setup record');
}

export function downloadSetupJson(state) {
  const json = JSON.stringify(buildSetupRecord(state), null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, buildSetupFilename(state, 'json'));
}

export async function saveSetupRecord(state) {
  return downloadSetupZip(state);
}
