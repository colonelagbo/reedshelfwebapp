import { useEffect, useState, useRef } from 'react';
import {
  Moon,
  Sun,
  Save,
  Check,
  Shield,
  Loader2,
  RefreshCw,
  Camera,
  Trash2,
  User,
  Mail,
  LayoutGrid,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import {
  getCurrentUser,
  getSettings,
  saveSettings,
  fetchSettings,
  fetchBooks,
  uploadAvatar,
  removeAvatar,
  updateUser,
  api
} from '../lib/appStore';

const Toggle = ({ value, onChange, label }) => (
  <button
    type="button"
    role="switch"
    aria-checked={value}
    aria-label={label}
    onClick={() => onChange(!value)}
    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#009689] focus:ring-offset-2 ${
      value ? 'bg-[#009689]' : 'bg-[#c9d6d2] dark:bg-white/20'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
        value ? 'translate-x-6' : 'translate-x-1'
      } top-1 absolute`}
    />
  </button>
);

export function Settings() {
  const initialUser = getCurrentUser();
  const [user, setUser] = useState(initialUser);
  const [name, setName] = useState(initialUser?.name || '');
  const [avatar, setAvatar] = useState(initialUser?.avatar || '');

  // User Profile States
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const fileInputRef = useRef(null);

  // Appearance & Shelf Settings States
  const initialSettings = getSettings(initialUser?.id);
  const [settings, setSettings] = useState(initialSettings);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // App Updates & Mobile Cache States
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateStatus, setUpdateStatus] = useState(null);

  // Refresh user data from cloud on mount
  useEffect(() => {
    api.auth.getMe().then((res) => {
      if (res?.user) {
        setUser(res.user);
        setName(res.user.name || '');
        setAvatar(res.user.avatar || '');
      }
    }).catch(() => {});

    const handleUserUpdate = (e) => {
      const u = e?.detail || getCurrentUser();
      if (u) {
        setUser(u);
        setName(u.name || '');
        setAvatar(u.avatar || '');
      }
    };
    window.addEventListener('reedshelf:user_updated', handleUserUpdate);
    return () => window.removeEventListener('reedshelf:user_updated', handleUserUpdate);
  }, []);

  // Fetch settings from server
  useEffect(() => {
    if (!user?.id) return;
    fetchSettings()
      .then((remote) => {
        if (remote) {
          setSettings(remote);
          document.documentElement.classList.toggle('dark', Boolean(remote.darkMode));
        }
      })
      .catch(() => {});
  }, [user?.id]);

  // Handle avatar file selection & cloud upload
  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please choose an image file (JPEG, PNG, WebP, or GIF).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileError('Photo must be 5MB or smaller.');
      return;
    }

    setUploadingAvatar(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const updatedUser = await uploadAvatar(file);
      if (updatedUser) {
        setUser(updatedUser);
        setAvatar(updatedUser.avatar);
        setProfileSuccess('Profile picture uploaded and saved to cloud.');
        setTimeout(() => setProfileSuccess(''), 3000);
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Remove profile picture
  const handleRemoveAvatar = async () => {
    if (!window.confirm('Remove your profile picture?')) return;
    setUploadingAvatar(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const updatedUser = await removeAvatar();
      if (updatedUser) {
        setUser(updatedUser);
        setAvatar('');
        setProfileSuccess('Profile picture removed.');
        setTimeout(() => setProfileSuccess(''), 3000);
      }
    } catch (err) {
      setProfileError(err.message || 'Failed to remove profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save profile name
  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    if (!user?.id) return;
    if (!name.trim()) {
      setProfileError('Display name cannot be empty.');
      return;
    }

    setSavingProfile(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const updatedUser = await updateUser(user.id, {
        name: name.trim(),
        avatar: avatar || null
      });
      setUser(updatedUser);
      setProfileSuccess('Profile saved successfully.');
      setTimeout(() => setProfileSuccess(''), 2500);
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile changes.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Save appearance settings
  const handleSaveSettings = async (newSettings = settings) => {
    if (!user?.id) return;
    setSavingSettings(true);

    try {
      await saveSettings(user.id, newSettings);
      document.documentElement.classList.toggle('dark', Boolean(newSettings.darkMode));
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSavingSettings(false);
    }
  };

  const updateSetting = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (key === 'darkMode') {
      document.documentElement.classList.toggle('dark', Boolean(value));
    }
    handleSaveSettings(next);
  };

  // Clear cache buster & update
  const handleForceUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateStatus('Clearing stale offline cache and syncing cloud data...');

    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          try {
            await reg.update();
            await reg.unregister();
          } catch (e) {
            console.warn('SW unregister notice:', e);
          }
        }
      }

      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map((key) => caches.delete(key)));
      }

      try {
        localStorage.removeItem('reedshelf_books_v1');
        await fetchBooks();
      } catch (err) {
        console.warn('Books re-fetch during cache clear:', err);
      }

      setUpdateStatus('Latest version ready! Reloading application...');
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
      }, 600);
    } catch (err) {
      console.error('Error clearing cache:', err);
      setUpdateStatus('Reloading application...');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl pb-16">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0b1619] dark:text-white tracking-tight">
            Settings
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#6b7a77] dark:text-white/60">
            Manage your profile picture, account details, shelf appearance, and device synchronization.
          </p>
        </div>

        <div className="space-y-6">
          {/* SECTION 1: Profile & Avatar Upload */}
          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-5 sm:p-7 shadow-xs dark:border-white/10 dark:bg-[#142326]">
            <div className="flex items-center justify-between border-b border-[#e4e1d6]/70 pb-4 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                  <User size={20} />
                </span>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-[#0b1619] dark:text-white">
                    Profile & Picture
                  </h2>
                  <p className="text-xs text-[#6b7a77] dark:text-white/60">
                    Your avatar and display name across ReedShelf
                  </p>
                </div>
              </div>

              {isAdmin && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#009689]/10 px-3 py-1 text-xs font-bold text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                  <Shield size={13} />
                  Administrator
                </span>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
              {/* Avatar Preview & Action */}
              <div className="relative group shrink-0">
                <div className="relative h-24 w-24 sm:h-28 sm:w-28 overflow-hidden rounded-full border-2 border-[#009689]/30 bg-[#e6f4f2] shadow-sm dark:border-white/20 dark:bg-[#0b1619]">
                  {uploadingAvatar ? (
                    <div className="grid h-full w-full place-items-center bg-black/40 text-white backdrop-blur-xs">
                      <Loader2 size={26} className="animate-spin text-[#009689]" />
                    </div>
                  ) : avatar ? (
                    <img
                      src={avatar}
                      alt={name || 'Profile'}
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      onError={() => setAvatar('')}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-[#007268] dark:text-[#5fc4b8]">
                      <User size={42} strokeWidth={1.5} />
                    </div>
                  )}
                </div>

                {/* Camera quick-tap button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-[#009689] text-white shadow-md transition hover:bg-[#007268] active:scale-95 disabled:opacity-50 cursor-pointer"
                  title="Upload profile picture"
                  aria-label="Upload profile picture"
                >
                  <Camera size={15} />
                </button>
              </div>

              {/* Photo Controls & Guidelines */}
              <div className="flex-1 text-center sm:text-left space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleAvatarFile}
                  className="hidden"
                />

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#009689] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] active:scale-95 disabled:opacity-50 cursor-pointer"
                  >
                    {uploadingAvatar ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Camera size={14} />
                        <span>{avatar ? 'Change Picture' : 'Upload Picture'}</span>
                      </>
                    )}
                  </button>

                  {avatar && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={uploadingAvatar}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 hover:border-red-300 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-[#6b7a77] dark:text-white/50">
                  Supported formats: JPG, PNG, WebP or GIF up to 5MB. Synchronizes to your phone and laptop automatically.
                </p>
              </div>
            </div>

            {/* Profile Success / Error Alerts */}
            {profileSuccess && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-500/20 dark:text-emerald-300">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>{profileSuccess}</span>
              </div>
            )}
            {profileError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:border-red-500/20 dark:text-red-300">
                <AlertCircle size={15} className="shrink-0 text-red-600 dark:text-red-400" />
                <span>{profileError}</span>
              </div>
            )}

            {/* Name & Email Fields */}
            <form onSubmit={handleSaveProfile} className="mt-6 space-y-4 border-t border-[#e4e1d6]/70 pt-5 dark:border-white/10">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/60 mb-1.5">
                    Display Name
                  </label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7a77] dark:text-white/40" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] pl-10 pr-4 py-2.5 text-sm font-medium text-[#0b1619] outline-none transition focus:border-[#009689] focus:ring-1 focus:ring-[#009689] dark:border-white/10 dark:bg-white/5 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/60 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7a77] dark:text-white/40" />
                    <input
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="w-full rounded-xl border border-[#e4e1d6] bg-[#f3f1e9]/60 pl-10 pr-4 py-2.5 text-sm font-medium text-[#6b7a77] opacity-80 cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:text-white/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingProfile || name.trim() === (user?.name || '')}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#009689] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  {savingProfile ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Saving Name...</span>
                    </>
                  ) : (
                    <>
                      <Save size={15} />
                      <span>Save Name</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>

          {/* SECTION 2: Appearance & Shelf View */}
          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-5 sm:p-7 shadow-xs dark:border-white/10 dark:bg-[#142326]">
            <div className="flex items-center gap-3 border-b border-[#e4e1d6]/70 pb-4 dark:border-white/10">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                {settings.darkMode ? <Moon size={20} /> : <Sun size={20} />}
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#0b1619] dark:text-white">
                  Appearance & Shelf Layout
                </h2>
                <p className="text-xs text-[#6b7a77] dark:text-white/60">
                  Soothing low-glare display and default library view
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-6">
              {/* Dark Mode Switch */}
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-sm text-[#0b1619] dark:text-white">
                    Dark mode
                  </p>
                  <p className="text-xs text-[#6b7a77] dark:text-white/60">
                    Use calm, high-contrast dark tones that reduce eye fatigue during reading sessions.
                  </p>
                </div>
                <Toggle
                  value={settings.darkMode}
                  onChange={(v) => updateSetting('darkMode', v)}
                  label="Toggle dark mode"
                />
              </div>

              {/* Shelf Default Layout */}
              <div className="border-t border-[#e4e1d6]/60 pt-5 dark:border-white/10">
                <div className="mb-3">
                  <p className="font-semibold text-sm text-[#0b1619] dark:text-white">
                    Default Library Layout
                  </p>
                  <p className="text-xs text-[#6b7a77] dark:text-white/60">
                    Choose how your books are arranged when you open your bookshelf.
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {[
                    { id: 'grid', label: 'Cover Grid', desc: 'Modern card grid' },
                    { id: 'shelf', label: 'Standing Shelf', desc: 'Wooden shelf display' },
                    { id: 'list', label: 'Compact List', desc: 'Minimal rows' },
                    { id: 'wide', label: 'Wide Covers', desc: 'Poster size view' },
                  ].map((option) => {
                    const isSelected = settings.libraryView === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateSetting('libraryView', option.id)}
                        className={`flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition cursor-pointer ${
                          isSelected
                            ? 'border-[#009689] bg-[#009689]/10 text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8] ring-1 ring-[#009689]'
                            : 'border-[#dfe5dc] bg-[#fbfcf9] text-[#6b7a77] hover:border-[#009689]/50 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70'
                        }`}
                      >
                        <LayoutGrid size={18} className="mb-1.5 opacity-80" />
                        <span className="text-xs font-bold leading-tight">{option.label}</span>
                        <span className="text-[10px] opacity-70 mt-0.5">{option.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Indicator */}
              {settingsSaved && (
                <div className="flex items-center gap-2 text-xs font-semibold text-[#009689] dark:text-[#5fc4b8] animate-in fade-in">
                  <Check size={14} />
                  <span>Preferences saved automatically</span>
                </div>
              )}
            </div>
          </section>

          {/* SECTION 3: App Updates & Mobile Cache */}
          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-5 sm:p-7 shadow-xs dark:border-white/10 dark:bg-[#142326]">
            <div className="flex items-center gap-3 border-b border-[#e4e1d6]/70 pb-4 dark:border-white/10">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <RefreshCw size={20} className={checkingUpdate ? 'animate-spin' : ''} />
              </span>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-[#0b1619] dark:text-white">
                  Cloud Sync & App Updates
                </h2>
                <p className="text-xs text-[#6b7a77] dark:text-white/60">
                  Keep your phone and computer in immediate sync with latest uploads
                </p>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-[#fbfcf9] p-4 border border-[#e4e1d6]/80 dark:bg-white/5 dark:border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#0b1619] dark:text-white">
                      Clear Cache & Force Reload
                    </span>
                    <span className="rounded-full bg-[#009689]/10 px-2 py-0.5 text-[10px] font-bold text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                      Cloud Synced
                    </span>
                  </div>
                  <p className="text-xs text-[#6b7a77] dark:text-white/60 max-w-md">
                    If any book or profile picture change does not immediately appear on your mobile phone or laptop, tap here to clear stale service-worker caches and fetch fresh assets.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleForceUpdate}
                  disabled={checkingUpdate}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#009689] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] active:scale-95 disabled:opacity-50 touch-manipulation cursor-pointer"
                >
                  {checkingUpdate ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>Syncing...</span>
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
                <div className="flex items-center gap-2 rounded-xl bg-[#e6f4f2] p-3 text-xs font-semibold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8] animate-in fade-in">
                  <RefreshCw size={14} className="animate-spin shrink-0" />
                  <span>{updateStatus}</span>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
export default Settings;
