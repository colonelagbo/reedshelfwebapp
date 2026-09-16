import { createClient } from '@supabase/supabase-js';

export const DEFAULT_SUPABASE_URL = 'https://xiiemdxbdrlzpvhaecmt.supabase.co';
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
  const url =
    import.meta.env.VITE_SUPABASE_URL ||
    (typeof window !== 'undefined' ? localStorage.getItem('reedshelf_supabase_url') : '') ||
    DEFAULT_SUPABASE_URL;
  const key =
    import.meta.env.VITE_SUPABASE_KEY ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    getStoredKey();
  return {
    url,
    key,
    bucket: import.meta.env.VITE_SUPABASE_BUCKET || DEFAULT_SUPABASE_BUCKET,
    isConfigured: Boolean(url && key && !url.includes('placeholder')),
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


