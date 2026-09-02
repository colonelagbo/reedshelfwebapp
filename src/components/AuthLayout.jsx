import { Link } from 'react-router-dom';
import { LogoPlaceholder } from './LogoPlaceholder';
import { ThemeToggle } from './ThemeToggle';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  split = false,
  leftHeadline = "Is your reading habit like a reed that isn't stable?",
  leftCallout = "Reed is here for you.",
  leftWriteup = "When your daily routine bends and sways with life's distractions, ReedShelf keeps your reading life anchored. Build quiet, steady habits and grow one chapter at a time.",
  imageSrc = "/images/reed-plant.jpg",
  imageAlt = "A tranquil reed plant swaying gently",
  imageCaption = "“The reed bends to the breeze, yet stands forever rooted.”",
  imageSubcaption = "Built for mindful, grounding reading rituals.",
}) {
  if (!split) {
    return (
      <div className="relative min-h-screen bg-[#f6f4ee] px-4 py-8 transition-colors duration-300 dark:bg-[#0b1619]">
        <ThemeToggle className="absolute right-4 top-4 border-[#e4e1d6] text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:text-white/60 dark:hover:border-[#d6a84a] dark:hover:text-[#d6a84a]" />
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
          <Link to="/" className="mx-auto mb-8"><LogoPlaceholder size="xl" /></Link>
          <div className="rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-xl shadow-[#0b1619]/5 dark:border-white/10 dark:bg-[#12232a] sm:p-8">
            <div className="mb-7 text-center">
              <h1 className="font-display text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">{title}</h1>
              {subtitle && <p className="mt-2 text-sm leading-6 text-[#6b7a77] dark:text-white/50">{subtitle}</p>}
            </div>
            {children}
          </div>
          {footer && <p className="mt-5 text-center text-sm text-[#6b7a77] dark:text-white/50">{footer}</p>}
        </div>
      </div>
    );
  }

  const reedCard = (
    <div className="group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#e4e1d6] bg-white/75 p-2 shadow-xl shadow-[#0b1619]/5 backdrop-blur-sm dark:border-white/10 dark:bg-[#12232a]/70 w-full">
      <img
        src={imageSrc}
        alt={imageAlt}
        className="h-44 sm:h-56 lg:h-64 w-full object-cover rounded-xl sm:rounded-2xl transition duration-500 group-hover:scale-[1.02]"
        loading="lazy"
      />
      <div className="absolute inset-x-2 bottom-2 rounded-b-xl sm:rounded-b-2xl bg-gradient-to-t from-[#0b1619]/90 via-[#0b1619]/55 to-transparent p-4 sm:p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[#d6a84a]" />
          <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#d6a84a] font-semibold font-sans">
            The Reed Philosophy
          </span>
        </div>
        <p className="font-accent italic text-base sm:text-lg lg:text-xl text-[#f6f4ee] font-medium leading-snug tracking-wide">
          {imageCaption}
        </p>
        {imageSubcaption && (
          <p className="text-[11px] sm:text-xs text-white/75 font-sans mt-1 tracking-wide">
            {imageSubcaption}
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#f6f4ee] px-4 py-4 sm:px-6 lg:px-12 transition-colors duration-300 dark:bg-[#0b1619] flex flex-col justify-between">
      {/* Top Header Row with Theme Toggle */}
      <header className="w-full max-w-7xl mx-auto flex items-center justify-between pt-1 pb-2 sm:pb-4">
        {/* Mobile-only logo */}
        <div className="lg:hidden">
          <Link to="/" className="inline-flex items-center">
            <LogoPlaceholder size="md" />
          </Link>
        </div>
        <div className="ml-auto">
          <ThemeToggle className="border-[#e4e1d6] text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:text-white/60 dark:hover:border-[#d6a84a] dark:hover:text-[#d6a84a]" />
        </div>
      </header>

      {/* Main Responsive Grid */}
      <main className="w-full max-w-7xl mx-auto flex-1 flex flex-col justify-center py-2 sm:py-4 lg:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 xl:gap-16 items-center">
          {/* Left Column: Top Left Logo + Middle Story & Reed Plant Illustration */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Desktop Logo on top left */}
            <div className="hidden lg:block mb-8">
              <Link to="/" className="inline-flex">
                <LogoPlaceholder size="xl" />
              </Link>
            </div>

            {/* Left Middle: Headline & Write-up with stylish editorial typography */}
            <div className="space-y-3 sm:space-y-4 max-w-xl">
              <h1 className="font-accent text-2xl sm:text-3xl lg:text-[44px] xl:text-[50px] font-normal tracking-tight text-[#0b1619] dark:text-[#f6f4ee] leading-[1.2] lg:leading-[1.18]">
                {leftHeadline}
              </h1>

              {leftCallout && (
                <div className="flex items-center gap-2.5 sm:gap-3 pt-0.5">
                  <div className="h-[2px] w-6 sm:w-8 bg-[#d6a84a] rounded-full shrink-0" />
                  <p className="font-accent italic text-lg sm:text-xl lg:text-2xl font-medium text-[#009689] dark:text-[#5fc4b8] tracking-wide">
                    {leftCallout}
                  </p>
                </div>
              )}

              <p className="text-sm sm:text-base lg:text-lg text-[#4a635b] dark:text-white/75 leading-relaxed font-sans font-light max-w-xl">
                {leftWriteup}
              </p>
            </div>

            {/* Desktop Reed Plant Image showcase card */}
            <div className="hidden lg:block mt-7 max-w-lg">
              {reedCard}
            </div>
          </div>

          {/* Right Column: Sign In Card (Facebook style) */}
          <div className="lg:col-span-5 flex flex-col items-center lg:items-end w-full">
            <div className="w-full max-w-[430px] rounded-2xl sm:rounded-3xl border border-[#e4e1d6] bg-white p-5 sm:p-8 md:p-9 shadow-xl lg:shadow-2xl shadow-[#0b1619]/6 dark:border-white/10 dark:bg-[#12232a]">
              <div className="mb-5 sm:mb-6 text-left">
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-xs sm:text-sm text-[#6b7a77] dark:text-white/50">
                    {subtitle}
                  </p>
                )}
              </div>

              {children}
            </div>

            {footer && (
              <div className="mt-4 sm:mt-5 text-center w-full max-w-[430px] px-2 text-xs text-[#6b7a77] dark:text-white/50">
                {footer}
              </div>
            )}

            {/* Mobile Reed Plant Image Card (positioned below sign-in options on mobile) */}
            <div className="lg:hidden w-full max-w-[430px] mt-6">
              {reedCard}
            </div>
          </div>
        </div>
      </main>

      {/* Subtle Bottom Footer */}
      <footer className="w-full max-w-7xl mx-auto py-3 sm:py-4 text-center text-xs text-[#8b9a93] dark:text-white/40 border-t border-[#e4e1d6]/60 dark:border-white/5 mt-4 sm:mt-6">
        <span>ReedShelf &copy; 2026. All rights reserved.</span>
      </footer>
    </div>
  );
}
