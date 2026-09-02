import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { registerUser } from '../lib/appStore';

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      await registerUser(form);
      navigate('/app/home', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create a new account"
      subtitle="It’s quick and easy to start your personal reading library."
    >
      <form onSubmit={submit} className="space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Full name</span>
            <div className="relative">
              <User className="absolute left-3 top-3.5 text-[#8b9a93]" size={18} />
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-[#ccd4ce] bg-[#f7f8f6] py-3 pl-10 pr-3 outline-none focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/15"
                placeholder="Your name"
              />
            </div>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">Email</span>
            <div className="relative">
              <Mail className="absolute left-3 top-3.5 text-[#8b9a93]" size={18} />
              <input
                required
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-[#ccd4ce] bg-[#f7f8f6] py-3 pl-10 pr-3 outline-none focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/15"
                placeholder="you@example.com"
              />
            </div>
          </label>
        </div>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold">Password</span>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-[#8b9a93]" size={18} />
            <input
              required
              minLength={6}
              type={show ? 'text' : 'password'}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full rounded-lg border border-[#ccd4ce] bg-[#f7f8f6] py-3 pl-10 pr-11 outline-none focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/15"
              placeholder="At least 6 characters"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-2.5 top-2.5 rounded-md p-1.5 text-[#71817a]"
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>
        {error && (
          <div className="flex gap-2 rounded-lg bg-[#fff1ef] p-3 text-sm text-[#9b5147]">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        <p className="text-xs leading-5 text-[#71817a]">
          By creating an account, you agree to use ReedShelf responsibly and keep your account credentials private.
        </p>
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#009689] py-3.5 font-bold text-white transition hover:bg-[#007268] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Creating account...
            </>
          ) : (
            'Sign up'
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
