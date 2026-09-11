import { useState } from 'react';
import { Loader2, X, AlertCircle } from 'lucide-react';
import { loginWithGoogle } from '../lib/appStore';

export function GoogleAuthButton({
  mode = 'signin', // 'signin' or 'signup'
  onSuccess,
  onRequire2FA,
  onError,
  disabled = false,
  className = ''
}) {
  const [loading, setLoading] = useState(false);
  const [quickLoadingEmail, setQuickLoadingEmail] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalForm, setModalForm] = useState({
    name: '',
    email: '',
  });
  const [modalError, setModalError] = useState('');

  const handleGoogleClick = () => {
    setModalError('');
    if (onError) onError('');
    setShowModal(true);
  };

  const authenticateAccount = async (accountName, accountEmail) => {
    if (!accountEmail) return;

    setLoading(true);
    setModalError('');

    try {
      const email = accountEmail.trim();
      const name = (accountName && accountName.trim()) || email.split('@')[0];
      const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`;

      const res = await loginWithGoogle({
        email,
        name,
        avatar,
        googleId: `google_${Date.now()}`,
      });

      if (res?.require2FA) {
        setShowModal(false);
        if (onRequire2FA) {
          onRequire2FA({ tempToken: res.tempToken, email: res.email });
        }
        return;
      }

      setShowModal(false);
      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      setModalError(err.message || 'Failed to authenticate with Google.');
    } finally {
      setLoading(false);
      setQuickLoadingEmail(null);
    }
  };

  const handleQuickSelect = async (name, email) => {
    setQuickLoadingEmail(email);
    await authenticateAccount(name, email);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!modalForm.email) return;
    await authenticateAccount(modalForm.name, modalForm.email);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleGoogleClick}
        disabled={disabled || loading}
        className={`flex w-full items-center justify-center gap-3 rounded-xl border border-[#d5ddd1] bg-white py-3 px-4 text-sm font-semibold text-[#0b1619] shadow-xs transition hover:bg-[#f6f4ee] hover:border-[#b0c0b8] active:scale-[0.99] disabled:opacity-50 dark:border-white/15 dark:bg-[#12232a] dark:text-white dark:hover:bg-white/5 ${className}`}
      >
        {loading ? (
          <Loader2 size={18} className="animate-spin text-[#009689]" />
        ) : (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
        )}
        <span>{mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
      </button>

      {/* Google Sign-in Interactive Dialog */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#12232a]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <svg className="h-6 w-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <h3 className="font-display text-lg font-bold text-[#0b1619] dark:text-white">
                  {mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-xl p-1 text-[#6b7a77] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-2 text-xs text-[#6b7a77] dark:text-white/60">
              Choose an existing Google account or enter your Google details to continue to ReedShelf.
            </p>

            {modalError && (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#fff1ef] p-3 text-xs text-[#9b5147] dark:bg-[#3d1814] dark:text-[#fca5a5]">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            {/* Quick Demo Google Accounts */}
            <div className="mt-4 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#6b7a77] dark:text-white/40">
                Quick Select:
              </span>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickSelect('Platform Admin', 'link4emmy@gmail.com')}
                  className="flex items-center justify-between rounded-xl border border-[#e4e1d6] p-2.5 text-left text-xs transition hover:border-[#009689] hover:bg-[#e6f4f2]/40 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#009689] font-bold text-white text-xs shrink-0">
                      P
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0b1619] dark:text-white truncate">Platform Admin</p>
                      <p className="text-[#6b7a77] dark:text-white/50 text-[11px] truncate">link4emmy@gmail.com</p>
                    </div>
                  </div>
                  {quickLoadingEmail === 'link4emmy@gmail.com' && (
                    <Loader2 size={16} className="animate-spin text-[#009689] shrink-0 mr-1" />
                  )}
                </button>

                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleQuickSelect('Emma Reader', 'emma.reader@gmail.com')}
                  className="flex items-center justify-between rounded-xl border border-[#e4e1d6] p-2.5 text-left text-xs transition hover:border-[#009689] hover:bg-[#e6f4f2]/40 disabled:opacity-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-[#4285F4] font-bold text-white text-xs shrink-0">
                      E
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-[#0b1619] dark:text-white truncate">Emma Reader</p>
                      <p className="text-[#6b7a77] dark:text-white/50 text-[11px] truncate">emma.reader@gmail.com</p>
                    </div>
                  </div>
                  {quickLoadingEmail === 'emma.reader@gmail.com' && (
                    <Loader2 size={16} className="animate-spin text-[#4285F4] shrink-0 mr-1" />
                  )}
                </button>
              </div>
            </div>

            {/* Custom Google Entry */}
            <form onSubmit={handleModalSubmit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-[#0b1619] dark:text-white mb-1">
                  Google Email Address
                </label>
                <input
                  required
                  type="email"
                  placeholder="yourname@gmail.com"
                  value={modalForm.email}
                  onChange={(e) => setModalForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] p-2.5 text-xs text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#0b1619] dark:text-white mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  placeholder="Your Name"
                  value={modalForm.name}
                  onChange={(e) => setModalForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] p-2.5 text-xs text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div className="mt-5 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-[#d5ddd1] px-4 py-2 text-xs font-semibold text-[#6b7a77] hover:bg-[#f6f4ee] dark:border-white/15 dark:text-white/70"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !modalForm.email}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#009689] px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#007268] disabled:opacity-50"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  Continue with Google
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
