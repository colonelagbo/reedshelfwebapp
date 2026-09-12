import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';
import { TwoFactorVerifyModal } from '../components/TwoFactorVerifyModal';

export function AuthCallback() {
  const [error, setError] = useState('');
  const [statusText, setStatusText] = useState('Finalizing Google authentication...');
  const [twoFactorData, setTwoFactorData] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    async function handleCallback() {
      try {
        // 1. Check for errors in URL params or hash
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const errorDesc =
          searchParams.get('error_description') ||
          hashParams.get('error_description') ||
          searchParams.get('error') ||
          hashParams.get('error');

        if (errorDesc) {
          throw new Error(decodeURIComponent(errorDesc.replace(/\+/g, ' ')));
        }

        if (!supabase) {
          throw new Error('Supabase client is not configured.');
        }

        setStatusText('Retrieving Google authentication session...');

        // 2. If PKCE code is present in query, exchange it
        const code = searchParams.get('code');
        let session = null;

        if (code && supabase.auth?.exchangeCodeForSession) {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.warn('PKCE exchange warning:', exchangeError);
          } else {
            session = data?.session;
          }
        }

        // 3. If no session from code exchange, check getSession()
        if (!session) {
          const { data, error: sessionError } = await supabase.auth.getSession();
          if (sessionError) throw sessionError;
          session = data?.session;
        }

        // 4. If still no session, await onAuthStateChange briefly
        if (!session) {
          session = await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(null), 3500);
            const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
              if (s) {
                clearTimeout(timeout);
                subscription.unsubscribe();
                resolve(s);
              }
            });
          });
        }

        if (!session?.user) {
          throw new Error('No Google authentication session could be verified. Please try signing in again.');
        }

        setStatusText('Connecting your ReedShelf profile...');

        const googleUser = session.user;
        const email = googleUser.email;
        const name =
          googleUser.user_metadata?.full_name ||
          googleUser.user_metadata?.name ||
          googleUser.user_metadata?.user_name ||
          (email ? email.split('@')[0] : 'Google User');
        const avatar =
          googleUser.user_metadata?.avatar_url ||
          googleUser.user_metadata?.picture ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || email)}`;
        const googleId = googleUser.identities?.[0]?.id || googleUser.id;

        const res = await api.auth.google({
          email,
          name,
          avatar,
          googleId,
        });

        if (res?.require2FA) {
          setTwoFactorData({ tempToken: res.tempToken, email: res.email });
          return;
        }

        if (res?.user?.id) {
          localStorage.setItem('reedshelf_session', res.user.id);
        }

        setStatusText('Success! Taking you to ReedShelf...');
        setTimeout(() => {
          navigate('/app/home', { replace: true });
        }, 300);
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed. Please try signing in again.');
      }
    }

    handleCallback();
  }, [navigate, searchParams]);

  if (twoFactorData) {
    return (
      <TwoFactorVerifyModal
        tempToken={twoFactorData.tempToken}
        email={twoFactorData.email}
        onSuccess={() => navigate('/app/home', { replace: true })}
        onCancel={() => navigate('/sign-in', { replace: true })}
      />
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f4ee] p-4 dark:bg-[#0b1619]">
      <div className="w-full max-w-sm rounded-3xl border border-[#e4e1d6] bg-white p-8 text-center shadow-xl dark:border-white/10 dark:bg-[#12232a]">
        {error ? (
          <div className="space-y-4">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <AlertCircle size={28} />
            </div>
            <h2 className="text-lg font-bold text-[#0b1619] dark:text-white">Authentication Failed</h2>
            <p className="text-xs text-[#6b7a77] dark:text-white/60 leading-relaxed">{error}</p>
            <button
              onClick={() => navigate('/sign-in', { replace: true })}
              className="w-full rounded-xl bg-[#009689] py-2.5 text-xs font-bold text-white hover:bg-[#007268] transition"
            >
              Return to sign in
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Loader2 size={32} className="mx-auto animate-spin text-[#009689]" />
            <h2 className="text-base font-bold text-[#0b1619] dark:text-white">Connecting your account...</h2>
            <p className="text-xs text-[#6b7a77] dark:text-white/60">{statusText}</p>
          </div>
        )}
      </div>
    </div>
  );
}
