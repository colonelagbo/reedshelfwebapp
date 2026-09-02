import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { loginUser } from '../lib/appStore';
import { Mail, Lock, AlertCircle, Loader2 } from 'lucide-react';

export function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
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
      title="Sign in to ReedShelf"
      subtitle="Sign in to your ReedShelf library."
      footer={
        <span>
          New to ReedShelf?{' '}
          <Link className="font-semibold text-[#009689] dark:text-[#5fc4b8]" to="/register">
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="flex gap-2 rounded-xl bg-[#fff1ef] p-3 text-sm text-[#9b5147]">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Email</span>
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-[#8b9a93] dark:text-white/30" size={18} />
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-3 pl-10 pr-3 outline-none focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#5fc4b8] dark:focus:ring-[#5fc4b8]/20"
              placeholder="you@example.com"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Password</span>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-[#8b9a93] dark:text-white/30" size={18} />
            <input
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-3 pl-10 pr-3 outline-none focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/20 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/30 dark:focus:border-[#5fc4b8] dark:focus:ring-[#5fc4b8]/20"
              placeholder="••••••••"
            />
          </div>
        </label>
        <div className="-mt-1 flex justify-end">
          <Link to="/forgot-password" className="text-sm font-semibold text-[#009689] hover:underline">
            Forgotten password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009689] py-3.5 font-semibold text-white transition hover:bg-[#d6a84a] hover:text-[#0b1619] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
