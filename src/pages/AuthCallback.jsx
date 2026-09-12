import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { api } from '../lib/api';
import { TwoFactorVerifyModal } from '../components/TwoFactorVerifyModal';

export function AuthCallback() {
  const [error, setError] = useState('');
  const [twoFactorData, setTwoFactorData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    async function handleCallback() {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const session = data?.session;
        if (!session?.user) {
          // If no session found, return to sign in
          navigate('/sign-in', { replace: true });
          return;
        }

        const googleUser = session.user;
        const res = await api.auth.google({
          email: googleUser.email,
          name: googleUser.user_metadata?.full_name || googleUser.user_metadata?.name || googleUser.email.split('@')[0],
          avatar: googleUser.user_metadata?.avatar_url || null,
          googleId: googleUser.id,
        });

        if (res.require2FA) {
          setTwoFactorData({ tempToken: res.tempToken, email: res.email });
          return;
        }

        navigate('/app/home', { replace: true });
      } catch (err) {
        console.error('Auth callback error:', err);
        setError(err.message || 'Authentication failed. Please try signing in again.');
      }
    }

    handleCallback();
  }, [navigate]);

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
            <p className="text-xs text-[#6b7a77] dark:text-white/60">{error}</p>
            <button
              onClick={() => navigate('/sign-in', { replace: true })}
              className="w-full rounded-xl bg-[#009689] py-2.5 text-xs font-bold text-white hover:bg-[#007268]"
            >
              Return to sign in
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <Loader2 size={32} className="mx-auto animate-spin text-[#009689]" />
            <h2 className="text-base font-bold text-[#0b1619] dark:text-white">Connecting your account...</h2>
            <p className="text-xs text-[#6b7a77] dark:text-white/60">Finalizing Google authentication</p>
          </div>
        )}
      </div>
    </div>
  );
}
