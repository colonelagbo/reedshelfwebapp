import { useState, useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Download, RefreshCw, X, Share, PlusSquare, Smartphone } from 'lucide-react';

export function PWAPrompt() {
  // Service Worker auto-register & update handling
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, r) {
      console.log('ReedShelf Service Worker successfully registered:', swUrl, r);
    },
    onRegisterError(error) {
      console.error('ReedShelf Service Worker registration failed:', error);
    },
  });

  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);

  useEffect(() => {
    // 1. Check if the app is already launched in standalone mode (installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      // Already running as installed PWA; do not prompt to install
      return;
    }

    // 2. Check if user dismissed the prompt recently (within 7 days)
    const dismissedAt = localStorage.getItem('reedshelf_pwa_dismissed');
    if (dismissedAt) {
      const daysSinceDismiss = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < 7) {
        return;
      }
    }

    // 3. Android / Chrome / Edge: Catch beforeinstallprompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPromptEvent(e);
      // Wait 3 seconds after page load before showing the polite banner
      setTimeout(() => setShowInstallBanner(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. iOS Safari detection
    const isIOSDevice =
      /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
      !window.MSStream &&
      !/crios/i.test(window.navigator.userAgent); // Safari, not Chrome on iOS

    setIsIOS(isIOSDevice);

    if (isIOSDevice && !isStandalone) {
      // On iOS Safari, show after a short delay if not dismissed
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 4000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    // 5. Track if user successfully installed
    const handleAppInstalled = () => {
      console.log('ReedShelf PWA was installed successfully');
      setShowInstallBanner(false);
      setInstallPromptEvent(null);
      localStorage.setItem('reedshelf_pwa_installed', 'true');
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // 6. Support manual trigger from buttons anywhere in the app
    const handleTriggerInstall = () => {
      setShowInstallBanner(true);
      if (isIOSDevice) {
        setShowIOSInstructions(true);
      }
    };
    window.addEventListener('reedshelf-trigger-install', handleTriggerInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('reedshelf-trigger-install', handleTriggerInstall);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (!installPromptEvent) return;

    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      setInstallPromptEvent(null);
      localStorage.setItem('reedshelf_pwa_installed', 'true');
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    setShowIOSInstructions(false);
    localStorage.setItem('reedshelf_pwa_dismissed', Date.now().toString());
  };

  return (
    <>
      {/* 1. New Version Available / Update Prompt Banner */}
      {needRefresh && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 z-50 -translate-x-1/2 w-[92%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#009689]/30 bg-white/95 p-3.5 shadow-xl shadow-black/10 backdrop-blur-md dark:border-white/10 dark:bg-[#12232a]/95">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#e6f4f2] text-[#009689] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <RefreshCw size={18} className="animate-spin" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#0b1619] dark:text-white truncate">
                  New update available!
                </p>
                <p className="text-[11px] text-[#6b7a77] dark:text-white/60 truncate">
                  Refresh to use the latest version of ReedShelf.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => updateServiceWorker(true)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[#009689] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] touch-manipulation"
              >
                Reload
              </button>
              <button
                onClick={() => setNeedRefresh(false)}
                className="rounded-lg p-1.5 text-[#6b7a77] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10 touch-manipulation"
                title="Dismiss"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Install ReedShelf Banner (Non-intrusive) */}
      {showInstallBanner && !needRefresh && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 z-40 -translate-x-1/2 w-[92%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-2xl border border-[#e4e1d6] bg-white/95 p-3.5 shadow-xl shadow-black/10 backdrop-blur-md dark:border-white/10 dark:bg-[#12232a]/95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#009689] text-white shadow-sm">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#0b1619] dark:text-white">
                    Install ReedShelf App
                  </h3>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-[#6b7a77] dark:text-white/65 leading-tight">
                    Add to your home screen for an instant, full-screen reading experience.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="rounded-lg p-1 text-[#6b7a77] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10 touch-manipulation shrink-0"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            {/* iOS Instructions Drawer or Action Buttons */}
            {showIOSInstructions ? (
              <div className="mt-3 rounded-xl bg-[#f6f4ee] p-3 text-xs dark:bg-white/5 space-y-1.5 border border-[#e4e1d6]/70 dark:border-white/5">
                <p className="font-semibold text-[#009689] dark:text-[#5fc4b8]">
                  How to install on iPhone / iPad:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[#4a5a58] dark:text-white/80 text-[11px]">
                  <li className="flex items-center gap-1.5">
                    <span>1. Tap Safari&apos;s Share button</span>
                    <Share size={13} className="text-[#009689] shrink-0" />
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span>2. Scroll down and tap</span>
                    <strong className="text-[#0b1619] dark:text-white inline-flex items-center gap-1">
                      Add to Home Screen <PlusSquare size={13} className="shrink-0" />
                    </strong>
                  </li>
                  <li>3. Tap <strong>Add</strong> in the top right</li>
                </ol>
                <button
                  onClick={handleDismiss}
                  className="mt-2 w-full rounded-lg bg-[#009689] py-1.5 text-center text-xs font-bold text-white touch-manipulation"
                >
                  Got it
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  onClick={handleDismiss}
                  className="min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#6b7a77] hover:bg-black/5 dark:text-white/70 touch-manipulation"
                >
                  Not now
                </button>
                <button
                  onClick={handleInstallClick}
                  className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#009689] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] touch-manipulation"
                >
                  <Download size={14} />
                  <span>Install ReedShelf</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
