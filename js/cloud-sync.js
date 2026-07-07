import { getFileCloudConfig } from './cloud-config.js';

const CONFIG_KEY = 'linak_cloud_config_v1';
const BUCKET = 'test-setup-records';

export function getCloudConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
    const file = getFileCloudConfig();
    return {
      supabaseUrl: stored.supabaseUrl || file.supabaseUrl || '',
      supabaseAnonKey: stored.supabaseAnonKey || file.supabaseAnonKey || '',
      webhookUrl: stored.webhookUrl || file.webhookUrl || '',
      teamAccessCode: stored.teamAccessCode || file.teamAccessCode || '',
    };
  } catch {
    return { supabaseUrl: '', supabaseAnonKey: '', webhookUrl: '', teamAccessCode: '' };
  }
}

export function saveCloudConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify({
    supabaseUrl: String(config.supabaseUrl || '').trim(),
    supabaseAnonKey: String(config.supabaseAnonKey || '').trim(),
    webhookUrl: String(config.webhookUrl || '').trim(),
    teamAccessCode: String(config.teamAccessCode || '').trim(),
  }));
}

export function clearCloudConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

export function isCloudConfigured() {
  const config = getCloudConfig();
  if (config.webhookUrl) return true;
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.teamAccessCode);
}

export function isSupabaseConfigured() {
  const config = getCloudConfig();
  return Boolean(config.supabaseUrl && config.supabaseAnonKey && config.teamAccessCode);
}

function supabaseHeaders(config, extra = {}) {
  return {
    apikey: config.supabaseAnonKey,
    Authorization: `Bearer ${config.supabaseAnonKey}`,
    'x-team-access': config.teamAccessCode,
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

  if (!config.teamAccessCode && config.supabaseUrl) {
    throw new Error('Team access code is required for cloud upload.');
  }

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

export async function getSignedDownloadUrl(filePath) {
  const config = getCloudConfig();
  if (!config.supabaseUrl || !filePath || !config.teamAccessCode) return '';

  const res = await fetch(
    `${config.supabaseUrl}/storage/v1/object/sign/${BUCKET}/${filePath}`,
    {
      method: 'POST',
      headers: supabaseHeaders(config, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ expiresIn: 3600 }),
    }
  );

  if (!res.ok) {
    throw new Error(`Could not create download link (${res.status})`);
  }

  const data = await res.json();
  if (data.signedURL) {
    return data.signedURL.startsWith('http')
      ? data.signedURL
      : `${config.supabaseUrl}/storage/v1${data.signedURL}`;
  }
  if (data.signedUrl) return data.signedUrl;
  return '';
}

export function initCloudSyncUi({ $, on, showToast, escapeHtml }) {
  const urlInput = $('#cloud-supabase-url');
  const keyInput = $('#cloud-supabase-key');
  const teamInput = $('#cloud-team-code');
  const webhookInput = $('#cloud-webhook-url');
  const saveBtn = $('#cloud-save-config-btn');
  const clearBtn = $('#cloud-clear-config-btn');
  const statusEl = $('#cloud-config-status');
  const recordsWrap = $('#cloud-records-wrap');
  const recordsList = $('#cloud-records-list');
  const refreshBtn = $('#cloud-refresh-records-btn');

  function renderStatus() {
    if (!statusEl) return;
    const config = getCloudConfig();
    if (config.webhookUrl) {
      statusEl.textContent = 'Cloud upload: webhook configured (keys stored on this device only)';
      statusEl.className = 'cloud-config-status cloud-config-status-ok';
    } else if (isSupabaseConfigured()) {
      statusEl.textContent = 'Cloud upload: Supabase secured with team access code';
      statusEl.className = 'cloud-config-status cloud-config-status-ok';
    } else if (config.supabaseUrl || config.supabaseAnonKey) {
      statusEl.textContent = 'Add your team access code to enable uploads';
      statusEl.className = 'cloud-config-status cloud-config-status-error';
    } else {
      statusEl.textContent = 'Cloud upload not configured — files only save on this device';
      statusEl.className = 'cloud-config-status';
    }
  }

  function loadConfigIntoForm() {
    const config = getCloudConfig();
    if (urlInput) urlInput.value = config.supabaseUrl;
    if (keyInput) keyInput.value = config.supabaseAnonKey;
    if (teamInput) teamInput.value = config.teamAccessCode;
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

      recordsList.innerHTML = '';
      for (const row of rows) {
        const card = document.createElement('div');
        card.className = 'cloud-record-row';
        const when = row.created_at ? new Date(row.created_at).toLocaleString() : '—';
        card.innerHTML = `
          <div>
            <div class="cloud-record-id">${escapeHtml(row.id)}</div>
            <div class="cloud-record-meta">${escapeHtml(row.product_type || '—')} · ${escapeHtml(row.test_type || '—')}</div>
            <div class="cloud-record-meta">${escapeHtml(when)}</div>
          </div>
        `;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn primary cloud-record-download';
        btn.textContent = 'Download ZIP';
        btn.addEventListener('click', async () => {
          try {
            btn.disabled = true;
            btn.textContent = 'Preparing…';
            const url = await getSignedDownloadUrl(row.file_path);
            if (!url) throw new Error('No download URL');
            window.open(url, '_blank', 'noopener,noreferrer');
          } catch (err) {
            showToast(err.message || 'Download failed');
          } finally {
            btn.disabled = false;
            btn.textContent = 'Download ZIP';
          }
        });

        card.appendChild(btn);
        recordsList.appendChild(card);
      }
    } catch (err) {
      recordsList.innerHTML = `<p class="card-desc cloud-config-status-error">${escapeHtml(err.message || 'Could not load records')}</p>`;
    }
  }

  on(saveBtn, 'click', () => {
    saveCloudConfig({
      supabaseUrl: urlInput?.value,
      supabaseAnonKey: keyInput?.value,
      teamAccessCode: teamInput?.value,
      webhookUrl: webhookInput?.value,
    });
    loadConfigIntoForm();
    renderRecords();
    showToast('Cloud settings saved on this device only.');
  });

  on(clearBtn, 'click', () => {
    clearCloudConfig();
    if (urlInput) urlInput.value = '';
    if (keyInput) keyInput.value = '';
    if (teamInput) teamInput.value = '';
    if (webhookInput) webhookInput.value = '';
    loadConfigIntoForm();
    renderRecords();
    showToast('Cloud settings cleared from this device.');
  });

  on(refreshBtn, 'click', renderRecords);

  loadConfigIntoForm();
  renderRecords();

  const file = getFileCloudConfig();
  if (file.supabaseUrl && file.supabaseAnonKey && file.teamAccessCode && !localStorage.getItem(CONFIG_KEY)) {
    saveCloudConfig(file);
    loadConfigIntoForm();
    renderRecords();
  }

  return { refreshRecords: renderRecords, renderStatus };
}
