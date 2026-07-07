/**
 * Default cloud config — no secrets here.
 * - Production: enter URL, key, and team code in the app (stored on device only).
 * - Local dev: copy cloud-config.example.js → cloud-config.local.js (gitignored).
 */
export const CLOUD_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  webhookUrl: '',
  teamAccessCode: '',
};

let fileConfig = { ...CLOUD_CONFIG };

export async function initFileCloudConfig() {
  try {
    const mod = await import('./cloud-config.local.js');
    if (mod?.CLOUD_CONFIG) {
      fileConfig = { ...CLOUD_CONFIG, ...mod.CLOUD_CONFIG };
    }
  } catch {
    fileConfig = { ...CLOUD_CONFIG };
  }
  return fileConfig;
}

export function getFileCloudConfig() {
  return fileConfig;
}
