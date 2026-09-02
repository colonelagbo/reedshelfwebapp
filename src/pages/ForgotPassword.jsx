import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { AuthLayout } from '../components/AuthLayout';
import { resetPassword } from '../lib/appStore';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await resetPassword(email, password);
      setDone(true);
      setTimeout(() => navigate('/sign-in'), 1500);
    } catch (err) {
      setError(err.message || 'Could not reset password. Please check your email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your email and choose a new password.">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="flex gap-2 rounded-xl bg-[#fff1ef] p-3 text-sm text-[#9b5147]">
            <AlertCircle size={18} />
            {error}
          </div>
        )}
        {done && (
          <div className="flex gap-2 rounded-xl bg-[#e6f4f2] p-3 text-sm text-[#007268]">
            <CheckCircle size={18} />
            Password updated. Taking you to sign in…
          </div>
        )}
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">Email</span>
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 text-[#8b9a93]" size={18} />
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-3 pl-10 pr-3 outline-none focus:border-[#009689]"
              placeholder="you@example.com"
            />
          </div>
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold">New password</span>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 text-[#8b9a93]" size={18} />
            <input
              required
              minLength={6}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-3 pl-10 pr-3 outline-none focus:border-[#009689]"
              placeholder="At least 6 characters"
            />
          </div>
        </label>
        <button
          type="submit"
          disabled={done || loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009689] py-3.5 font-semibold text-white transition hover:bg-[#007268] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" /> Updating password...
            </>
          ) : (
            'Reset password'
          )}
        </button>
        <Link to="/sign-in" className="block text-center text-sm font-semibold text-[#009689] hover:underline">
          Back to sign in
        </Link>
      </form>
    </AuthLayout>
  );
}
