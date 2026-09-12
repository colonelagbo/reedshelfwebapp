import { useState, useRef, useEffect } from 'react';
import { Mail, ShieldCheck, AlertCircle, Loader2, ArrowLeft, RefreshCw, Sparkles, CheckCircle2 } from 'lucide-react';

export function EmailVerificationModal({
  email,
  devCode,
  onVerify,
  onResend,
  onCancel,
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const [resendSuccess, setResendSuccess] = useState('');
  const [currentDevCode, setCurrentDevCode] = useState(devCode || '');
  const inputRefs = useRef([]);

  // Resend cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Focus first input box on mount
  useEffect(() => {
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
      setError('Please enter all 6 digits of the verification code.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onVerify(code);
    } catch (err) {
      setError(err.message || 'Verification failed. Please check the code.');
      // Auto clear input on error so user can retry easily
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResending(true);
    setError('');
    setResendSuccess('');
    try {
      const res = await onResend();
      setCooldown(res?.cooldownSeconds || 60);
      if (res?.devCode) {
        setCurrentDevCode(res.devCode);
      }
      setResendSuccess('A new verification code has been sent!');
      setTimeout(() => setResendSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const fillDevCode = () => {
    if (!currentDevCode || currentDevCode.length !== 6) return;
    const parts = currentDevCode.split('');
    setDigits(parts);
    executeVerification(currentDevCode);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#12232a] animate-in fade-in zoom-in-95 duration-200">
        {/* Top bar with back/edit action */}
        <div className="flex items-center justify-between pb-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold text-[#6b7a77] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10 transition"
          >
            <ArrowLeft size={15} />
            <span>Change email</span>
          </button>
          <span className="rounded-full bg-[#009689]/10 px-2.5 py-0.5 text-[11px] font-bold text-[#009689] dark:bg-[#009689]/20">
            Step 2 of 2
          </span>
        </div>

        <div className="text-center">
          {/* Header Icon */}
          <div className="relative mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#e6f4f2] text-[#009689] shadow-sm dark:bg-[#009689]/20">
            <Mail size={32} />
            <span className="absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[#009689] text-white shadow-xs">
              <ShieldCheck size={14} />
            </span>
          </div>

          <h2 className="font-display text-xl font-bold text-[#0b1619] dark:text-white">
            Verify Your Email
          </h2>
          <p className="mt-1.5 text-xs leading-relaxed text-[#6b7a77] dark:text-white/60">
            We sent a 6-digit authenticator code to:
          </p>
          <div className="mt-1 inline-block rounded-xl bg-[#f6f4ee] px-3 py-1 text-xs font-bold text-[#009689] dark:bg-white/5 dark:text-[#5fc4b8]">
            {email}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#fff1ef] p-3 text-xs text-[#9b5147] dark:bg-[#3d1814] dark:text-[#fca5a5]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Resend Success Alert */}
        {resendSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#edfbf7] p-3 text-xs text-[#007268] dark:bg-[#004d40]/30 dark:text-[#4db6ac]">
            <CheckCircle2 size={16} className="shrink-0 text-[#009689]" />
            <span>{resendSuccess}</span>
          </div>
        )}

        {/* 6 Digit Input Boxes */}
        <div className="my-6">
          <label className="block text-center text-xs font-semibold text-[#0b1619] dark:text-white mb-3">
            Enter 6-digit code
          </label>
          <div className="flex justify-center gap-2 sm:gap-2.5">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => (inputRefs.current[idx] = el)}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                disabled={loading}
                onChange={(e) => handleChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                className="h-13 w-11 sm:h-14 sm:w-12 rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] text-center font-mono text-xl sm:text-2xl font-bold text-[#0b1619] shadow-2xs transition focus:border-[#009689] focus:bg-white focus:ring-2 focus:ring-[#009689]/20 focus:outline-hidden disabled:opacity-50 dark:border-white/15 dark:bg-white/5 dark:text-white dark:focus:border-[#009689]"
              />
            ))}
          </div>
        </div>

        {/* Dev Mode Auto-fill hint */}
        {currentDevCode && (
          <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/80 p-2.5 text-xs text-teal-900 dark:border-teal-900/40 dark:bg-teal-950/30 dark:text-teal-200">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-[11px] font-medium">
                <Sparkles size={13} className="text-[#009689]" />
                Dev code: <strong className="font-mono">{currentDevCode}</strong>
              </span>
              <button
                type="button"
                onClick={fillDevCode}
                className="rounded-lg bg-[#009689] px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:bg-[#007268] transition"
              >
                Auto-fill
              </button>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="button"
          disabled={loading || digits.join('').length !== 6}
          onClick={() => executeVerification()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#009689] py-3 text-sm font-bold text-white shadow-md shadow-[#009689]/20 transition hover:bg-[#007268] active:scale-[0.99] disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              <span>Verifying & Creating Account...</span>
            </>
          ) : (
            'Verify & Create Account'
          )}
        </button>

        {/* Resend Section */}
        <div className="mt-5 text-center">
          <p className="text-xs text-[#6b7a77] dark:text-white/60">
            Didn't receive the code? Check your spam folder or
          </p>
          <div className="mt-1.5">
            {cooldown > 0 ? (
              <span className="text-xs font-medium text-[#8b9a93] dark:text-white/40">
                Resend available in <strong className="text-[#0b1619] dark:text-white">{cooldown}s</strong>
              </span>
            ) : (
              <button
                type="button"
                disabled={resending || loading}
                onClick={handleResend}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#009689] hover:underline disabled:opacity-50 dark:text-[#5fc4b8]"
              >
                {resending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Sending code...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} />
                    <span>Resend verification code</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}