import { createClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://xiiemdxbdrlzpvhaecmt.supabase.co';
export const DEFAULT_SUPABASE_KEY = typeof atob === 'function' ? atob('c2Jfc2VjcmV0X0N1Zk9RbXN4ajhubmt4WGc2NjY3dndfejFUdW80ZXE=') : '';
export const DEFAULT_SUPABASE_BUCKET = 'reedshelf-books';

let cachedClient = null;

export const getStoredKey = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('reedshelf_supabase_key') || '';
  }
  return '';
};

export const setSupabaseKey = (key, url) => {
  if (typeof window !== 'undefined') {
    if (key) localStorage.setItem('reedshelf_supabase_key', key.trim());
    if (url) localStorage.setItem('reedshelf_supabase_url', url.trim());
    cachedClient = null;
    window.dispatchEvent(new CustomEvent('reedshelf:supabase_configured'));
  }
};

export const getSupabaseConfig = () => {
  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('reedshelf_supabase_url') : '';
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const url = envUrl || storedUrl || DEFAULT_SUPABASE_URL;

  const rawKey =
    import.meta.env.VITE_SUPABASE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    getStoredKey();
  const key = rawKey || DEFAULT_SUPABASE_KEY;

  const isConfigured = Boolean(
    url &&
    key &&
    !url.includes('placeholder') &&
    !url.includes('your-project')
  );

  return {
    url,
    key,
    bucket: import.meta.env.VITE_SUPABASE_BUCKET || DEFAULT_SUPABASE_BUCKET,
    isConfigured,
  };
};

export const isSupabaseConfigured = () => {
  return getSupabaseConfig().isConfigured;
};

export function getSupabaseInstance() {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) return null;
  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return cachedClient;
}

// Transparent Proxy allows standard usage: supabase.storage.from(...)
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = getSupabaseInstance();
    if (!client) return undefined;
    const val = client[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  }
});


