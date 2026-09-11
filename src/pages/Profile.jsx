import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  Mail,
  Camera,
  Lock,
  Save,
  UserCircle,
  CheckCircle,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Shield,
  Key,
  ArrowRight
} from 'lucide-react';
import { AppShell } from '../components/AppShell';
import {
  getCurrentUser,
  getUserBooks,
  getUserPlans,
  updateUser,
  fetchBooks,
  fetchPlans,
  setCurrentUser,
  api
} from '../lib/appStore';
import { TwoFactorSetupModal } from '../components/TwoFactorSetupModal';

export function Profile() {
  const user = getCurrentUser();
  const [currentUserData, setCurrentUserData] = useState(user);
  const [books, setBooks] = useState([]);
  const [plans, setPlans] = useState([]);
  const [name, setName] = useState(user?.name || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPass, setChangingPass] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState(false);
  const [disabling2FA, setDisabling2FA] = useState(false);
  const [setupKey, setSetupKey] = useState('');
  const [claimingAdmin, setClaimingAdmin] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    setBooks(getUserBooks(user.id));
    setPlans(getUserPlans(user.id));

    fetchBooks().then((b) => b && setBooks(b)).catch(() => {});
    fetchPlans().then((p) => p && setPlans(p)).catch(() => {});

    api.auth.getMe().then((res) => {
      if (res?.user) {
        setCurrentUserData(res.user);
        setCurrentUser(res.user);
      }
    }).catch(() => {});
  }, [user?.id]);

  const handleDisable2FA = async () => {
    if (!window.confirm('Are you sure you want to disable 2-Factor Authentication?')) return;
    setDisabling2FA(true);
    setError('');
    setMessage('');
    try {
      const res = await api.auth.disable2FA();
      if (res.user) {
        setCurrentUserData(res.user);
        setCurrentUser(res.user);
      }
      setMessage('Two-Factor Authentication has been disabled.');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to disable 2FA.');
    } finally {
      setDisabling2FA(false);
    }
  };

  const handleClaimAdmin = async (e) => {
    e.preventDefault();
    setClaimingAdmin(true);
    setError('');
    setMessage('');
    try {
      const res = await api.admin.claimAdmin({ setupKey: setupKey.trim() });
      if (res.user) {
        setCurrentUserData(res.user);
        setCurrentUser(res.user);
      }
      setMessage(res.message || 'Platform administrator privileges granted!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to claim administrator access.');
    } finally {
      setClaimingAdmin(false);
    }
  };

  const saveProfile = async () => {
    if (!user?.id) return;
    setSavingProfile(true);
    setError('');
    setMessage('');

    try {
      await updateUser(user.id, { name: name.trim() || user.name, avatar });
      setMessage('Profile updated successfully.');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const choose = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    if (f.size > 4 * 1024 * 1024) {
      setError('Photo must be 4MB or smaller.');
      return;
    }
    const r = new FileReader();
    r.onload = () => setAvatar(r.result);
    r.readAsDataURL(f);
  };

  const changePassword = async () => {
    if (!current || !next) {
      setError('Enter your current and new password.');
      return;
    }
    if (next.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    setChangingPass(true);
    setError('');
    setMessage('');

    try {
      await api.auth.changePassword({ currentPassword: current, newPassword: next });
      setCurrent('');
      setNext('');
      setMessage('Password changed successfully.');
      setTimeout(() => setMessage(''), 2500);
    } catch (err) {
      setError(err.message || 'Failed to change password. Please check your current password.');
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="mt-1 text-[#6b7a77] dark:text-white/60">
          Manage your identity, account details, and password.
        </p>

        {message && (
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#e6f4f2] p-4 text-sm font-semibold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
            <CheckCircle size={18} />
            {message}
          </div>
        )}

        {error && (
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#fff1ef] p-4 text-sm text-[#9b5147] dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle size={18} />
            {error}
          </div>
        )}

        <div className="mt-7 space-y-6">
          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-6 dark:border-white/10 dark:bg-[#142326] sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="relative">
                <div className="grid h-28 w-28 overflow-hidden rounded-full bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                  {avatar ? (
                    <img src={avatar} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <UserCircle className="m-auto" size={58} />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 cursor-pointer rounded-full bg-[#009689] p-2 text-white shadow hover:bg-[#007268]">
                  <Camera size={17} />
                  <input type="file" accept="image/*" onChange={choose} className="hidden" />
                </label>
              </div>
              <div>
                <h2 className="text-2xl font-bold">{user?.name || 'Reader'}</h2>
                <p className="mt-1 flex items-center gap-2 text-sm text-[#6b7a77] dark:text-white/60">
                  <Mail size={16} />
                  {user?.email || ''}
                </p>
              </div>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-sm font-semibold">Display name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-3 py-3 outline-none focus:border-[#009689] dark:border-white/10 dark:bg-white/5"
                />
              </label>
              <div className="rounded-xl bg-[#f6f4ee] p-4 dark:bg-white/5">
                <p className="text-xs text-[#7b8c84] dark:text-white/50">Member since</p>
                <p className="mt-1 font-semibold">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Today'}
                </p>
              </div>
            </div>

            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#009689] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#007268] disabled:opacity-50"
            >
              {savingProfile ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
              {savingProfile ? 'Saving...' : 'Save profile'}
            </button>
          </section>

          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-6 dark:border-white/10 dark:bg-[#142326] sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <Lock size={19} />
              </span>
              <div>
                <h2 className="font-bold">Password & security</h2>
                <p className="text-sm text-[#6b7a77] dark:text-white/60">
                  Change your password while you are signed in.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="Current password"
                className="rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-3 py-3 outline-none focus:border-[#009689] dark:border-white/10 dark:bg-white/5"
              />
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="New password (min 6 characters)"
                className="rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-3 py-3 outline-none focus:border-[#009689] dark:border-white/10 dark:bg-white/5"
              />
            </div>

            <button
              onClick={changePassword}
              disabled={changingPass}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#d5ddd1] px-5 py-3 text-sm font-semibold transition hover:bg-[#f6f4ee] disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
            >
              {changingPass ? <Loader2 size={17} className="animate-spin" /> : <Lock size={17} />}
              {changingPass ? 'Updating...' : 'Change password'}
            </button>
          </section>

          {/* Two-Factor Authenticator Card */}
          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-6 dark:border-white/10 dark:bg-[#142326] sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8] shrink-0">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-bold text-lg">Two-Factor Authenticator (TOTP)</h2>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        currentUserData?.two_factor_enabled
                          ? 'bg-[#dcfce7] text-[#166534] dark:bg-[#052e16] dark:text-[#86efac]'
                          : 'bg-black/5 text-[#6b7a77] dark:bg-white/10 dark:text-white/60'
                      }`}
                    >
                      {currentUserData?.two_factor_enabled ? 'Enabled (Active)' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[#6b7a77] dark:text-white/60 leading-relaxed">
                    Protect your account with a time-based 6-digit verification code from Google Authenticator, Microsoft Authenticator, or 1Password.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              {currentUserData?.two_factor_enabled ? (
                <button
                  onClick={handleDisable2FA}
                  disabled={disabling2FA}
                  className="inline-flex items-center gap-2 rounded-xl border border-[#fecaca] bg-white px-5 py-2.5 text-xs font-semibold text-[#dc2626] transition hover:bg-[#fee2e2] disabled:opacity-50 dark:border-[#7f1d1d] dark:bg-[#142326] dark:hover:bg-[#450a0a]"
                >
                  {disabling2FA ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                  Disable Authenticator
                </button>
              ) : (
                <button
                  onClick={() => setShow2FASetup(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#009689] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268]"
                >
                  <ShieldCheck size={15} />
                  Set Up Authenticator App
                </button>
              )}
            </div>
          </section>

          {/* Admin Console & Accounts Access */}
          <section className="rounded-3xl border border-[#e4e1d6] bg-white p-6 dark:border-white/10 dark:bg-[#142326] sm:p-8">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#fef3c7] text-[#92400e] dark:bg-[#451a03] dark:text-[#fcd34d] shrink-0">
                <Shield size={20} />
              </span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg">Platform Administration</h2>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      currentUserData?.role === 'admin'
                        ? 'bg-[#fef3c7] text-[#92400e] dark:bg-[#451a03] dark:text-[#fcd34d]'
                        : 'bg-black/5 text-[#6b7a77] dark:bg-white/10 dark:text-white/60'
                    }`}
                  >
                    {currentUserData?.role === 'admin' ? 'Administrator' : 'Standard User'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[#6b7a77] dark:text-white/60 leading-relaxed">
                  View and manage all registered user accounts, track storage allocations, and inspect reading analytics.
                </p>

                {currentUserData?.role === 'admin' ? (
                  <div className="mt-4">
                    <Link
                      to="/admin/users"
                      className="inline-flex items-center gap-2 rounded-xl bg-[#009689] px-5 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268]"
                    >
                      <span>View All Accounts in Admin Console</span>
                      <ArrowRight size={14} />
                    </Link>
                  </div>
                ) : (
                  <form onSubmit={handleClaimAdmin} className="mt-4 max-w-md space-y-2.5">
                    <p className="text-[11px] text-[#6b7a77] dark:text-white/50">
                      To view all registered accounts, claim the administrator role below:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder="Setup key (e.g. ReedshelfAdmin2026!)"
                        value={setupKey}
                        onChange={(e) => setSetupKey(e.target.value)}
                        className="flex-1 rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] px-3 py-2 text-xs outline-none focus:border-[#009689] dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                      <button
                        type="submit"
                        disabled={claimingAdmin}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] disabled:opacity-50 shrink-0"
                      >
                        {claimingAdmin ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                        <span>Claim Admin</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[#f6f4ee] p-5 dark:bg-white/5">
              <BookOpen className="text-[#009689]" />
              <p className="mt-4 text-3xl font-bold">{books.length}</p>
              <p className="text-sm text-[#6b7a77] dark:text-white/60">Books in library</p>
            </div>
            <div className="rounded-2xl bg-[#f6f4ee] p-5 dark:bg-white/5">
              <CalendarDays className="text-[#009689]" />
              <p className="mt-4 text-3xl font-bold">{plans.length}</p>
              <p className="text-sm text-[#6b7a77] dark:text-white/60">Reading plans</p>
            </div>
          </div>
        </div>
      </div>

      {show2FASetup && (
        <TwoFactorSetupModal
          isOpen={show2FASetup}
          onClose={() => setShow2FASetup(false)}
          onSuccess={(updatedUser) => {
            setShow2FASetup(false);
            if (updatedUser) {
              setCurrentUserData(updatedUser);
              setCurrentUser(updatedUser);
            }
            setMessage('Two-Factor Authentication is now enabled!');
            setTimeout(() => setMessage(''), 3000);
          }}
        />
      )}
    </AppShell>
  );
}
