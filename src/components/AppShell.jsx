import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Home, Library, ListChecks, Settings, UserCircle, Upload, LogOut, Menu, X, Shield, Plus, Download, HardDrive } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getCurrentUser, getUserStorageUsage, logoutUser, getSettings, api } from '../lib/appStore';
import { LogoPlaceholder } from './LogoPlaceholder';
import { ThemeToggle } from './ThemeToggle';

const nav = [
  { to: '/app/home', label: 'Home', icon: Home, shortLabel: 'Home' },
  { to: '/app/library', label: 'Library', icon: Library, shortLabel: 'Library' },
  { to: '/app/upload', label: 'Upload book', icon: Plus, shortLabel: 'Upload', isPrimary: true },
  { to: '/app/reading-plans', label: 'Reading plans', icon: ListChecks, shortLabel: 'Plans' },
  { to: '/app/profile', label: 'Profile', icon: UserCircle, shortLabel: 'Profile' },
];

export function AppShell({ children }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(() => getCurrentUser());
  const [storage, setStorage] = useState(() => getUserStorageUsage(user?.id));
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );

  useEffect(() => {
    api.auth.getMe().then((res) => {
      if (res?.user) {
        setUser(res.user);
        setStorage(getUserStorageUsage(res.user.id));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const updateStorage = () => {
      const u = getCurrentUser();
      if (u) setUser(u);
      setStorage(getUserStorageUsage(u?.id));
    };
    updateStorage();
    window.addEventListener('reedshelf:books_updated', updateStorage);
    return () => window.removeEventListener('reedshelf:books_updated', updateStorage);
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
      {/* Responsive Header */}
      <header className="sticky top-0 z-40 border-b border-[#e4e1d6] bg-[#f6f4ee]/95 backdrop-blur dark:border-white/10 dark:bg-[#0b1619]/95">
        <div className="mx-auto flex h-14 sm:h-16 max-w-[1500px] items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-4">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl text-[#557067] hover:bg-black/5 active:bg-black/10 dark:text-white/70 dark:hover:bg-white/10 lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
            <LogoPlaceholder compact />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold leading-tight">{user?.name || 'Reader'}</p>
              <p className="text-xs text-[#7b8c84] dark:text-white/40 leading-tight">{user?.email || ''}</p>
            </div>
            <NavLink
              to="/app/profile"
              className="grid h-9 w-9 sm:h-10 sm:w-10 place-items-center overflow-hidden rounded-full border border-[#e4e1d6] bg-white dark:border-white/15 dark:bg-white/5 active:scale-95 transition"
              title="Your Profile"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <UserCircle size={22} />
              )}
            </NavLink>
            <ThemeToggle className="h-9 w-9 sm:h-10 sm:w-10 border-[#e4e1d6] text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:text-white/60 dark:hover:border-[#d6a84a] dark:hover:text-[#d6a84a]" />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1500px] flex-1">
        {/* Mobile Backdrop Overlay */}
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity lg:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={`${
            open ? 'fixed inset-y-0 left-0 z-50 block w-72 shadow-2xl animate-in slide-in-from-left' : 'hidden'
          } border-r border-[#e4e1d6] bg-[#f6f4ee] dark:border-white/10 dark:bg-[#0b1619] lg:sticky lg:top-16 lg:block lg:h-[calc(100vh-4rem)] lg:w-64 lg:shrink-0 transition-transform`}
        >
          <div className="flex h-full flex-col p-4 overflow-y-auto">
            {/* Mobile Drawer Header with Close Button */}
            <div className="mb-4 flex items-center justify-between lg:hidden pb-2 border-b border-[#e4e1d6] dark:border-white/10">
              <LogoPlaceholder compact />
              <button
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 text-[#557067] hover:bg-black/10 dark:bg-white/5 dark:text-white/70"
                aria-label="Close navigation"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mb-5 rounded-2xl bg-[#0b1619] p-4 text-white dark:border dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d6a84a] text-[#0b1619]">
                  <BookOpen size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{user?.name || 'Your Bookshelf'}</p>
                  <p className="text-xs text-white/60">Plan, Read, Track</p>
                </div>
              </div>
            </div>

            <nav className="space-y-1">
              {[
                { to: '/app/home', label: 'Home', icon: Home },
                { to: '/app/library', label: 'Library', icon: Library },
                { to: '/app/upload', label: 'Upload book', icon: Upload },
                { to: '/app/reading-plans', label: 'Reading plans', icon: ListChecks },
              ].map((item) => {
                const NavIcon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                        isActive
                          ? 'bg-[#e6f4f2] text-[#007268] font-bold dark:bg-[#009689]/15 dark:text-[#5fc4b8]'
                          : 'text-[#667b72] hover:bg-white hover:text-[#0b1619] dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white'
                      }`
                    }
                  >
                    <NavIcon size={19} />
                    {item.label}
                  </NavLink>
                );
              })}
            </nav>

            {/* Account Storage Quota Meter */}
            <div className="my-3 rounded-2xl border border-[#e4e1d6] bg-white p-3.5 shadow-2xs dark:border-white/10 dark:bg-white/5">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[#0b1619] dark:text-white">
                  <HardDrive size={14} className="text-[#009689] dark:text-[#5fc4b8]" />
                  Storage
                </span>
                <span className="font-bold text-[#009689] dark:text-[#5fc4b8]">
                  {storage.usedMB} / 50 MB
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#e4e1d6] dark:bg-white/10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    storage.percentUsed > 90
                      ? 'bg-red-500'
                      : storage.percentUsed > 70
                      ? 'bg-amber-500'
                      : 'bg-[#009689] dark:bg-[#5fc4b8]'
                  }`}
                  style={{ width: `${Math.max(4, Math.min(100, storage.percentUsed))}%` }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#7b8c84] dark:text-white/40">
                <span>{storage.remainingMB} MB free</span>
                <span>{storage.percentUsed}%</span>
              </div>
            </div>

            <div className="mt-auto space-y-1 border-t border-[#e4e1d6] pt-4 dark:border-white/10">
              <NavLink
                to="/app/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#667b72] hover:bg-white hover:text-[#0b1619] dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <UserCircle size={19} />
                Profile
              </NavLink>
              <NavLink
                to="/app/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-[#667b72] hover:bg-white hover:text-[#0b1619] dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <Settings size={19} />
                Settings
              </NavLink>
              {user?.role === 'admin' && (
                <NavLink
                  to="/admin/users"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-[#009689] hover:bg-[#009689]/10 dark:text-[#5fc4b8] dark:hover:bg-[#009689]/20 transition"
                >
                  <Shield size={19} />
                  Accounts & Admin
                </NavLink>
              )}
              {!isStandalone && (
                <button
                  type="button"
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('reedshelf-trigger-install'));
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-[#009689] hover:bg-[#009689]/10 dark:text-[#5fc4b8] dark:hover:bg-[#009689]/20 transition"
                >
                  <Download size={19} />
                  Install App
                </button>
              )}
              <button
                onClick={logout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-[#8b5e55] hover:bg-white dark:text-[#e0897a] dark:hover:bg-white/5"
              >
                <LogOut size={19} />
                Log out
              </button>
            </div>
          </div>
        </aside>

        {/* Main App Content with Safe Area Padding */}
        <main className="min-w-0 flex-1 px-3.5 py-4 sm:px-6 lg:px-8 lg:py-8 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] lg:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar (thumb-friendly quick navigation with safe-area support) */}
      <nav
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t border-[#e4e1d6] bg-[#f6f4ee]/95 px-1 backdrop-blur-md dark:border-white/10 dark:bg-[#0b1619]/95 lg:hidden"
      >
        {nav.map((item) => {
          const NavIcon = item.icon;

          if (item.isPrimary) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative -top-2 flex flex-col items-center justify-center group"
                aria-label="Upload book"
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[#009689] text-white shadow-lg shadow-[#009689]/30 transition group-active:scale-95">
                  <Plus size={24} strokeWidth={2.5} />
                </span>
                <span className="text-[10px] font-bold text-[#007268] dark:text-[#5fc4b8] mt-0.5">Upload</span>
              </NavLink>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium transition active:scale-95 ${
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
