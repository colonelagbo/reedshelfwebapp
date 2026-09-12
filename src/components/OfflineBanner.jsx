import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowRestored(true);
      const timer = setTimeout(() => setShowRestored(false), 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowRestored(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !showRestored) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-2 left-1/2 z-50 -translate-x-1/2 w-[92%] max-w-sm animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-none"
    >
      {!isOnline ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/95 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
          <WifiOff size={14} className="shrink-0 animate-pulse" />
          <span>You are offline. Cached books and pages are accessible.</span>
        </div>
      ) : showRestored ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-600/95 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur-md">
          <Wifi size={14} className="shrink-0" />
          <span>Connection restored. Back online!</span>
        </div>
      ) : null}
    </div>
  );
}
