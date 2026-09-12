import { useState } from 'react';
import { Loader2, AlertCircle, ExternalLink, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
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
  const [setupRequired, setSetupRequired] = useState(false);
  const [showDevFallback, setShowDevFallback] = useState(false);
  const [devEmail, setDevEmail] = useState('');
  const [devLoading, setDevLoading] = useState(false);

  const handleGoogleClick = async () => {
    if (loading) return;
    setLoading(true);
    setSetupRequired(false);
    if (onError) onError('');

    try {
      if (!isSupabaseConfigured() || !supabase) {
        setSetupRequired(true);
        setLoading(false);
        return;
      }

      // Generate OAuth redirect URL through Supabase
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.url) {
        throw new Error('Could not initiate Google authentication.');
      }

      // Check whether Google provider is enabled in Supabase project before navigating
      try {
        const checkRes = await fetch(data.url, { method: 'GET', redirect: 'manual' });
        if (checkRes.status === 400) {
          const body = await checkRes.json().catch(() => ({}));
          if (body.msg && body.msg.includes('provider is not enabled')) {
            setSetupRequired(true);
            setLoading(false);
            return;
          }
        }
      } catch {
        // If fetch throws (e.g. cross-origin opaque redirect to accounts.google.com),
        // provider is enabled and active! Proceed to redirect.
      }

      // Direct navigation to Google OAuth consent page
      window.location.assign(data.url);
    } catch (err) {
      console.error('Google OAuth error:', err);
      if (err.message && err.message.includes('not enabled')) {
        setSetupRequired(true);
      } else {
        if (onError) onError(err.message || 'Failed to connect to Google.');
      }
      setLoading(false);
    }
  };

  const handleDevSimulate = async (accountName, accountEmail) => {
    if (!accountEmail) return;
    setDevLoading(true);
    try {
      const email = accountEmail.trim();
      const name = (accountName && accountName.trim()) || email.split('@')[0];
      const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`;

      const res = await loginWithGoogle({
        email,
        name,
        avatar,
        googleId: `google_sim_${Date.now()}`,
      });

      if (res?.require2FA) {
        if (onRequire2FA) {
          onRequire2FA({ tempToken: res.tempToken, email: res.email });
        }
        return;
      }

      if (onSuccess) {
        onSuccess(res);
      }
    } catch (err) {
      if (onError) onError(err.message || 'Simulated login failed.');
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <div className="w-full space-y-3">
      <button
        type="button"
        onClick={handleGoogleClick}
        disabled={disabled || loading || devLoading}
        className={`flex w-full items-center justify-center gap-3 rounded-xl border border-[#d5ddd1] bg-white py-3 px-4 text-sm font-semibold text-[#0b1619] shadow-xs transition hover:bg-[#f6f4ee] hover:border-[#b0c0b8] active:scale-[0.99] disabled:opacity-50 dark:border-white/15 dark:bg-[#12232a] dark:text-white dark:hover:bg-white/5 ${className}`}
      >
        {loading ? (
          <>
            <Loader2 size={18} className="animate-spin text-[#009689]" />
            <span>Connecting to Google...</span>
          </>
        ) : (
          <>
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
            <span>{mode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}</span>
          </>
        )}
      </button>

      {/* Inline guide when Google OAuth provider is not yet enabled in Supabase */}
      {setupRequired && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-900 shadow-xs dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-2.5">
            <AlertCircle size={17} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-2 flex-1">
              <p className="font-bold text-amber-950 dark:text-amber-100">
                Google OAuth Setup Required in Supabase
              </p>
              <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                The Google provider is not toggled on yet in your Supabase project. To enable real Google Sign-In:
              </p>
              <ol className="list-decimal space-y-1 pl-4 text-[11px] text-amber-800 dark:text-amber-300">
                <li>
                  Open your{' '}
                  <a
                    href="https://supabase.com/dashboard/project/xiiemdxbdrlzpvhaecmt/auth/providers"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-0.5 font-bold text-amber-950 underline underline-offset-2 hover:text-[#009689] dark:text-amber-100"
                  >
                    Supabase Auth Providers Dashboard
                    <ExternalLink size={10} className="inline" />
                  </a>
                </li>
                <li>Toggle <strong>Google</strong> to <strong>Enabled</strong>.</li>
                <li>
                  Enter your Google Cloud <strong>Client ID</strong> and <strong>Client Secret</strong>.
                </li>
                <li>
                  Add redirect URI <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px] dark:bg-amber-900/50">https://xiiemdxbdrlzpvhaecmt.supabase.co/auth/v1/callback</code> to your Google Cloud Console.
                </li>
              </ol>

              {/* Dev mode simulation toggle */}
              <div className="pt-1.5 border-t border-amber-200/60 dark:border-amber-900/50">
                <button
                  type="button"
                  onClick={() => setShowDevFallback(!showDevFallback)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-800 hover:text-amber-950 dark:text-amber-300 dark:hover:text-amber-100"
                >
                  <Sparkles size={12} />
                  <span>Developer testing without Google Cloud credentials?</span>
                  {showDevFallback ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>

                {showDevFallback && (
                  <div className="mt-2.5 space-y-2 rounded-xl bg-white/70 p-3 dark:bg-black/20">
                    <p className="text-[10px] text-amber-900 dark:text-amber-200">
                      Quickly test the authenticated user experience with a simulated Google account:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        disabled={devLoading}
                        onClick={() => handleDevSimulate('Platform Admin', 'link4emmy@gmail.com')}
                        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white p-2 text-left text-[11px] font-medium text-[#0b1619] hover:bg-amber-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      >
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-[#009689] text-[10px] font-bold text-white shrink-0">
                          P
                        </div>
                        <span className="truncate">Platform Admin</span>
                      </button>

                      <button
                        type="button"
                        disabled={devLoading}
                        onClick={() => handleDevSimulate('Emma Reader', 'emma.reader@gmail.com')}
                        className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white p-2 text-left text-[11px] font-medium text-[#0b1619] hover:bg-amber-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      >
                        <div className="grid h-6 w-6 place-items-center rounded-full bg-[#4285F4] text-[10px] font-bold text-white shrink-0">
                          E
                        </div>
                        <span className="truncate">Emma Reader</span>
                      </button>
                    </div>

                    <div className="flex gap-1.5 pt-1">
                      <input
                        type="email"
                        placeholder="custom.tester@gmail.com"
                        value={devEmail}
                        onChange={(e) => setDevEmail(e.target.value)}
                        className="flex-1 rounded-lg border border-amber-200 bg-white px-2.5 py-1 text-[11px] text-[#0b1619] dark:border-white/10 dark:bg-white/5 dark:text-white"
                      />
                      <button
                        type="button"
                        disabled={devLoading || !devEmail}
                        onClick={() => handleDevSimulate(devEmail.split('@')[0], devEmail)}
                        className="rounded-lg bg-[#009689] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#007268] disabled:opacity-50"
                      >
                        {devLoading ? <Loader2 size={12} className="animate-spin" /> : 'Simulate'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
