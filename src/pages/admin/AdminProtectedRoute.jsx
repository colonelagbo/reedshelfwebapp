import { Navigate, Link } from 'react-router-dom';
import { getCurrentUser, logoutUser } from '../../lib/appStore';
import { authStorage } from '../../lib/api';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { LogoPlaceholder } from '../../components/LogoPlaceholder';
import { ThemeToggle } from '../../components/ThemeToggle';

export function AdminForbidden({ user }) {
  const handleLogout = () => {
    logoutUser();
    window.location.href = '/sign-in?redirect=/admin';
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#f6f4ee] px-4 py-8 text-[#0b1619] transition-colors duration-300 dark:bg-[#0b1619] dark:text-[#f6f4ee] flex flex-col justify-between">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between">
        <Link to="/" className="inline-flex">
          <LogoPlaceholder size="md" />
        </Link>
        <ThemeToggle className="border-[#e4e1d6] text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:text-white/60 dark:hover:border-[#d6a84a] dark:hover:text-[#d6a84a]" />
      </header>

      <main className="mx-auto my-auto w-full max-w-md text-center py-10">
        <div className="mx-auto mb-6 grid h-20 w-20 place-items-center rounded-3xl bg-[#fff1f0] text-[#cf1322] shadow-xl shadow-[#cf1322]/10 dark:bg-[#321214] dark:text-[#ff7875] border border-[#ffccc7] dark:border-[#5c1d1f]">
          <ShieldAlert size={40} />
        </div>

        <span className="rounded-full bg-[#cf1322]/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-[#cf1322] dark:text-[#ff7875]">
          403 Forbidden
        </span>

        <h1 className="font-display mt-4 text-3xl font-bold tracking-tight">
          Administrator Access Required
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-[#6b7a77] dark:text-white/60">
          The account <span className="font-semibold text-[#0b1619] dark:text-white">{user?.email || 'you are signed in with'}</span> does not possess administrative privileges to view or manage the Reedshelf Admin Console.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/app/home"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#009689] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#007268]"
          >
            <ArrowLeft size={16} /> Return to Reading App
          </Link>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e4e1d6] bg-white px-5 py-3 text-sm font-semibold text-[#6b7a77] transition hover:bg-[#f6f4ee] hover:text-[#0b1619] dark:border-white/15 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <LogOut size={16} /> Sign in as Admin
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
