import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { getCurrentUser, logoutUser, setCurrentUser } from '../../lib/appStore';
import { authStorage, api } from '../../lib/api';
import { ShieldAlert, ArrowLeft, LogOut, Key, CheckCircle, Loader2 } from 'lucide-react';
import { LogoPlaceholder } from '../../components/LogoPlaceholder';
import { ThemeToggle } from '../../components/ThemeToggle';

export function AdminForbidden({ user }) {
  const [setupKey, setSetupKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogout = () => {
    logoutUser();
    window.location.href = '/sign-in?redirect=/admin';
  };

  const handleClaimAdmin = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await api.admin.claimAdmin({ setupKey: setupKey.trim() });
      if (res.user) {
        setCurrentUser(res.user);
      }
      setSuccess('Administrator access granted! Redirecting to user accounts...');
      setTimeout(() => {
        window.location.href = '/admin/users';
      }, 800);
    } catch (err) {
      setError(err.message || 'Failed to claim administrator access. Check your setup key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#f6f4ee] px-4 py-8 text-[#0b1619] transition-colors duration-300 dark:bg-[#0b1619] dark:text-[#f6f4ee] flex flex-col justify-between">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <Link to="/" className="inline-flex">
          <LogoPlaceholder size="md" />
        </Link>
        <ThemeToggle className="border-[#e4e1d6] text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:text-white/60 dark:hover:border-[#d6a84a] dark:hover:text-[#d6a84a]" />
      </header>

      <main className="mx-auto my-auto w-full max-w-md text-center py-6">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-[#fff1f0] text-[#cf1322] shadow-xl shadow-[#cf1322]/10 dark:bg-[#321214] dark:text-[#ff7875] border border-[#ffccc7] dark:border-[#5c1d1f]">
          <ShieldAlert size={36} />
        </div>

        <span className="rounded-full bg-[#cf1322]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#cf1322] dark:text-[#ff7875]">
          403 Forbidden
        </span>

        <h1 className="font-display mt-3 text-2xl font-bold tracking-tight">
          Administrator Setup Required
        </h1>

        <p className="mt-2 text-xs leading-relaxed text-[#6b7a77] dark:text-white/60">
          The account <span className="font-semibold text-[#0b1619] dark:text-white">{user?.email || 'you are signed in with'}</span> does not currently have administrator privileges to view all signed-up accounts.
        </p>

        {/* Claim Admin Form */}
        <form onSubmit={handleClaimAdmin} className="mt-6 rounded-2xl border border-[#e4e1d6] bg-white p-4 text-left shadow-sm dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0b1619] dark:text-white mb-2">
            <Key size={16} className="text-[#009689]" />
            <span>Claim Administrator Access</span>
          </div>

          <p className="text-[11px] text-[#6b7a77] dark:text-white/50 mb-3">
            Enter the admin setup key (default: <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[#009689] dark:bg-white/10">ReedshelfAdmin2026!</code>) or leave blank to claim in development mode.
          </p>

          <input
            type="password"
            placeholder="Setup Key (optional in dev)"
            value={setupKey}
            onChange={(e) => setSetupKey(e.target.value)}
            className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] p-2.5 text-xs text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
          />

          {error && (
            <p className="mt-2 text-xs text-[#dc2626]">{error}</p>
          )}

          {success && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-[#16a34a]">
              <CheckCircle size={14} /> {success}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#009689] py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#007268] disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : 'Grant Admin Access to this Account'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Link
            to="/app/home"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e1d6] bg-white px-4 py-2 text-xs font-semibold text-[#6b7a77] transition hover:bg-[#f6f4ee] hover:text-[#0b1619] dark:border-white/15 dark:bg-white/5 dark:text-white/70"
          >
            <ArrowLeft size={14} /> Back to Library
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e1d6] bg-white px-4 py-2 text-xs font-semibold text-[#6b7a77] transition hover:bg-[#f6f4ee] hover:text-[#0b1619] dark:border-white/15 dark:bg-white/5 dark:text-white/70"
          >
            <LogOut size={14} /> Switch Account
          </button>
        </div>
      </main>

      <footer className="text-center text-xs text-[#8b9a93] dark:text-white/40">
        ReedShelf &copy; 2026 • Security Enforcement
      </footer>
    </div>
  );
}

export function AdminProtectedRoute({ children }) {
  const user = getCurrentUser();
  const token = authStorage.getToken();

  if (!token || !user) {
    return <Navigate to="/sign-in?redirect=/admin" replace />;
  }

  if (user.role !== 'admin') {
    return <AdminForbidden user={user} />;
  }

  return children;
}
