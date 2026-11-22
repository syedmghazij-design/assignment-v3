export const APP_VERSION = 'v1.3';

export const SUPABASE_HOST = String(process.env.NEXT_PUBLIC_SUPABASE_URL || '')
  .replace(/^https?:\/\//, '')
  .replace(/\/$/, '');

export const KEY_KIND = (() => {
  const k = String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
  if (k.startsWith('sb_publishable_')) return 'publishable';
  if (k.startsWith('eyJ')) return 'anon-jwt';
  return k ? 'unknown' : 'missing';
})();
