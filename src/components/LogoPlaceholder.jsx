import { Link } from "react-router-dom";
import LogoMark from "../assets/logo-mark-only.svg";

export function LogoPlaceholder({ compact = false, size, className = "" }) {
  let sizeClass = compact ? "h-7 w-auto" : "h-12 w-auto";
  if (size === "sm") sizeClass = "h-8 w-auto";
  if (size === "md") sizeClass = "h-11 w-auto";
  if (size === "lg") sizeClass = "h-16 w-auto";
  if (size === "xl") sizeClass = "h-20 sm:h-24 w-auto";

  return (
    <span className="inline-flex items-center transition-transform duration-200 hover:scale-[1.02]" aria-label="ReedShelf">
      <img
        src={LogoMark}
        alt="ReedShelf"
        className={`${sizeClass} ${className} drop-shadow-sm select-none`}
      />
    </span>
  );
}

export const LogoLink = ({ compact = false, size, className = "", onClick }) => (
  <Link to="/" onClick={onClick} className="inline-flex">
    <LogoPlaceholder compact={compact} size={size} className={className} />
  </Link>
);
