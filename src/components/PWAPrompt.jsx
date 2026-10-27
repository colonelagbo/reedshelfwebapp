import { useState, useEffect, useCallback } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  Download,
  RefreshCw,
  X,
  Share,
  PlusSquare,
  Smartphone,
  Monitor,
  MoreVertical,
  Globe,
  HelpCircle,
} from 'lucide-react';

export function PWAPrompt() {
  // Service Worker auto-register & update handling
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(swUrl, r) {
      console.log('ReedShelf Service Worker successfully registered:', swUrl, r);
      if (r) {
        // Periodically check for new updates (every 30 minutes)
        setInterval(() => {
          r.update().catch(() => {});
        }, 30 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('ReedShelf Service Worker registration failed:', error);
    },
  });

  const [installPromptEvent, setInstallPromptEvent] = useState(() => {
    if (typeof window !== 'undefined' && window.__reedshelf_deferred_prompt) {
      return window.__reedshelf_deferred_prompt;
    }
    return null;
  });

  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [activeTab, setActiveTab] = useState('ios');
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  // Auto-apply update immediately if needRefresh is triggered
  useEffect(() => {
    if (needRefresh) {
      updateServiceWorker(true);
    }
  }, [needRefresh, updateServiceWorker]);

  // Check for updates when phone unlocks / tab becomes active, and reload when new SW takes control
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        navigator.serviceWorker.ready
          .then((reg) => reg.update())
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    let refreshing = false;
    const handleControllerChange = () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const detectDevice = useCallback(() => {
    if (typeof window === 'undefined') {
      return { isIOS: false, isAndroid: false, isInApp: false, tab: 'desktop' };
    }
    const ua = window.navigator.userAgent || '';
    const isIOS = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
    const isAndroid = /android/i.test(ua);
    const isInApp = /FBAN|FBAV|Instagram|Twitter|LinkedInApp|Snapchat|Line\/|MicroMessenger|musical_ly/i.test(ua);

    let tab = 'desktop';
    if (isIOS) tab = 'ios';
    else if (isAndroid) tab = 'android';

    return { isIOS, isAndroid, isInApp, tab };
  }, []);

  // Central install handler: triggers native prompt if available, otherwise opens rich guide modal
  const handleInstall = useCallback(async () => {
    const prompt = installPromptEvent || (typeof window !== 'undefined' ? window.__reedshelf_deferred_prompt : null);

    if (prompt) {
      try {
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice && choice.outcome === 'accepted') {
          if (typeof window !== 'undefined') {
            localStorage.setItem('reedshelf_pwa_installed', 'true');
            window.__reedshelf_deferred_prompt = null;
          }
          setInstallPromptEvent(null);
          setShowInstallBanner(false);
          setShowInstallModal(false);
          return;
        }
      } catch (err) {
        console.warn('Native install prompt invocation notice:', err);
      }
    }

    // Fallback: Show the comprehensive installation guide modal
    const { tab, isInApp } = detectDevice();
    setActiveTab(tab);
    setIsInAppBrowser(isInApp);
    setShowInstallModal(true);
    setShowInstallBanner(false);
  }, [installPromptEvent, detectDevice]);

  // Listen to install events across the app lifecycle
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if prompt was caught before React mounted
    if (window.__reedshelf_deferred_prompt && !installPromptEvent) {
      setInstallPromptEvent(window.__reedshelf_deferred_prompt);
    }

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.__reedshelf_deferred_prompt = e;
      setInstallPromptEvent(e);
    };

    const handlePromptReady = () => {
      if (window.__reedshelf_deferred_prompt) {
        setInstallPromptEvent(window.__reedshelf_deferred_prompt);
      }
    };

    const handleAppInstalled = () => {
      console.log('ReedShelf PWA was installed successfully');
      setShowInstallBanner(false);
      setShowInstallModal(false);
      setInstallPromptEvent(null);
      window.__reedshelf_deferred_prompt = null;
      localStorage.setItem('reedshelf_pwa_installed', 'true');
    };

    const handleTriggerInstall = () => {
      handleInstall();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('reedshelf-prompt-ready', handlePromptReady);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('reedshelf-app-installed', handleAppInstalled);
    window.addEventListener('reedshelf-trigger-install', handleTriggerInstall);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('reedshelf-prompt-ready', handlePromptReady);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('reedshelf-app-installed', handleAppInstalled);
      window.removeEventListener('reedshelf-trigger-install', handleTriggerInstall);
    };
  }, [handleInstall, installPromptEvent]);

  // Polite non-intrusive auto banner timer on initial page load (only if not dismissed recently)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.referrer.includes('android-app://');

    if (isStandalone) return;

    const dismissedAt = localStorage.getItem('reedshelf_pwa_dismissed');
    const isDismissed = dismissedAt && (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24) < 7;

    if (!isDismissed) {
      const timer = setTimeout(() => {
        setShowInstallBanner(true);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismissBanner = () => {
    setShowInstallBanner(false);
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
                type="button"
                onClick={() => updateServiceWorker(true)}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-[#009689] px-3 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] touch-manipulation"
              >
                Reload
              </button>
              <button
                type="button"
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

      {/* 2. Polite Install ReedShelf Banner (Non-intrusive) */}
      {showInstallBanner && !needRefresh && !showInstallModal && (
        <div className="fixed bottom-20 sm:bottom-6 left-1/2 z-40 -translate-x-1/2 w-[92%] max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="rounded-2xl border border-[#e4e1d6] bg-white/95 p-3.5 shadow-xl shadow-black/10 backdrop-blur-md dark:border-white/10 dark:bg-[#12232a]/95">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#009689] text-white shadow-sm">
                  <Smartphone size={20} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#0b1619] dark:text-white">
                    Download & Install ReedShelf
                  </h3>
                  <p className="mt-0.5 text-[11px] sm:text-xs text-[#6b7a77] dark:text-white/65 leading-tight">
                    Add to your home screen or desktop for fast, distraction-free reading.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDismissBanner}
                className="rounded-lg p-1 text-[#6b7a77] hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10 touch-manipulation shrink-0"
                title="Dismiss"
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleDismissBanner}
                className="min-h-[36px] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#6b7a77] hover:bg-black/5 dark:text-white/70 touch-manipulation"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleInstall}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-[#009689] px-4 py-1.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#007268] active:scale-95 touch-manipulation"
              >
                <Download size={14} />
                <span>Install App</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Comprehensive Install & Download Guide Modal */}
      {showInstallModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setShowInstallModal(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-3xl border border-[#e4e1d6] bg-white p-5 sm:p-7 shadow-2xl dark:border-white/10 dark:bg-[#12232a] max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#e4e1d6]/70 dark:border-white/10">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#009689] text-white shadow-md shadow-[#009689]/25">
                  <Download size={22} />
                </span>
                <div>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-[#0b1619] dark:text-white leading-snug">
                    Download & Install ReedShelf
                  </h3>
                  <p className="text-xs text-[#6b7a77] dark:text-white/60">
                    Get the standalone app for distraction-free reading
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="rounded-xl p-2 text-[#6b7a77] hover:bg-black/5 hover:text-[#0b1619] dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white transition touch-manipulation"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* In-app Browser Notice */}
            {isInAppBrowser && (
              <div className="mt-4 rounded-2xl bg-[#fff8eb] p-3.5 border border-[#d6a84a]/40 text-[#92400e] dark:bg-[#451a03]/40 dark:border-[#d6a84a]/30 dark:text-[#fcd34d] text-xs">
                <div className="flex items-start gap-2.5">
                  <HelpCircle size={16} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">In-App Browser Detected</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                      You are viewing ReedShelf inside an in-app browser (such as Instagram, Facebook, or WhatsApp). To install, tap the <strong>•••</strong> or <strong>Share</strong> button and choose <strong>Open in Safari</strong> or <strong>Open in Chrome</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Direct 1-Click Install Button if Native Prompt is Available */}
            {(installPromptEvent || (typeof window !== 'undefined' && window.__reedshelf_deferred_prompt)) && (
              <div className="mt-4 rounded-2xl bg-[#e6f4f2] p-4 text-center border border-[#009689]/20 dark:bg-[#009689]/15 dark:border-[#009689]/30">
                <p className="text-xs font-semibold text-[#007268] dark:text-[#5fc4b8] mb-2.5">
                  Your browser supports direct 1-click installation!
                </p>
                <button
                  type="button"
                  onClick={async () => {
                    const prompt = installPromptEvent || window.__reedshelf_deferred_prompt;
                    if (prompt) {
                      prompt.prompt();
                      const choice = await prompt.userChoice;
                      if (choice?.outcome === 'accepted') {
                        localStorage.setItem('reedshelf_pwa_installed', 'true');
                        setInstallPromptEvent(null);
                        window.__reedshelf_deferred_prompt = null;
                        setShowInstallModal(false);
                      }
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#009689] py-2.5 px-4 text-sm font-bold text-white shadow-md shadow-[#009689]/20 hover:bg-[#007268] active:scale-98 transition touch-manipulation"
                >
                  <Download size={16} />
                  <span>Install ReedShelf Directly</span>
                </button>
              </div>
            )}

            {/* Device Tabs */}
            <div className="mt-4">
              <div className="flex rounded-xl bg-[#f0ede4] p-1 dark:bg-white/5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('ios')}
                  className={`flex-1 py-2 px-2 rounded-lg text-center transition ${
                    activeTab === 'ios'
                      ? 'bg-white text-[#009689] shadow-xs dark:bg-[#0b1619] dark:text-[#5fc4b8]'
                      : 'text-[#6b7a77] hover:text-[#0b1619] dark:text-white/60 dark:hover:text-white'
                  }`}
                >
                  iPhone / iPad
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('android')}
                  className={`flex-1 py-2 px-2 rounded-lg text-center transition ${
                    activeTab === 'android'
                      ? 'bg-white text-[#009689] shadow-xs dark:bg-[#0b1619] dark:text-[#5fc4b8]'
                      : 'text-[#6b7a77] hover:text-[#0b1619] dark:text-white/60 dark:hover:text-white'
                  }`}
                >
                  Android
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('desktop')}
                  className={`flex-1 py-2 px-2 rounded-lg text-center transition ${
                    activeTab === 'desktop'
                      ? 'bg-white text-[#009689] shadow-xs dark:bg-[#0b1619] dark:text-[#5fc4b8]'
                      : 'text-[#6b7a77] hover:text-[#0b1619] dark:text-white/60 dark:hover:text-white'
                  }`}
                >
                  Desktop / Mac
                </button>
              </div>

              {/* Tab Content */}
              <div className="mt-4 space-y-3">
                {activeTab === 'ios' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#557067] dark:text-white/70 font-medium">
                      Follow these 3 simple steps in <strong>Safari</strong> on your iPhone or iPad:
                    </p>
                    <ol className="space-y-2.5 text-xs text-[#0b1619] dark:text-white/90">
                      <li className="flex items-start gap-2.5 rounded-xl border border-[#e4e1d6] bg-[#fbfcf9] p-3 dark:border-white/10 dark:bg-white/5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#009689] text-[11px] font-bold text-white">
                          1
                        </span>
                        <div>
                          <span>Tap the <strong>Share</strong> button at the bottom of the screen:</span>
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[#e6f4f2] px-2 py-0.5 text-xs font-semibold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                            <Share size={13} /> Share button
                          </div>
                        </div>
                      </li>

                      <li className="flex items-start gap-2.5 rounded-xl border border-[#e4e1d6] bg-[#fbfcf9] p-3 dark:border-white/10 dark:bg-white/5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#009689] text-[11px] font-bold text-white">
                          2
                        </span>
                        <div>
                          <span>Scroll down and tap:</span>
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[#e6f4f2] px-2 py-0.5 text-xs font-semibold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                            <PlusSquare size={13} /> Add to Home Screen
                          </div>
                        </div>
                      </li>

                      <li className="flex items-start gap-2.5 rounded-xl border border-[#e4e1d6] bg-[#fbfcf9] p-3 dark:border-white/10 dark:bg-white/5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#009689] text-[11px] font-bold text-white">
                          3
                        </span>
                        <div>
                          <span>Tap <strong>Add</strong> in the top-right corner.</span>
                          <p className="mt-0.5 text-[11px] text-[#6b7a77] dark:text-white/50">
                            ReedShelf will now launch from your home screen just like an App Store app!
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {activeTab === 'android' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#557067] dark:text-white/70 font-medium">
                      Follow these steps in <strong>Chrome</strong>, <strong>Samsung Internet</strong>, or <strong>Edge</strong>:
                    </p>
                    <ol className="space-y-2.5 text-xs text-[#0b1619] dark:text-white/90">
                      <li className="flex items-start gap-2.5 rounded-xl border border-[#e4e1d6] bg-[#fbfcf9] p-3 dark:border-white/10 dark:bg-white/5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#009689] text-[11px] font-bold text-white">
                          1
                        </span>
                        <div>
                          <span>Tap the <strong>Menu</strong> icon (3 dots) in the top-right corner of your browser:</span>
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[#e6f4f2] px-2 py-0.5 text-xs font-semibold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                            <MoreVertical size={13} /> Browser menu
                          </div>
                        </div>
                      </li>

                      <li className="flex items-start gap-2.5 rounded-xl border border-[#e4e1d6] bg-[#fbfcf9] p-3 dark:border-white/10 dark:bg-white/5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#009689] text-[11px] font-bold text-white">
                          2
                        </span>
                        <div>
                          <span>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>:</span>
                          <div className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-[#e6f4f2] px-2 py-0.5 text-xs font-semibold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                            <Download size={13} /> Install app / Add to Home screen
                          </div>
                        </div>
                      </li>

                      <li className="flex items-start gap-2.5 rounded-xl border border-[#e4e1d6] bg-[#fbfcf9] p-3 dark:border-white/10 dark:bg-white/5">
                        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#009689] text-[11px] font-bold text-white">
                          3
                        </span>
                        <div>
                          <span>Confirm by tapping <strong>Install</strong>.</span>
                          <p className="mt-0.5 text-[11px] text-[#6b7a77] dark:text-white/50">
                            The app will install directly to your device home screen and app drawer.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {activeTab === 'desktop' && (
                  <div className="space-y-3">
                    <p className="text-xs text-[#557067] dark:text-white/70 font-medium">
                      How to install ReedShelf on your computer:
                    </p>
                    <div className="space-y-2.5 text-xs text-[#0b1619] dark:text-white/90">
                      <div className="rounded-xl border border-[#e4e1d6] bg-[#fbfcf9] p-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center gap-2 font-bold text-[#009689] dark:text-[#5fc4b8]">
                          <Monitor size={15} />
                          <span>Google Chrome, Edge, or Brave</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#4a5a58] dark:text-white/80">
                          Look at the right side of the address bar (URL bar). Click the <strong>Install App</strong> icon (looks like a monitor or download symbol 📥) and click <strong>Install</strong>.
                        </p>
                        <p className="mt-1 text-[11px] text-[#6b7a77] dark:text-white/50">
                          Alternatively, click the 3 dots menu ⋮ &rarr; <em>Save and share</em> &rarr; <em>Install ReedShelf</em>.
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#e4e1d6] bg-[#fbfcf9] p-3 dark:border-white/10 dark:bg-white/5">
                        <div className="flex items-center gap-2 font-bold text-[#009689] dark:text-[#5fc4b8]">
                          <Globe size={15} />
                          <span>Mac (Safari on macOS Sonoma+)</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-[#4a5a58] dark:text-white/80">
                          Click <strong>File</strong> in the macOS menu bar at the top of your screen, then select <strong>Add to Dock...</strong>.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer / Done Button */}
            <div className="mt-5 pt-3 border-t border-[#e4e1d6]/70 dark:border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="w-full sm:w-auto rounded-xl bg-[#009689] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#007268] active:scale-95 transition touch-manipulation"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}