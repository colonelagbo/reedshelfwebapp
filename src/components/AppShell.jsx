import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Home, Library, ListChecks, Settings, UserCircle, Upload, LogOut, Menu, X, Shield } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getCurrentUser, logoutUser, getSettings, api } from '../lib/appStore';
import { LogoPlaceholder } from './LogoPlaceholder';
import { ThemeToggle } from './ThemeToggle';

const nav = [
  { to: '/app/home', label: 'Home', icon: Home },
  { to: '/app/library', label: 'Library', icon: Library },
  { to: '/app/upload', label: 'Upload book', icon: Upload, shortLabel: 'Upload' },
  { to: '/app/reading-plans', label: 'Reading plans', icon: ListChecks, shortLabel: 'Plans' },
];

export function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => getCurrentUser());

  useEffect(() => {
    api.auth.getMe().then((res) => {
      if (res?.user) setUser(res.user);
    }).catch(() => {});
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const logout = () => {
    if (getSettings(user?.id).confirmSignOut && !window.confirm('Sign out of ReedShelf?')) return;
    logoutUser();
    navigate('/sign-in');
  };

  return (
    <div className="min-h-[100dvh] w-full overflow-x-hidden bg-[#f6f4ee] text-[#0b1619] transition-colors duration-300 dark:bg-[#0b1619] dark:text-[#f6f4ee] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[#e4e1d6] bg-[#f6f4ee]/95 backdrop-blur dark:border-white/10 dark:bg-[#0b1619]/95">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-3.5 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              className="rounded-lg p-2 text-[#557067] hover:bg-black/5 dark:text-white/70 dark:hover:bg-white/10 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
            <LogoPlaceholder compact />
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold">{user?.name || 'Reader'}</p>
              <p className="text-xs text-[#7b8c84] dark:text-white/40">{user?.email || ''}</p>
            </div>
            <NavLink
              to="/app/profile"
              className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center overflow-hidden rounded-full border border-[#e4e1d6] bg-white dark:border-white/15 dark:bg-white/5"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <UserCircle size={20} className="sm:size-[22px]" />
              )}
            </NavLink>
            <ThemeToggle className="border-[#e4e1d6] text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:text-white/60 dark:hover:border-[#d6a84a] dark:hover:text-[#d6a84a]" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1">
        {/* Mobile Backdrop Overlay */}
        {open && (
          <div
            className="fixed inset-0 top-16 z-30 bg-black/40 backdrop-blur-xs transition-opacity lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={`${
            open ? 'fixed inset-y-16 left-0 z-40 block w-72 shadow-2xl' : 'hidden'
          } border-r border-[#e4e1d6] bg-[#f6f4ee] dark:border-white/10 dark:bg-[#0b1619] lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 transition-transform`}
        >
          <div className="flex h-full flex-col p-4 overflow-y-auto">
            <div className="mb-5 rounded-2xl bg-[#0b1619] p-4 text-white dark:border dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d6a84a] text-[#0b1619]">
                  <BookOpen size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Your bookshelf</p>
                  <p className="text-xs text-white/60">Plan, Read, Track</p>
                </div>
              </div>
            </div>
            <nav className="space-y-1">
              {nav.map((item) => {
                const NavIcon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                        isActive
                          ? 'bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/15 dark:text-[#5fc4b8]'
                          : 'text-[#667b72] hover:bg-white hover:text-[#0b1619] dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white'
                      }`
                    }
                  >
                    <NavIcon size={18} />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>
            <div className="mt-auto space-y-1 border-t border-[#e4e1d6] pt-4 dark:border-white/10">
              <NavLink
                to="/app/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#667b72] hover:bg-white hover:text-[#0b1619] dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <UserCircle size={18} />
                Profile
              </NavLink>
              <NavLink
                to="/app/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#667b72] hover:bg-white hover:text-[#0b1619] dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <Settings size={18} />
                Settings
              </NavLink>
              {user?.role === 'admin' && (
                <NavLink
                  to="/admin"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#009689] hover:bg-[#009689]/10 dark:text-[#5fc4b8] dark:hover:bg-[#009689]/20 transition"
                >
                  <Shield size={18} />
                  Admin Console
                </NavLink>
              )}
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#8b5e55] hover:bg-white dark:text-[#e0897a] dark:hover:bg-white/5"
              >
                <LogOut size={18} />
                Log out
              </button>
            </div>
          </div>
        </aside>

        {/* Main App Content */}
        <main className="min-w-0 flex-1 px-3.5 py-5 sm:px-6 lg:px-8 lg:py-8 pb-24 lg:pb-8">{children}</main>
      </div>

      {/* Mobile Bottom Navigation Bar (thumb-friendly quick navigation) */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-16 items-center justify-around border-t border-[#e4e1d6] bg-[#f6f4ee]/95 px-2 backdrop-blur-md dark:border-white/10 dark:bg-[#0b1619]/95 lg:hidden">
        {nav.map((item) => {
          const NavIcon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 text-[11px] font-medium transition ${
                  isActive
                    ? 'text-[#009689] dark:text-[#5fc4b8] font-bold'
                    : 'text-[#667b72] hover:text-[#0b1619] dark:text-white/50 dark:hover:text-white'
                }`
              }
            >
              <NavIcon size={20} />
              <span>{item.shortLabel || item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}
