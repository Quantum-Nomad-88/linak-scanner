import { CLOUD_CONFIG } from './cloud-config.js';

const CONFIG_KEY = 'linak_cloud_config_v1';
const BUCKET = 'test-setup-records';

export function getCloudConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    return {
      supabaseUrl: stored.supabaseUrl || CLOUD_CONFIG.supabaseUrl || '',
      supabaseAnonKey: stored.supabaseAnonKey || CLOUD_CONFIG.supabaseAnonKey || '',
      webhookUrl: stored.webhookUrl || CLOUD_CONFIG.webhookUrl || '',
    };
  } catch {
    return { supabaseUrl: '', supabaseAnonKey: '', webhookUrl: '' };
  }
}

export function saveCloudConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({
    supabaseUrl: String(config.supabaseUrl || '').trim(),
    supabaseAnonKey: String(config.supabaseAnonKey || '').trim(),
    webhookUrl: String(config.webhookUrl || '').trim(),
  }));
}

export function isCloudConfigured() {
  const config = getCloudConfig();
  return Boolean(
    config.webhookUrl ||
    (config.supabaseUrl && config.supabaseAnonKey)
  );
}

export function isSupabaseConfigured() {
  const config = getCloudConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

function supabaseHeaders(config, extra = {}) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    ...extra,
  };
}

async function uploadViaWebhook(config, blob, filename, record) {
  const form = new FormData();
  form.append('file', blob, filename);
  form.append('recordId', record.recordId);
  form.append('productType', record.productType || '');
  form.append('testType', record.testType || '');
  form.append('metadata', JSON.stringify(record));

  const res = await fetch(config.webhookUrl, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Webhook upload failed (${res.status})`);
  }

  return { uploaded: true, via: 'webhook' };
}

async function uploadViaSupabase(config, blob, filename, record) {
  const path = `records/${filename}`;

  const uploadRes = await fetch(
    `${config.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`,
    {
      method: 'POST',
      headers: supabaseHeaders(config, {
        'Content-Type': 'application/zip',
        'x-upsert': 'true',
      }),
      body: blob,
    }
  );

  if (!uploadRes.ok) {
    const detail = await uploadRes.text();
    throw new Error(`Storage upload failed (${uploadRes.status}): ${detail}`);
  }

  const metaRes = await fetch(`${config.supabaseUrl}/rest/v1/setup_records`, {
    method: 'POST',
    headers: supabaseHeaders(config, {
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    }),
    body: JSON.stringify({
      id: record.recordId,
      product_type: record.productType,
      test_type: record.testType,
      testing_started_at: record.testingStartedAt,
      file_path: path,
    }),
  });

  if (!metaRes.ok) {
    const detail = await metaRes.text();
    throw new Error(`Record metadata failed (${metaRes.status}): ${detail}`);
  }

  return { uploaded: true, via: 'supabase', path };
}

export async function uploadSetupRecord(blob, filename, record) {
  const config = getCloudConfig();

  if (config.webhookUrl) {
    return uploadViaWebhook(config, blob, filename, record);
  }

  if (config.supabaseUrl && config.supabaseAnonKey) {
    return uploadViaSupabase(config, blob, filename, record);
  }

  return { uploaded: false, reason: 'not_configured' };
}

export async function listSetupRecords() {
  const config = getCloudConfig();
  if (!isSupabaseConfigured()) return [];

  const res = await fetch(
    `${config.supabaseUrl}/rest/v1/setup_records?select=*&order=created_at.desc`,
    { headers: supabaseHeaders(config) }
  );

  if (!res.ok) {
    throw new Error(`Could not load records (${res.status})`);
  }

  return res.json();
}

export function getRecordDownloadUrl(filePath) {
  const config = getCloudConfig();
  if (!config.supabaseUrl || !filePath) return '';
  return `${config.supabaseUrl}/storage/v1/object/public/${BUCKET}/${filePath}`;
}

export function initCloudSyncUi({ $, on, showToast, escapeHtml }) {
  const urlInput = $('#cloud-supabase-url');
  const keyInput = $('#cloud-supabase-key');
  const webhookInput = $('#cloud-webhook-url');
  const saveBtn = $('#cloud-save-config-btn');
  const statusEl = $('#cloud-config-status');
  const recordsWrap = $('#cloud-records-wrap');
  const recordsList = $('#cloud-records-list');
  const refreshBtn = $('#cloud-refresh-records-btn');

  function renderStatus() {
    if (!statusEl) return;
    const config = getCloudConfig();
    if (config.webhookUrl) {
      statusEl.textContent = 'Cloud upload: OneDrive / webhook configured';
      statusEl.className = 'cloud-config-status cloud-config-status-ok';
    } else if (config.supabaseUrl && config.supabaseAnonKey) {
      statusEl.textContent = 'Cloud upload: Supabase configured';
      statusEl.className = 'cloud-config-status cloud-config-status-ok';
    } else {
      statusEl.textContent = 'Cloud upload not configured — files only save on this device';
      statusEl.className = 'cloud-config-status';
    }
  }

  function loadConfigIntoForm() {
    const config = getCloudConfig();
    if (urlInput) urlInput.value = config.supabaseUrl;
    if (keyInput) keyInput.value = config.supabaseAnonKey;
    if (webhookInput) webhookInput.value = config.webhookUrl;
    renderStatus();
  }

  async function renderRecords() {
    if (!recordsList || !recordsWrap) return;

    if (!isSupabaseConfigured()) {
      recordsWrap.classList.add('hidden');
      return;
    }

    recordsWrap.classList.remove('hidden');
    recordsList.innerHTML = '<p class="card-desc">Loading records…</p>';

    try {
      const rows = await listSetupRecords();
      if (!rows.length) {
        recordsList.innerHTML = '<p class="card-desc">No records on the server yet.</p>';
        return;
      }

      recordsList.innerHTML = rows.map((row) => {
        const url = getRecordDownloadUrl(row.file_path);
        const when = row.created_at ? new Date(row.created_at).toLocaleString() : '—';
        return `
          <div class="cloud-record-row">
            <div>
              <div class="cloud-record-id">${escapeHtml(row.id)}</div>
              <div class="cloud-record-meta">${escapeHtml(row.product_type || '—')} · ${escapeHtml(row.test_type || '—')}</div>
              <div class="cloud-record-meta">${escapeHtml(when)}</div>
            </div>
            ${url ? `<a class="btn primary cloud-record-download" href="${escapeHtml(url)}" download>Download ZIP</a>` : ''}
          </div>
        `;
      }).join('');
    } catch (err) {
      recordsList.innerHTML = `<p class="card-desc cloud-config-status-error">${escapeHtml(err.message || 'Could not load records')}</p>`;
    }
  }

  on(saveBtn, 'click', () => {
    saveCloudConfig({
      supabaseUrl: urlInput?.value,
      supabaseAnonKey: keyInput?.value,
      webhookUrl: webhookInput?.value,
    });
    loadConfigIntoForm();
    renderRecords();
    showToast('Cloud settings saved.');
  });

  on(refreshBtn, 'click', renderRecords);

  loadConfigIntoForm();
  renderRecords();

  if (isCloudConfigured() && !localStorage.getItem(CONFIG_KEY)) {
    saveCloudConfig(getCloudConfig());
    loadConfigIntoForm();
  }

  return { refreshRecords: renderRecords, renderStatus };
}
