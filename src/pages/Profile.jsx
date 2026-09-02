import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Mail, Camera, Lock, Save, UserCircle, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { AppShell } from '../components/AppShell';
import { getCurrentUser, getUserBooks, getUserPlans, updateUser, fetchBooks, fetchPlans, api } from '../lib/appStore';

export function Profile() {
  const user = getCurrentUser();
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

  useEffect(() => {
    if (!user?.id) return;
    setBooks(getUserBooks(user.id));
    setPlans(getUserPlans(user.id));

    fetchBooks().then((b) => b && setBooks(b)).catch(() => {});
    fetchPlans().then((p) => p && setPlans(p)).catch(() => {});
  }, [user?.id]);

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
    </AppShell>
  );
}
