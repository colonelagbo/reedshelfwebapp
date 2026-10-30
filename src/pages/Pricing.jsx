import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  Sparkles,
  HardDrive,
  Zap,
  Shield,
  Clock,
  ArrowRight,
  HelpCircle,
  CheckCircle2,
  BookOpen,
  Bell,
  ArrowLeft,
  Mail,
  FileText,
  BookmarkCheck,
  Star,
  Flame
} from 'lucide-react';
import { getCurrentUser, getUserStorageUsage } from '../lib/appStore';
import { LogoPlaceholder } from '../components/LogoPlaceholder';
import { ThemeToggle } from '../components/ThemeToggle';
import { AppShell } from '../components/AppShell';

export function Pricing() {
  const user = getCurrentUser();
  const [waitlistEmail, setWaitlistEmail] = useState(user?.email || '');
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [storage] = useState(() => (user?.id ? getUserStorageUsage(user.id) : null));

  const handleWaitlistSubmit = (e) => {
    e.preventDefault();
    if (!waitlistEmail || !waitlistEmail.includes('@')) return;
    setWaitlistLoading(true);
    setTimeout(() => {
      setWaitlistLoading(false);
      setWaitlistSubmitted(true);
      try {
        const stored = JSON.parse(localStorage.getItem('reedshelf_paid_waitlist') || '[]');
        if (!stored.includes(waitlistEmail)) {
          stored.push(waitlistEmail);
          localStorage.setItem('reedshelf_paid_waitlist', JSON.stringify(stored));
        }
      } catch (err) {
        // Safe fallback
      }
    }, 600);
  };

  const content = (
    <div className="py-6 sm:py-10">
      {/* Header / Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#009689]/20 bg-[#e6f4f2] px-3.5 py-1.5 text-xs font-bold text-[#007268] dark:border-[#5fc4b8]/20 dark:bg-[#009689]/15 dark:text-[#5fc4b8] mb-4">
          <Sparkles size={14} className="shrink-0" />
          <span>Simple, Honest & Transparent Pricing</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#0b1619] dark:text-white">
          Plans built for mindful reading
        </h1>
        <p className="mt-3 text-sm sm:text-base lg:text-lg text-[#556963] dark:text-white/60 leading-relaxed max-w-2xl mx-auto">
          Start for free with generous storage to anchor your reading habit. Upgrade to our upcoming paid package when you are ready to expand your digital library.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="mt-10 sm:mt-14 mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8 items-stretch">
        {/* FREE PACKAGE */}
        <div className="relative flex flex-col rounded-3xl border-2 border-[#009689]/30 bg-white p-6 sm:p-8 shadow-lg shadow-[#009689]/5 dark:border-[#009689]/40 dark:bg-[#12232a] transition-all hover:shadow-xl">
          {/* Top Badge */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#009689]/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
              <BookmarkCheck size={13} /> Current Package
            </span>
            <span className="text-xs font-semibold text-[#7b8c84] dark:text-white/40">Free Forever</span>
          </div>

          <h2 className="text-2xl font-bold text-[#0b1619] dark:text-white">Free Package</h2>
          <p className="mt-1 text-xs sm:text-sm text-[#556963] dark:text-white/60">
            Everything you need to organize your essential books and develop a steady daily reading habit.
          </p>

          {/* Price Callout */}
          <div className="mt-5 pb-5 border-b border-[#e4e1d6] dark:border-white/10 flex items-baseline gap-1">
            <span className="text-4xl sm:text-5xl font-extrabold text-[#0b1619] dark:text-white">$0</span>
            <span className="text-sm font-medium text-[#7b8c84] dark:text-white/40">/ month</span>
          </div>

          {/* Storage Limit Highlight Box */}
          <div className="mt-6 rounded-2xl border border-[#009689]/20 bg-[#e6f4f2]/70 p-4 dark:border-[#009689]/30 dark:bg-[#009689]/10">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#009689] text-white">
                <HardDrive size={18} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#007268] dark:text-[#5fc4b8]">
                  Storage Allocation
                </p>
                <p className="mt-0.5 text-sm font-extrabold text-[#0b1619] dark:text-white">
                  Limited Storage Space of 50 MB
                </p>
                <p className="mt-1 text-xs text-[#556963] dark:text-white/60 leading-normal">
                  Each registered user receives 50 MB of cloud storage for PDF books — enough for 10–25 standard eBooks.
                </p>
              </div>
            </div>
          </div>

          {/* Feature List */}
          <div className="mt-6 space-y-3 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#7b8c84] dark:text-white/40">
              What's Included:
            </p>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#0b1619] dark:text-white/80">
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0 mt-0.5" />
                <span><strong>50 MB cloud storage limit</strong> per user account</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0 mt-0.5" />
                <span>Upload PDF books up to 50 MB per file</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0 mt-0.5" />
                <span>Distraction-free PDF reader with night & sepia modes</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0 mt-0.5" />
                <span>Custom reading plans & daily page pace tracking</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0 mt-0.5" />
                <span>Reading streak tracking & completion statistics</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0 mt-0.5" />
                <span>Progressive Web App (PWA) with offline reader mode</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0 mt-0.5" />
                <span>Instant sync across all your phones, tablets & laptops</span>
              </li>
            </ul>
          </div>

          {/* Action Button */}
          <div className="mt-8 pt-4 border-t border-[#e4e1d6] dark:border-white/10">
            {user ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-[#e6f4f2] py-3 text-sm font-bold text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <CheckCircle2 size={18} />
                <span>Your Active Plan (50 MB Quota)</span>
              </div>
            ) : (
              <Link
                to="/register"
                className="flex items-center justify-center gap-2 rounded-xl bg-[#009689] py-3.5 text-sm font-bold text-white shadow-md shadow-[#009689]/20 hover:bg-[#007268] active:scale-[0.99] transition"
              >
                <span>Get Started Free</span>
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>

        {/* PAID PACKAGE - COMING SOON */}
        <div className="relative flex flex-col rounded-3xl border-2 border-[#d6a84a]/40 bg-gradient-to-b from-white via-white to-[#fbf8f0] p-6 sm:p-8 shadow-xl shadow-[#d6a84a]/5 dark:border-[#d6a84a]/40 dark:from-[#12232a] dark:via-[#12232a] dark:to-[#172b33] transition-all hover:shadow-2xl">
          {/* Top Floating Badge */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#d6a84a] px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-[#0b1619] shadow-xs">
              <Sparkles size={13} className="text-[#0b1619]" /> Coming Soon
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#d6a84a]">
              <Star size={13} fill="#d6a84a" /> Premium Tier
            </span>
          </div>

          <h2 className="text-2xl font-bold text-[#0b1619] dark:text-white">Paid Package</h2>
          <p className="mt-1 text-xs sm:text-sm text-[#556963] dark:text-white/60">
            High-capacity cloud storage and advanced tools designed for power readers, students, and research collections.
          </p>

          {/* Price Callout */}
          <div className="mt-5 pb-5 border-b border-[#e4e1d6] dark:border-white/10 flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-extrabold text-[#d6a84a]">Coming Soon</span>
            <span className="text-xs font-medium text-[#7b8c84] dark:text-white/40">/ pricing TBA</span>
          </div>

          {/* Storage Highlight Box */}
          <div className="mt-6 rounded-2xl border border-[#d6a84a]/30 bg-[#fdf9f0] p-4 dark:border-[#d6a84a]/25 dark:bg-[#d6a84a]/10">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#d6a84a] text-[#0b1619]">
                <Zap size={18} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#b0842e] dark:text-[#e8c785]">
                  Expanded Cloud Storage
                </p>
                <p className="mt-0.5 text-sm font-extrabold text-[#0b1619] dark:text-white">
                  Multi-Gigabyte Extended Storage
                </p>
                <p className="mt-1 text-xs text-[#556963] dark:text-white/60 leading-normal">
                  Store hundreds of heavy PDFs, illustrated manuscripts, textbooks, and extensive literature without 50 MB limits.
                </p>
              </div>
            </div>
          </div>

          {/* Feature List */}
          <div className="mt-6 space-y-3 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-[#7b8c84] dark:text-white/40">
              Upcoming Capabilities:
            </p>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#0b1619] dark:text-white/80">
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#d6a84a] shrink-0 mt-0.5" />
                <span><strong>Multi-Gigabyte storage space</strong> (vastly upgraded from 50 MB)</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#d6a84a] shrink-0 mt-0.5" />
                <span>Unlimited PDF book uploads & huge file sizes</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#d6a84a] shrink-0 mt-0.5" />
                <span>Advanced reading analytics, velocity forecasts & habit heatmaps</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#d6a84a] shrink-0 mt-0.5" />
                <span>Enhanced highlights, annotations & PDF markdown export</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#d6a84a] shrink-0 mt-0.5" />
                <span>Priority high-speed cloud sync & background processing</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#d6a84a] shrink-0 mt-0.5" />
                <span>Early access to all newly released reader features</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Check size={16} className="text-[#d6a84a] shrink-0 mt-0.5" />
                <span>Priority customer support</span>
              </li>
            </ul>
          </div>

          {/* Action / Waitlist Form */}
          <div className="mt-8 pt-4 border-t border-[#e4e1d6] dark:border-white/10">
            {waitlistSubmitted ? (
              <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 py-3 text-xs sm:text-sm font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={17} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span>You are on the early access waitlist! We'll notify you first.</span>
              </div>
            ) : (
              <form onSubmit={handleWaitlistSubmit} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7b8c84] dark:text-white/40" />
                    <input
                      type="email"
                      required
                      placeholder="Enter email for early access"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      className="w-full rounded-xl border border-[#dfe5dc] bg-white pl-9 pr-3 py-2.5 text-xs sm:text-sm text-[#0b1619] placeholder-[#7b8c84] outline-none focus:border-[#d6a84a] focus:ring-1 focus:ring-[#d6a84a] dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/40"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={waitlistLoading}
                    className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl bg-[#d6a84a] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#0b1619] shadow-sm hover:bg-[#e8c785] active:scale-[0.98] transition disabled:opacity-60 cursor-pointer shrink-0"
                  >
                    <Bell size={15} />
                    <span>{waitlistLoading ? 'Adding...' : 'Notify Me'}</span>
                  </button>
                </div>
                <p className="text-[11px] text-center text-[#7b8c84] dark:text-white/40">
                  Be the first to know when the paid package launches. No spam ever.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* User Current Quota Snapshot (if logged in) */}
      {user && storage && (
        <div className="mt-10 mx-auto max-w-4xl rounded-2xl border border-[#e4e1d6] bg-white p-5 sm:p-6 shadow-xs dark:border-white/10 dark:bg-[#12232a]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e6f4f2] text-[#007268] dark:bg-[#009689]/20 dark:text-[#5fc4b8]">
                <HardDrive size={20} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#7b8c84] dark:text-white/40">
                  Your Account Status
                </p>
                <h3 className="text-base font-bold text-[#0b1619] dark:text-white">
                  Free Package Active — {storage.usedMB} MB used of 50 MB
                </h3>
              </div>
            </div>
            <div className="text-right sm:border-l sm:border-[#e4e1d6] sm:pl-6 dark:sm:border-white/10">
              <p className="text-xs text-[#7b8c84] dark:text-white/40">Available Free Space</p>
              <p className="text-lg font-bold text-[#009689] dark:text-[#5fc4b8]">{storage.remainingMB} MB remaining</p>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-[#e4e1d6] dark:bg-white/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                storage.percentUsed > 90
                  ? 'bg-red-500'
                  : storage.percentUsed > 70
                  ? 'bg-amber-500'
                  : 'bg-[#009689] dark:bg-[#5fc4b8]'
              }`}
              style={{ width: `${Math.max(3, Math.min(100, storage.percentUsed))}%` }}
            />
          </div>
        </div>
      )}

      {/* Feature Breakdown Table */}
      <div className="mt-14 mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#0b1619] dark:text-white">
            Feature Comparison
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#7b8c84] dark:text-white/50">
            Compare what is available now in the Free Package versus the upcoming Paid Package.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-[#e4e1d6] bg-white shadow-xs dark:border-white/10 dark:bg-[#12232a]">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="border-b border-[#e4e1d6] bg-[#f6f4ee]/70 text-[#0b1619] dark:border-white/10 dark:bg-white/[0.03] dark:text-white">
              <tr>
                <th className="py-3.5 px-4 font-bold">Feature</th>
                <th className="py-3.5 px-4 font-bold text-[#007268] dark:text-[#5fc4b8]">
                  Free Package
                </th>
                <th className="py-3.5 px-4 font-bold text-[#d6a84a]">
                  Paid Package (Coming Soon)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e1d6] dark:divide-white/10">
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#0b1619] dark:text-white">Cloud Storage Space</td>
                <td className="py-3.5 px-4 font-bold text-[#007268] dark:text-[#5fc4b8]">50 MB limited storage per user</td>
                <td className="py-3.5 px-4 font-bold text-[#d6a84a]">Multi-Gigabyte Expanded Storage</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#0b1619] dark:text-white">Max File Size per PDF</td>
                <td className="py-3.5 px-4 text-[#556963] dark:text-white/70">Up to 50 MB</td>
                <td className="py-3.5 px-4 text-[#556963] dark:text-white/70">Expanded / Large format</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#0b1619] dark:text-white">Mindful PDF Reader</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check size={16} /> Included
                </td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check size={16} /> Included
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#0b1619] dark:text-white">Reading Plans & Targets</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check size={16} /> Included
                </td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check size={16} /> Included
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#0b1619] dark:text-white">Progress & Streak Analytics</td>
                <td className="py-3.5 px-4 text-[#556963] dark:text-white/70">Standard Tracking</td>
                <td className="py-3.5 px-4 text-[#d6a84a] font-semibold">Advanced Insights & Heatmaps</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#0b1619] dark:text-white">Offline Reader / PWA</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check size={16} /> Included
                </td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check size={16} /> Included
                </td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#0b1619] dark:text-white">Cloud Sync Priority</td>
                <td className="py-3.5 px-4 text-[#556963] dark:text-white/70">Standard</td>
                <td className="py-3.5 px-4 text-[#d6a84a] font-semibold">Priority High Speed</td>
              </tr>
              <tr>
                <td className="py-3.5 px-4 font-medium text-[#0b1619] dark:text-white">Early Feature Access</td>
                <td className="py-3.5 px-4 text-[#7b8c84] dark:text-white/40">—</td>
                <td className="py-3.5 px-4 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check size={16} /> Yes (Priority Beta)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="mt-14 mx-auto max-w-3xl">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#0b1619] dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-[#7b8c84] dark:text-white/50">
            Have questions about ReedShelf packages and storage limits?
          </p>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 dark:border-white/10 dark:bg-[#12232a]">
            <h3 className="font-bold text-sm sm:text-base text-[#0b1619] dark:text-white flex items-center gap-2">
              <HelpCircle size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0" />
              What are the details of the Free package?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-[#556963] dark:text-white/70 leading-relaxed">
              Every registered user starts on the <strong>Free package</strong>, which includes a limited storage space of <strong>50 MB per user</strong>. This gives you complete access to our distraction-free PDF reader, custom reading plans, daily page targets, and offline PWA capabilities.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 dark:border-white/10 dark:bg-[#12232a]">
            <h3 className="font-bold text-sm sm:text-base text-[#0b1619] dark:text-white flex items-center gap-2">
              <HelpCircle size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0" />
              When is the Paid package coming?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-[#556963] dark:text-white/70 leading-relaxed">
              The <strong>paid package is coming soon!</strong> It will offer multi-gigabyte storage, advanced reading analytics, and priority sync for readers who want to host their complete digital libraries on ReedShelf. Enter your email in the waitlist above to be notified first.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 dark:border-white/10 dark:bg-[#12232a]">
            <h3 className="font-bold text-sm sm:text-base text-[#0b1619] dark:text-white flex items-center gap-2">
              <HelpCircle size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0" />
              What happens if I reach the 50 MB storage limit on the Free package?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-[#556963] dark:text-white/70 leading-relaxed">
              If your total uploaded books reach the 50 MB limit, you can easily delete finished books to make room for new ones. Once our paid package launches, you will be able to upgrade seamlessly to expand your quota.
            </p>
          </div>

          <div className="rounded-2xl border border-[#e4e1d6] bg-white p-5 dark:border-white/10 dark:bg-[#12232a]">
            <h3 className="font-bold text-sm sm:text-base text-[#0b1619] dark:text-white flex items-center gap-2">
              <HelpCircle size={16} className="text-[#009689] dark:text-[#5fc4b8] shrink-0" />
              Will the Free package always remain free?
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-[#556963] dark:text-white/70 leading-relaxed">
              Yes! Our goal is to promote mindful reading routines. The Free package with 50 MB storage space will continue to be freely available to all readers.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // If the user is logged in, wrap seamlessly inside AppShell
  if (user) {
    return (
      <AppShell>
        <div className="mx-auto max-w-6xl pb-12">
          {content}
        </div>
      </AppShell>
    );
  }

  // Otherwise, render standalone with public navigation header & footer
  return (
    <div className="min-h-screen bg-[#f6f4ee] text-[#0b1619] transition-colors duration-300 dark:bg-[#0b1619] dark:text-[#f6f4ee] flex flex-col justify-between">
      {/* Public Header */}
      <header className="sticky top-0 z-40 border-b border-[#e4e1d6] bg-[#f6f4ee]/95 backdrop-blur dark:border-white/10 dark:bg-[#0b1619]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="inline-flex items-center">
            <LogoPlaceholder size="md" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/sign-in"
              className="rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#557067] hover:text-[#0b1619] dark:text-white/70 dark:hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-xl bg-[#009689] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-[#007268] active:scale-95 transition"
            >
              Get Started
            </Link>
            <ThemeToggle className="h-9 w-9 border-[#e4e1d6] text-[#557067] hover:border-[#009689] hover:text-[#009689] dark:border-white/15 dark:text-white/60 dark:hover:border-[#d6a84a] dark:hover:text-[#d6a84a]" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl w-full px-4 sm:px-6 lg:px-8 flex-1">
        {content}
      </main>

      {/* Public Footer */}
      <footer className="border-t border-[#e4e1d6] py-6 text-center text-xs text-[#7b8c84] dark:border-white/10 dark:text-white/40">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>ReedShelf &copy; 2026. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link to="/sign-in" className="hover:text-[#009689] transition">Sign In</Link>
            <Link to="/register" className="hover:text-[#009689] transition">Create Account</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
