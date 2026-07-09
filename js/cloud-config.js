/**
 * Default cloud config for simple onboarding.
 * Users only need to enter the team access code in-app.
 */
export const CLOUD_CONFIG = {
  supabaseUrl: 'https://awmwsatggebkiwqvqkfm.supabase.co',
  supabaseAnonKey: 'sb_publishable_82ypFWNaglD-kLejTMQYzg_ATAei93U',
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
