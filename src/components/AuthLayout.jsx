import { Link } from 'react-router-dom';
import { LogoPlaceholder } from './LogoPlaceholder';
import { ThemeToggle } from './ThemeToggle';

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative min-h-screen bg-[#f6f4ee] px-4 py-8 transition-colors duration-300 dark:bg-[#0b1619]">
      <ThemeToggle className="absolute right-4 top-4 border-[#e4e1d6] text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:text-white/60 dark:hover:border-[#d6a84a] dark:hover:text-[#d6a84a]" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md flex-col justify-center">
        <Link to="/" className="mx-auto mb-8"><LogoPlaceholder dark={false} /></Link>
        <div className="rounded-3xl border border-[#e4e1d6] bg-white p-6 shadow-xl shadow-[#0b1619]/5 dark:border-white/10 dark:bg-[#12232a] sm:p-8">
          <div className="mb-7 text-center">
            <h1 className="font-display text-3xl font-bold tracking-tight text-[#0b1619] dark:text-white">{title}</h1>
            <p className="mt-2 text-sm leading-6 text-[#6b7a77] dark:text-white/50">{subtitle}</p>
          </div>
          {children}
        </div>
        {footer && <p className="mt-5 text-center text-sm text-[#6b7a77] dark:text-white/50">{footer}</p>}
      </div>
    </div>
  );
}
