import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { loginUser } from '../lib/appStore';
import { Mail, Lock, AlertCircle, Loader2, Eye, EyeOff, ArrowRight } from 'lucide-react';

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await loginUser(form);
      navigate(location.state?.from || '/app/home', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      split={true}
      title="Sign in to ReedShelf"
      subtitle="Welcome back! Enter your credentials to access your library."
      leftHeadline={
        <>
          Is your reading habit like a{' '}
          <span className="italic font-normal text-[#009689] dark:text-[#5fc4b8]">
            reed
          </span>{' '}
          that isn't stable?
        </>
      }
      leftCallout="Reed is here for you."
      leftWriteup="When your daily reading routine bends and sways under everyday distractions, ReedShelf keeps you anchored. Build steady reading habits, organize your library, and grow one chapter at a time."
      imageSrc="/images/reed-plant.jpg"
      imageAlt="A tranquil reed plant swaying gracefully"
      imageCaption="“The reed bends to the breeze, yet stands forever rooted.”"
      imageSubcaption="Build a daily reading rhythm that stands strong."
      footer={
        <div className="space-y-2">
          <p>
            New to ReedShelf?{' '}
            <Link className="font-semibold text-[#009689] hover:underline dark:text-[#5fc4b8]" to="/register">
              Create an account
            </Link>{' '}
            for free cloud book storage.
          </p>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl bg-[#fff1ef] p-3 text-sm text-[#9b5147] dark:bg-[#3d1814] dark:text-[#fca5a5]">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[#557067] dark:text-white/60">
            Email address
          </span>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3.5 text-[#8b9a93] dark:text-white/30" size={18} />
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-3 pl-10 pr-3 text-base sm:text-sm outline-none transition focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#5fc4b8] dark:focus:ring-[#5fc4b8]/20"
              placeholder="name@example.com"
              autoComplete="email"
            />
          </div>
        </label>

        <label className="block">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#557067] dark:text-white/60">
              Password
            </span>
            <Link
              to="/forgot-password"
              tabIndex={-1}
              className="text-xs font-semibold text-[#009689] transition hover:underline dark:text-[#5fc4b8]"
            >
              Forgotten password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3.5 top-3.5 text-[#8b9a93] dark:text-white/30" size={18} />
            <input
              required
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-3 pl-10 pr-10 text-base sm:text-sm outline-none transition focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/15 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#5fc4b8] dark:focus:ring-[#5fc4b8]/20"
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-3 top-3.5 text-[#8b9a93] hover:text-[#0b1619] dark:text-white/40 dark:hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009689] py-3.5 text-base font-bold text-white shadow-md shadow-[#009689]/20 transition-all duration-200 hover:bg-[#007f74] active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={19} className="animate-spin" /> Signing in...
            </>
          ) : (
            <>
              Sign in <ArrowRight size={17} />
            </>
          )}
        </button>

        {/* Facebook-style Divider */}
        <div className="relative my-5 flex items-center justify-center pt-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#e4e1d6] dark:border-white/10" />
          </div>
          <span className="relative bg-white px-3 text-xs font-bold uppercase tracking-wider text-[#8b9a93] dark:bg-[#12232a] dark:text-white/40">
            or
          </span>
        </div>

        {/* Facebook-style Create Account Button */}
        <div>
          <Link
            to="/register"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#063b5c] py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#0a4d74] dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
          >
            Create new account
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}
