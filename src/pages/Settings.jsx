import { useEffect, useState } from 'react';
import { Moon, Save, Type, Check, Shield, Loader2, RefreshCw } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { getCurrentUser, getSettings, saveSettings, fetchSettings, fetchBooks } from '../lib/appStore';

const Toggle = ({ value, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`relative h-7 w-12 rounded-full transition ${value ? 'bg-[#009689]' : 'bg-[#c9d6d2]'}`}
  >
    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${value ? 'left-6' : 'left-1'}`} />
  </button>
);

export function Settings() {
  const user = getCurrentUser();
  const initial = getSettings(user?.id);
  const [s, setS] = useState(initial);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);

  const handleForceUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus('Clearing stale cache and checking for updates...');

    try {
      // 1. Unregister and update service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          try {
            await reg.update();
            await reg.unregister();
          } catch (e) {
            console.warn('SW unregister error:', e);
          }
        }
      }

      // 2. Clear all Workbox and browser CacheStorage
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      // 3. Clear local books cache and re-fetch from cloud
      try {
        localStorage.removeItem('reedshelf_books_v1');
        await fetchBooks();
      } catch (err) {
        console.warn('Books re-fetch during cache clear:', err);
      }

      setUpdateStatus('Latest version ready! Reloading...');
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
      }, 600);
    } catch (err) {
      console.error('Error clearing cache:', err);
      setUpdateStatus('Reloading...');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchSettings().then((remoteSettings) => {
      if (remoteSettings) {
        setS(remoteSettings);
        document.documentElement.classList.toggle('dark', Boolean(remoteSettings.darkMode));
      }
    }).catch(() => {});
  }, [user?.id]);

  const update = (k, v) => setS((x) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!user?.id) return;
    setSaving(true);

    try {
      await saveSettings(user.id, s);
      document.documentElement.classList.toggle('dark', Boolean(s.darkMode));
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-[#6b7a77] dark:text-white/60">
          Tune ReedShelf for comfortable reading and account safety.
        </p>

        <div className="mt-7 space-y-5">
          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-6 dark:border-white/10 dark:bg-[#142326]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <Moon size={19} />
              </span>
              <div>
                <h2 className="font-bold">Appearance</h2>
                <p className="text-sm text-[#6b7a77] dark:text-white/60">
                  Low-glare colors for daytime and night reading.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Dark mode</p>
                  <p className="text-sm text-[#6b7a77] dark:text-white/60">Use the softer dark palette.</p>
                </div>
                <Toggle value={s.darkMode} onChange={(v) => update('darkMode', v)} />
              </div>

              <div>
                <p className="font-semibold">Library default view</p>
                <select
                  value={s.libraryView}
                  onChange={(e) => update('libraryView', e.target.value)}
                  className="mt-2 w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-3 py-3 outline-none focus:border-[#009689] dark:border-white/10 dark:bg-white/5"
                >
                  <option value="grid">Cover grid</option>
                  <option value="shelf">Standing shelf</option>
                  <option value="list">Compact list</option>
                  <option value="wide">Wide covers</option>
                </select>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-6 dark:border-white/10 dark:bg-[#142326]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <Type size={19} />
              </span>
              <div>
                <h2 className="font-bold">Reader</h2>
                <p className="text-sm text-[#6b7a77] dark:text-white/60">Set defaults for reading comfort.</p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">Reader text size</span>
                <input
                  type="number"
                  min="14"
                  max="26"
                  value={s.fontSize}
                  onChange={(e) => update('fontSize', Number(e.target.value))}
                  className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-3 py-3 outline-none focus:border-[#009689] dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-semibold">Line height</span>
                <select
                  value={s.lineHeight}
                  onChange={(e) => update('lineHeight', Number(e.target.value))}
                  className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-3 py-3 outline-none focus:border-[#009689] dark:border-white/10 dark:bg-white/5"
                >
                  <option value="1.5">Compact</option>
                  <option value="1.75">Comfortable</option>
                  <option value="2">Relaxed</option>
                </select>
              </label>
            </div>

            <div className="mt-5 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Auto-save reading progress</p>
                  <p className="text-sm text-[#6b7a77] dark:text-white/60">Remember your last page automatically.</p>
                </div>
                <Toggle value={s.autoSave} onChange={(v) => update('autoSave', v)} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Show page numbers</p>
                  <p className="text-sm text-[#6b7a77] dark:text-white/60">Keep page navigation visible.</p>
                </div>
                <Toggle value={s.showPageNumbers} onChange={(v) => update('showPageNumbers', v)} />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-6 dark:border-white/10 dark:bg-[#142326]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <Shield size={19} />
              </span>
              <div>
                <h2 className="font-bold">Privacy & account</h2>
                <p className="text-sm text-[#6b7a77] dark:text-white/60">Control account and reader interaction.</p>
              </div>
            </div>

            <div className="mt-6 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Confirm sign out</p>
                  <p className="text-sm text-[#6b7a77] dark:text-white/60">Ask before ending your session.</p>
                </div>
                <Toggle value={s.confirmSignOut} onChange={(v) => update('confirmSignOut', v)} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">Keyboard shortcuts</p>
                  <p className="text-sm text-[#6b7a77] dark:text-white/60">Enable reader keyboard navigation.</p>
                </div>
                <Toggle value={s.keyboardShortcuts} onChange={(v) => update('keyboardShortcuts', v)} />
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-6 dark:border-white/10 dark:bg-[#142326]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <RefreshCw size={19} className={checkingUpdate ? "animate-spin" : ""} />
              </span>
              <div>
                <h2 className="font-bold">App Updates & Mobile Cache</h2>
                <p className="text-sm text-[#6b7a77] dark:text-white/60">
                  Ensure your phone or computer is displaying the newest ReedShelf features and synced cloud data.
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-[#fbfcf9] p-4 border border-[#e4e1d6]/70 dark:bg-white/5 dark:border-white/10">
                <div>
                  <p className="font-semibold text-sm text-[#0b1619] dark:text-white flex items-center gap-2">
                    <span>Cloud Sync & Latest Build</span>
                    <span className="rounded-full bg-[#009689]/10 px-2 py-0.5 text-[11px] font-bold text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                      Active
                    </span>
                  </p>
                  <p className="text-xs text-[#6b7a77] dark:text-white/60 mt-0.5">
                    Tap to clear stale mobile service-worker caches, download the newest bundle, and resync your library.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleForceUpdate}
                  disabled={checkingUpdate}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#009689] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] disabled:opacity-50 touch-manipulation cursor-pointer"
                >
                  {checkingUpdate ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw size={15} />
                      <span>Clear Cache & Reload</span>
                    </>
                  )}
                </button>
              </div>

              {updateStatus && (
                <div className="rounded-xl bg-[#e6f4f2] p-3 text-xs font-semibold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8] animate-in fade-in">
                  {updateStatus}
                </div>
              )}
            </div>
          </section>

          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#009689] px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268] disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 size={17} className="animate-spin" /> Saving...
              </>
            ) : saved ? (
              <>
                <Check size={17} /> Settings Saved
              </>
            ) : (
              <>
                <Save size={17} /> Save settings
              </>
            )}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
