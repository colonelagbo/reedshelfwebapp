import { useEffect, useState } from 'react';
import { Moon, Save, Type, Check, Shield, Loader2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { getCurrentUser, getSettings, saveSettings, fetchSettings } from '../lib/appStore';

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
