import { useState, useEffect } from 'react';
import {
  ShieldCheck,
  QrCode,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  X,
  Smartphone,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { api } from '../lib/api';

export function TwoFactorSetupModal({
  isOpen,
  onClose,
  onSuccess,
  isMandatory = false,
}) {
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configData, setConfigData] = useState(null); // { secret, otpauthUrl, qrCodeUrl }
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoadingConfig(true);
    setError('');
    setSuccess(false);
    setCode('');

    api.auth.setup2FA()
      .then((data) => {
        if (mounted) {
          setConfigData(data);
          setLoadingConfig(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to initialize authenticator setup.');
          setLoadingConfig(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const handleCopySecret = () => {
    if (!configData?.secret) return;
    navigator.clipboard.writeText(configData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit code shown in your authenticator app.');
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const res = await api.auth.enable2FA({
        secret: configData.secret,
        code: code.trim(),
      });

      setSuccess(true);
      setTimeout(() => {
        if (onSuccess) onSuccess(res.user);
        if (onClose) onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Invalid code. Please check Google Authenticator and try again.');
    } finally {
      setVerifying(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-2xl dark:border-white/15 dark:bg-[#12232a] sm:p-7">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#e6f4f2] text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
              <ShieldCheck size={26} />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[#0b1619] dark:text-white">
                Set up Authenticator App
              </h2>
              <p className="text-xs text-[#6b7a77] dark:text-white/60">
                Google Authenticator / 2-Step Verification
              </p>
            </div>
          </div>

          {!isMandatory && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-1 text-[#6b7a77] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-[#fff1ef] p-3 text-xs text-[#9b5147] dark:bg-[#3d1814] dark:text-[#fca5a5]">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="my-8 text-center space-y-3">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#dcfce7] text-[#16a34a] dark:bg-[#052e16] dark:text-[#86efac]">
              <CheckCircle2 size={36} />
            </div>
            <h3 className="font-display text-xl font-bold text-[#0b1619] dark:text-white">
              Authenticator Activated!
            </h3>
            <p className="text-xs text-[#6b7a77] dark:text-white/60">
              Your account is now protected with two-step authenticator verification.
            </p>
          </div>
        ) : loadingConfig ? (
          <div className="my-12 text-center text-xs text-[#6b7a77] dark:text-white/50">
            <Loader2 size={28} className="mx-auto animate-spin text-[#009689] mb-3" />
            Generating your secure authenticator secret...
          </div>
        ) : (
          <div className="mt-5 space-y-5">
            {/* Step 1: Scan QR */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#009689] dark:text-[#5fc4b8] flex items-center gap-1.5 mb-2">
                <span>1. Scan QR Code</span>
              </p>
              <p className="text-xs text-[#6b7a77] dark:text-white/60 mb-3">
                Open <span className="font-semibold text-[#0b1619] dark:text-white">Google Authenticator</span>, tap <span className="font-semibold">+</span>, and scan this code:
              </p>

              <div className="flex justify-center">
                <div className="rounded-2xl border border-[#e4e1d6] bg-white p-2.5 sm:p-3 shadow-xs dark:border-white/15">
                  <img
                    src={configData?.qrCodeUrl}
                    alt="Authenticator QR Code"
                    className="h-36 w-36 sm:h-44 sm:w-44 rounded-xl object-contain"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Manual Secret Key */}
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-[#009689] dark:text-[#5fc4b8] flex items-center gap-1.5 mb-1.5">
                <span>2. Or enter secret key manually</span>
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] p-2.5 dark:border-white/10 dark:bg-white/5">
                <code className="flex-1 font-mono text-xs font-bold tracking-wider text-[#009689] dark:text-[#5fc4b8] select-all truncate">
                  {configData?.secret}
                </code>
                <button
                  type="button"
                  onClick={handleCopySecret}
                  className="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-white px-3 py-1 text-[11px] font-semibold text-[#0b1619] shadow-2xs border border-[#e4e1d6] hover:bg-[#f6f4ee] dark:border-white/10 dark:bg-white/10 dark:text-white touch-manipulation"
                >
                  {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            {/* Step 3: Enter code to confirm */}
            <form onSubmit={handleActivate} className="border-t border-[#e4e1d6] pt-4 dark:border-white/10">
              <p className="text-xs font-bold uppercase tracking-wider text-[#009689] dark:text-[#5fc4b8] mb-1.5">
                <span>3. Enter 6-digit confirmation code</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="flex-1 rounded-xl border border-[#d5ddd1] bg-[#fbfcf9] py-2.5 px-3 text-center text-lg font-mono font-bold tracking-widest text-[#0b1619] focus:border-[#009689] focus:outline-hidden dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                <button
                  type="submit"
                  disabled={verifying || code.length !== 6}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl bg-[#009689] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] disabled:opacity-40 shrink-0 touch-manipulation"
                >
                  {verifying ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <KeyRound size={15} />
                  )}
                  <span>Activate</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {!success && (
          <div className="mt-5 flex justify-end border-t border-[#e4e1d6] pt-3.5 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] rounded-xl border border-[#d5ddd1] px-4 py-2 text-xs font-semibold text-[#6b7a77] hover:bg-[#f6f4ee] dark:border-white/15 dark:text-white/70 touch-manipulation"
            >
              {isMandatory ? 'Skip for now' : 'Cancel'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
