import { Link } from "react-router-dom";

export const NotFound = () => (
  <div className="grid min-h-screen place-items-center bg-[#f6f4ee] px-6 text-center text-[#0b1619] transition-colors duration-300 dark:bg-[#0b1619] dark:text-white">
    <div>
      <p className="font-display text-7xl font-bold text-[#009689] dark:text-[#5fc4b8]">404</p>
      <h1 className="font-display mt-3 text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-[#4a5a58] dark:text-white/60">
        The page you're looking for doesn't exist or has moved.
      </p>
      <Link
        to="/"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-[#009689] px-6 py-3 font-semibold text-white transition hover:bg-[#d6a84a] hover:text-[#0b1619]"
      >
        Back home
      </Link>
    </div>
  </div>
);
