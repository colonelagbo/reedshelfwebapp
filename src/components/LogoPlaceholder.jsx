import { Link } from "react-router-dom";
import ReedShelfLogo from "../assets/reedshelf-logo-transparent.svg";

export function LogoPlaceholder({ compact = false, dark = false }) {
  return (
    <span
      className={`inline-flex items-center rounded-xl ${dark ? "bg-[#f5f3ee] px-2 py-1.5" : "dark:bg-[#f5f3ee] dark:px-2 dark:py-1.5"}`}
      aria-label="ReedShelf"
    >
      <img
        src={ReedShelfLogo}
        alt="ReedShelf"
        className={compact ? "h-8 w-auto" : "h-10 w-auto"}
      />
    </span>
  );
}

export const LogoLink = ({ compact = false, dark = false, onClick }) => (
  <Link to="/" onClick={onClick} className="inline-flex">
    <LogoPlaceholder compact={compact} dark={dark} />
  </Link>
);
