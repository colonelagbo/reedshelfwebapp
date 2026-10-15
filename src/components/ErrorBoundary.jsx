import React from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ReedShelf Caught Error:', error, errorInfo);
  }

  handleReload = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          await reg.unregister();
        }
      }
    } catch {}
    window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#f6f4ee] p-6 text-[#0b1619] dark:bg-[#0b1619] dark:text-white">
          <div className="max-w-md w-full rounded-3xl border border-[#e4e1d6] bg-white p-7 text-center shadow-xl dark:border-white/10 dark:bg-[#142326]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle size={28} />
            </div>
            <h1 className="mt-4 text-xl font-bold">Something went wrong</h1>
            <p className="mt-2 text-xs text-[#6b7a77] dark:text-white/60">
              ReedShelf encountered an unexpected issue while displaying this page. Tap below to refresh your session.
            </p>
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#009689] py-3 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] active:scale-95 cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Clear Cache & Reload App</span>
              </button>
              <button
                type="button"
                onClick={() => (window.location.href = '/')}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe5dc] py-2.5 text-xs font-semibold text-[#6b7a77] transition hover:bg-black/5 dark:border-white/10 dark:text-white/70"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
