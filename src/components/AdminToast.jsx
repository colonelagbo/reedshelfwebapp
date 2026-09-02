import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success', duration = 4000) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 5000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-[calc(100%-2.5rem)] pointer-events-none">
        {toasts.map((t) => {
          let bg = 'bg-white border-[#e4e1d6] text-[#0b1619] dark:bg-[#12232a] dark:border-white/15 dark:text-white';
          let icon = <CheckCircle2 className="text-[#009689] shrink-0" size={19} />;

          if (t.type === 'error') {
            bg = 'bg-[#fff5f5] border-[#fecaca] text-[#991b1b] dark:bg-[#2b1618] dark:border-[#7f1d1d] dark:text-[#fca5a5]';
            icon = <AlertCircle className="text-[#dc2626] shrink-0" size={19} />;
          } else if (t.type === 'warning') {
            bg = 'bg-[#fffbeb] border-[#fde68a] text-[#92400e] dark:bg-[#2e210f] dark:border-[#78350f] dark:text-[#fde68a]';
            icon = <AlertTriangle className="text-[#d97706] shrink-0" size={19} />;
          } else if (t.type === 'info') {
            bg = 'bg-[#eff6ff] border-[#bfdbfe] text-[#1e40af] dark:bg-[#112138] dark:border-[#1e3a8a] dark:text-[#93c5fd]';
            icon = <Info className="text-[#2563eb] shrink-0" size={19} />;
          }

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 shadow-xl shadow-black/10 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3 ${bg}`}
              role="alert"
            >
              {icon}
              <p className="flex-1 text-xs sm:text-sm font-medium leading-snug">{t.message}</p>
              <button
                onClick={() => removeToast(t.id)}
                className="opacity-50 hover:opacity-100 transition p-0.5 rounded"
                aria-label="Close notification"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      success: (m) => console.log('[Toast Success]', m),
      error: (m) => console.error('[Toast Error]', m),
      warning: (m) => console.warn('[Toast Warning]', m),
      info: (m) => console.info('[Toast Info]', m),
    };
  }
  return ctx;
}
