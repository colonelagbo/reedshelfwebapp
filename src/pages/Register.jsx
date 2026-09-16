import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, AlertCircle, Eye, EyeOff, Loader2, Smartphone, Download } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { registerUser } from '../lib/appStore';
import { TwoFactorVerifyModal } from '../components/TwoFactorVerifyModal';

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState(null);
  const navigate = useNavigate();
  const isStandalone = typeof window !== 'undefined' && (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );

  const handleAuthSuccess = () => {
    navigate('/app/home', { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Please enter your name.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password
      });
      handleAuthSuccess();
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
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
      {!isStandalone && (
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#009689]/25 bg-[#e6f4f2]/70 p-2.5 sm:p-3 dark:border-[#009689]/30 dark:bg-[#009689]/15">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#009689] text-white shadow-2xs">
              <Smartphone size={16} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#0b1619] dark:text-white truncate">
                Get the ReedShelf App
              </p>
              <p className="text-[11px] text-[#557067] dark:text-white/60 truncate">
                Install on phone for a faster reading experience
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('reedshelf-trigger-install'))}
            className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[#009689] px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-[#007268] active:scale-95 touch-manipulation shrink-0 ml-2"
          >
            <Download size={13} />
            <span>Install</span>
          </button>
        </div>
      )}

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
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009689] py-3.5 text-base font-bold text-white shadow-md shadow-[#009689]/20 transition-all duration-200 hover:bg-[#007f74] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Creating your account...
            </>
          ) : (
            'Create account'
          )}
        </button>

        <div className="pt-2">
          <Link
            to="/sign-in"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#063b5c] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0a4d74] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </form>

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
