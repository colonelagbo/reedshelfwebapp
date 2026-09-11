import { useState, useRef, useEffect } from 'react';
import { ShieldCheck, AlertCircle, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { api } from '../lib/api';

export function TwoFactorVerifyModal({
  tempToken,
  email,
  onSuccess,
  onCancel,
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => {
    // Auto-focus first input
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index, value) => {
    // Handle paste of 6 digits
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6);
      if (pasted) {
        const next = [...digits];
        for (let i = 0; i < pasted.length; i++) {
          next[i] = pasted[i];
        }
        setDigits(next);
        const nextFocus = Math.min(pasted.length, 5);
        inputRefs.current[nextFocus]?.focus();

        if (pasted.length === 6) {
          executeVerification(pasted);
        }
      }
      return;
    }

    // Single digit input
    const clean = value.replace(/\D/g, '');
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    setError('');

    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    const fullCode = next.join('');
    if (fullCode.length === 6) {
      executeVerification(fullCode);
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const executeVerification = async (codeToVerify) => {
    const code = codeToVerify || digits.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits from your authenticator app.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.auth.verify2FA({
        tempToken,
        code,
      });

      if (onSuccess) {
        onSuccess(res.user);
      }
    } catch (err) {
      setError(err.message || 'Invalid authenticator code. Please check your app and try again.');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-[#e4e1d6] bg-white p-7 shadow-2xl dark:border-white/15 dark:bg-[#12232a]">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#e6f4f2] text-[#009689] shadow-xs dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
          <ShieldCheck size={32} />
        </div>

        <div className="mt-4 text-center">
          <h2 className="font-display text-2xl font-bold text-[#0b1619] dark:text-white">
            Two-Step Authenticator
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#6b7a77] dark:text-white/60">
            Open <span className="font-semibold text-[#0b1619] dark:text-white">Google Authenticator</span> or your preferred authenticator app for{' '}
            <span className="font-semibold text-[#009689] dark:text-[#5fc4b8]">{email}</span> and enter the current 6-digit code.
          </p>
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#fff1ef] p-3 text-xs text-[#9b5147] dark:bg-[#3d1814] dark:text-[#fca5a5]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 6-Digit Code Input Boxes */}
        <div className="mt-6 flex justify-center gap-2 sm:gap-3">
          {digits.map((digit, idx) => (
            <input
              key={idx}
              ref={(el) => (inputRefs.current[idx] = el)}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              className="h-12 w-11 sm:h-14 sm:w-12 rounded-xl border-2 border-[#d5ddd1] bg-[#fbfcf9] text-center text-xl sm:text-2xl font-bold text-[#0b1619] focus:border-[#009689] focus:ring-4 focus:ring-[#009689]/15 focus:outline-hidden dark:border-white/20 dark:bg-white/5 dark:text-white dark:focus:border-[#5fc4b8]"
              disabled={loading}
              autoComplete="one-time-code"
            />
          ))}
        </div>

        <div className="mt-7 space-y-2.5">
          <button
            type="button"
            onClick={() => executeVerification()}
            disabled={loading || digits.join('').length !== 6}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009689] py-3.5 text-sm font-bold text-white shadow-md shadow-[#009689]/20 transition-all hover:bg-[#007268] active:scale-[0.99] disabled:opacity-40"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Verifying code...
              </>
            ) : (
              <>
                <KeyRound size={16} /> Verify & Sign in
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex w-full items-center justify-center gap-1.5 py-2 text-xs font-semibold text-[#6b7a77] hover:text-[#0b1619] dark:text-white/60 dark:hover:text-white transition"
          >
            <ArrowLeft size={14} /> Back to credentials
          </button>
        </div>
      </div>
    </div>
  );
}
