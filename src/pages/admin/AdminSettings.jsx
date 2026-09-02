import { useEffect, useState } from 'react';
import {
  Settings,
  HardDrive,
  Upload,
  UserPlus,
  Save,
  RefreshCw,
  CheckCircle2,
  Database,
  ExternalLink,
  ShieldAlert,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/AdminToast';

export function AdminSettings() {
  const [settings, setSettings] = useState({
    storageLimitGb: 100,
    allowRegistrations: true,
    maxUploadSizeMb: 100,
    supabaseConfigured: false,
    bucketName: 'reedshelf-books'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await api.admin.getSettings();
      setSettings(data);
    } catch (err) {
      console.error('Failed to load settings:', err);
      toast.error('Unable to fetch platform settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await api.admin.updateSettings({
        storageLimitGb: Number(settings.storageLimitGb),
        allowRegistrations: Boolean(settings.allowRegistrations),
        maxUploadSizeMb: Number(settings.maxUploadSizeMb)
      });
      toast.success('Platform configuration updated and saved successfully.');
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error(err.message || 'Failed to save admin settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <RefreshCw className="animate-spin text-[#009689]" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Title */}
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
          Platform Settings
        </h1>
        <p className="mt-1 text-sm text-[#6b7a77] dark:text-white/60">
          Manage storage quotas, registration policies, and infrastructure thresholds.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Storage Capacity Quota Section */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a] space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#009689]/10 text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
              <HardDrive size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#0b1619] dark:text-white">
                Platform Storage Quota
              </h2>
              <p className="text-xs text-[#6b7a77] dark:text-white/50">
                Total storage allocation threshold for all uploaded digital volumes.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-[#0b1619] dark:text-white mb-1.5">
              Storage Capacity Limit (in GB):
            </label>
            <div className="flex items-center gap-3 max-w-xs">
              <input
                type="number"
                min="1"
                max="10000"
                step="1"
                value={settings.storageLimitGb}
                onChange={(e) => setSettings({ ...settings, storageLimitGb: e.target.value })}
                className="w-full rounded-xl border border-[#e4e1d6] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#0b1619] dark:text-white"
              />
              <span className="text-sm font-bold text-[#6b7a77] dark:text-white/60">GB</span>
            </div>
            <p className="mt-2 text-xs text-[#6b7a77] dark:text-white/50 leading-relaxed">
              When usage reaches 80%, 90%, and 95% of this capacity, warning alerts are displayed on the Admin Dashboard and in the navigation bar.
            </p>
          </div>
        </div>

        {/* Upload Limits */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a] space-y-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d6a84a]/10 text-[#b58b33] dark:bg-[#d6a84a]/20 dark:text-[#d6a84a]">
              <Upload size={20} />
            </span>
            <div>
              <h2 className="text-base font-bold text-[#0b1619] dark:text-white">
                Upload Restrictions
              </h2>
              <p className="text-xs text-[#6b7a77] dark:text-white/50">
                File size constraints for individual PDF uploads.
              </p>
            </div>
          </div>

          <div className="pt-2">
            <label className="block text-xs font-semibold text-[#0b1619] dark:text-white mb-1.5">
              Max File Size Per Book (in MB):
            </label>
            <div className="flex items-center gap-3 max-w-xs">
              <input
                type="number"
                min="5"
                max="500"
                step="5"
                value={settings.maxUploadSizeMb}
                onChange={(e) => setSettings({ ...settings, maxUploadSizeMb: e.target.value })}
                className="w-full rounded-xl border border-[#e4e1d6] bg-white px-3.5 py-2.5 text-sm font-semibold text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-[#0b1619] dark:text-white"
              />
              <span className="text-sm font-bold text-[#6b7a77] dark:text-white/60">MB</span>
            </div>
          </div>
        </div>

        {/* Registration Access */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#8b5cf6]/10 text-[#7c3aed] dark:bg-[#8b5cf6]/20 dark:text-[#a78bfa]">
                <UserPlus size={20} />
              </span>
              <div>
                <h2 className="text-base font-bold text-[#0b1619] dark:text-white">
                  Allow Public Registrations
                </h2>
                <p className="text-xs text-[#6b7a77] dark:text-white/50">
                  Control whether new readers can register accounts on Reedshelf.
                </p>
              </div>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.allowRegistrations}
                onChange={(e) => setSettings({ ...settings, allowRegistrations: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#e4e1d6] peer-focus:outline-hidden rounded-full peer dark:bg-white/20 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#009689]"></div>
            </label>
          </div>
        </div>

        {/* Infrastructure Information */}
        <div className="rounded-2xl border border-[#e4e1d6] bg-white p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a] space-y-3">
          <h2 className="text-base font-bold text-[#0b1619] dark:text-white flex items-center gap-2">
            <Database size={18} className="text-[#009689]" /> Storage Backend Information
          </h2>
          <div className="text-xs space-y-2 text-[#6b7a77] dark:text-white/60">
            <div className="flex justify-between py-1 border-b border-[#e4e1d6]/60 dark:border-white/5">
              <span>Storage Provider:</span>
              <span className="font-semibold text-[#0b1619] dark:text-white">
                Supabase S3-Compatible Cloud Storage
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-[#e4e1d6]/60 dark:border-white/5">
              <span>Storage Bucket:</span>
              <span className="font-semibold text-[#0b1619] dark:text-white">
                {settings.bucketName || 'reedshelf-books'}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span>Status:</span>
              <span className="inline-flex items-center gap-1 font-bold text-[#16a34a] dark:text-[#86efac]">
                <CheckCircle2 size={13} /> Connected & Operational
              </span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#009689] px-6 py-3 text-sm font-semibold text-white shadow-md hover:bg-[#007268] disabled:opacity-50 transition"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            Save Platform Settings
          </button>
        </div>
      </form>
    </div>
  );
}
