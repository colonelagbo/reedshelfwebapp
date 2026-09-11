import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { registerUser } from '../lib/appStore';
import { GoogleAuthButton } from '../components/GoogleAuthButton';
import { TwoFactorSetupModal } from '../components/TwoFactorSetupModal';
import { TwoFactorVerifyModal } from '../components/TwoFactorVerifyModal';

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [setup2FA, setSetup2FA] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSetup2FAModal, setShowSetup2FAModal] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);
  const navigate = useNavigate();

  const handleAuthSuccess = (user) => {
    if (setup2FA) {
      setShowSetup2FAModal(true);
    } else {
      navigate('/app/home', { replace: true });
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await registerUser({ ...form, setup2FA });
      handleAuthSuccess();
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      split={true}
      title="Create a new account"
      subtitle="It’s quick and easy to start your personal reading sanctuary."
      leftHeadline={
        <>
          Roots before branches.{' '}
          <span className="italic font-normal text-[#009689] dark:text-[#5fc4b8]">
            Consistency
          </span>{' '}
          before speed.
        </>
      }
      leftCallout="A quiet shelf for every book you cherish."
      leftWriteup="Like a reed grounded by calm waters, great readers grow through steady daily practice. Upload your digital books, track milestones, and build a reading life that stands the test of time."
      imageSrc="/images/reed-plant.jpg"
      imageAlt="A tranquil reed plant swaying gracefully"
      imageCaption="“Quiet pages make deep minds.”"
      imageSubcaption="Start your personal digital library in seconds."
      footer={
        <p>
          Already registered?{' '}
          <Link className="font-semibold text-[#009689] hover:underline dark:text-[#5fc4b8]" to="/sign-in">
            Sign in to your account
          </Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#557067] dark:text-white/60">
              Full name
            </span>
            <div className="relative">
              <User className="absolute left-3 top-3.5 text-[#8b9a93] dark:text-white/30" size={18} />
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-3 pl-10 pr-3 text-base sm:text-sm outline-none transition focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#5fc4b8] dark:focus:ring-[#5fc4b8]/20"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#557067] dark:text-white/60">
              Email
            </span>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-[#8b9a93] dark:text-white/30" size={18} />
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-3 pl-10 pr-3 text-base sm:text-sm outline-none transition focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#5fc4b8] dark:focus:ring-[#5fc4b8]/20"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#557067] dark:text-white/60">
            Password
          </span>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-[#8b9a93] dark:text-white/30" size={18} />
            <input
              required
              minLength={6}
              type={show ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-3 pl-10 pr-11 text-base sm:text-sm outline-none transition focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#5fc4b8] dark:focus:ring-[#5fc4b8]/20"
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2.5 top-2.5 rounded-md p-1.5 text-[#8b9a93] hover:text-[#0b1619] dark:text-white/40 dark:hover:text-white"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        {/* 2FA Opt-in Toggle */}
        <div className="rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] p-3 dark:border-white/10 dark:bg-white/5">
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={setup2FA}
              onChange={(e) => setSetup2FA(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-sm border-gray-300 text-[#009689] focus:ring-[#009689]"
            />
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#0b1619] dark:text-white">
                <ShieldCheck size={15} className="text-[#009689]" />
                Enable Two-Factor Authenticator (Recommended)
              </div>
              <p className="text-[11px] text-[#71817a] dark:text-white/50">
                Secure your books with Google Authenticator or Microsoft Authenticator.
              </p>
            </div>
          </label>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl bg-[#fff1ef] p-3 text-sm text-[#9b5147] dark:bg-[#3d1814] dark:text-[#fca5a5]">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <p className="text-xs leading-5 text-[#71817a] dark:text-white/50">
          By creating an account, you agree to use ReedShelf responsibly and enjoy peaceful, private reading.
        </p>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009689] py-3.5 text-base font-bold text-white shadow-md shadow-[#009689]/20 transition-all duration-200 hover:bg-[#007f74] active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Creating account...
            </>
          ) : (
            'Sign up'
          )}
        </button>

        {/* Divider */}
        <div className="relative my-3 flex items-center justify-center pt-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#e4e1d6] dark:border-white/10" />
          </div>
          <span className="relative bg-white px-3 text-xs font-bold uppercase tracking-wider text-[#8b9a93] dark:bg-[#12232a] dark:text-white/40">
            or
          </span>
        </div>

        {/* Google Sign-up Button */}
        <GoogleAuthButton
          mode="signup"
          onSuccess={(user) => handleAuthSuccess(user)}
          onRequire2FA={(data) => setTwoFactorData(data)}
          onError={(err) => setError(err)}
          disabled={loading}
        />

        <div>
          <Link
            to="/sign-in"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#063b5c] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0a4d74] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </form>

      {/* 2FA Setup Modal if user opted in */}
      {showSetup2FAModal && (
        <TwoFactorSetupModal
          isOpen={showSetup2FAModal}
          onClose={() => {
            setShowSetup2FAModal(false);
            navigate('/app/home', { replace: true });
          }}
          onSuccess={() => {
            setShowSetup2FAModal(false);
            navigate('/app/home', { replace: true });
          }}
        />
      )}

      {/* 2FA Verification Modal if existing 2FA account logs in */}
      {twoFactorData && (
        <TwoFactorVerifyModal
          tempToken={twoFactorData.tempToken}
          email={twoFactorData.email}
          onSuccess={handleAuthSuccess}
          onCancel={() => setTwoFactorData(null)}
        />
      )}
    </AuthLayout>
  );
}
