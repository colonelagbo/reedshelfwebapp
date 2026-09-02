import { useState, useEffect } from 'react';
import { NavLink, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  HardDrive,
  Activity,
  ScrollText,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  AlertTriangle,
  UserCircle,
  ExternalLink
} from 'lucide-react';
import { getCurrentUser, logoutUser } from '../../lib/appStore';
import { api } from '../../lib/api';
import { LogoPlaceholder } from '../../components/LogoPlaceholder';
import { ThemeToggle } from '../../components/ThemeToggle';
import { ToastProvider } from '../../components/AdminToast';

const adminNav = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/books', label: 'Books', icon: BookOpen },
  { to: '/admin/storage', label: 'Storage', icon: HardDrive },
  { to: '/admin/reading-activity', label: 'Reading Activity', icon: Activity },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminLayout() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());
  const [storageWarning, setStorageWarning] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile sidebar is open
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  // Fetch fresh user profile & storage warning
  useEffect(() => {
    api.auth.getMe().then((res) => {
      if (res?.user) setUser(res.user);
    }).catch(() => {});

    api.admin.getStorage().then((res) => {
      if (res?.warningLevel && res.warningLevel !== 'normal') {
        setStorageWarning({
          level: res.warningLevel,
          pct: res.storageUsagePercentage,
        });
      } else {
        setStorageWarning(null);
      }
    }).catch(() => {});
  }, [location.pathname]);

  const handleLogout = () => {
    if (window.confirm('Sign out of Reedshelf Admin Console?')) {
      logoutUser();
      navigate('/sign-in');
    }
  };

  return (
    <ToastProvider>
      <div className="min-h-[100dvh] w-full overflow-x-hidden bg-[#f6f4ee] text-[#0b1619] transition-colors duration-300 dark:bg-[#0b1619] dark:text-[#f6f4ee] flex flex-col">
        {/* Top Sticky Header */}
        <header className="sticky top-0 z-40 border-b border-[#e4e1d6] bg-[#f6f4ee]/95 backdrop-blur dark:border-white/10 dark:bg-[#0b1619]/95">
          <div className="mx-auto flex h-16 w-full max-w-[1600px] items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl p-2 text-[#557067] hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10 lg:hidden"
                onClick={() => setOpen((v) => !v)}
                aria-label="Toggle admin navigation"
              >
                {open ? <X size={22} /> : <Menu size={22} />}
              </button>

              <Link to="/admin" className="flex items-center gap-2.5">
                <LogoPlaceholder compact />
                <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-[#009689]/10 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                  <Shield size={12} className="shrink-0" /> Admin Console
                </span>
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {/* Storage Warning Banner Pill */}
              {storageWarning && (
                <Link
                  to="/admin/storage"
                  className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition ${
                    storageWarning.level === 'critical'
                      ? 'bg-[#fee2e2] text-[#991b1b] animate-pulse dark:bg-[#450a0a] dark:text-[#fca5a5]'
                      : storageWarning.level === 'high'
                      ? 'bg-[#ffedd5] text-[#9a3412] dark:bg-[#431407] dark:text-[#fdba74]'
                      : 'bg-[#fef3c7] text-[#92400e] dark:bg-[#451a03] dark:text-[#fcd34d]'
                  }`}
                  title="Storage threshold alert"
                >
                  <AlertTriangle size={14} />
                  <span>Storage {storageWarning.pct}% ({storageWarning.level})</span>
                </Link>
              )}

              {/* Link back to Main Reading App */}
              <Link
                to="/app/home"
                className="hidden md:inline-flex items-center gap-1.5 rounded-xl border border-[#e4e1d6] bg-white px-3 py-1.5 text-xs font-semibold text-[#557067] shadow-xs transition hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:bg-white/5 dark:text-white/70 dark:hover:border-[#5fc4b8] dark:hover:text-[#5fc4b8]"
              >
                <BookOpen size={14} /> Reedshelf App <ExternalLink size={12} className="opacity-60" />
              </Link>

              {/* Theme Toggle */}
              <ThemeToggle className="border-[#e4e1d6] text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:text-white/60 dark:hover:border-[#d6a84a] dark:hover:text-[#d6a84a]" />

              {/* Current Admin User Badge */}
              <div className="flex items-center gap-2 pl-2 border-l border-[#e4e1d6] dark:border-white/10">
                <div className="hidden text-right lg:block">
                  <p className="text-xs font-bold leading-tight">{user?.name || 'Administrator'}</p>
                  <span className="text-[10px] font-semibold text-[#009689] dark:text-[#5fc4b8]">Primary Admin</span>
                </div>
                <div className="grid h-9 w-9 place-items-center rounded-full bg-[#009689] text-white font-bold text-sm shadow-xs">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Admin" className="h-full w-full rounded-full object-cover" />
                  ) : (
                    (user?.name?.[0] || 'A').toUpperCase()
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-[1600px] flex-1">
          {/* Mobile Overlay Backdrop */}
          {open && (
            <div
              className="fixed inset-0 top-16 z-30 bg-black/50 backdrop-blur-xs transition-opacity lg:hidden"
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />
          )}

          {/* Admin Sidebar Navigation */}
          <aside
            className={`${
              open ? 'fixed inset-y-16 left-0 z-40 block w-72 shadow-2xl' : 'hidden'
            } border-r border-[#e4e1d6] bg-[#f6f4ee] dark:border-white/10 dark:bg-[#0b1619] lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 transition-transform`}
          >
            <div className="flex h-full flex-col p-4 overflow-y-auto">
              {/* Admin Console Header Card */}
              <div className="mb-5 rounded-2xl bg-gradient-to-br from-[#0b1619] to-[#14282f] p-4 text-white shadow-md dark:border dark:border-white/10 dark:from-white/5 dark:to-white/10">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#009689] text-white shadow-xs">
                    <Shield size={20} />
                  </span>
                  <div>
                    <p className="text-xs uppercase font-bold tracking-widest text-[#d6a84a]">Console</p>
                    <p className="text-sm font-semibold text-white">Platform Admin</p>
                  </div>
                </div>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1">
                {adminNav.map((item) => {
                  const NavIcon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                          isActive
                            ? 'bg-[#009689] text-white shadow-sm font-semibold'
                            : 'text-[#667b72] hover:bg-white hover:text-[#0b1619] dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white'
                        }`
                      }
                    >
                      <NavIcon size={18} />
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>

              {/* Bottom Utility Controls */}
              <div className="mt-auto space-y-2 border-t border-[#e4e1d6] pt-4 dark:border-white/10">
                <Link
                  to="/app/home"
                  className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-[#557067] hover:bg-white hover:text-[#0b1619] dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white transition"
                >
                  <ArrowLeft size={18} />
                  Return to Reader App
                </Link>

                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-[#c0392b] hover:bg-white dark:text-[#e74c3c] dark:hover:bg-white/5 transition"
                >
                  <LogOut size={18} />
                  Sign out
                </button>
              </div>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
