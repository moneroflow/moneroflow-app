/**
 * Classic Menu Icon with Monero colors
 * Three horizontal lines (hamburger menu style)
 */
export function MenuIcon({ className = '', size = 24 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect x="3" y="6" width="18" height="2.5" rx="1.25" fill="url(#menuGradient)" />
      <rect x="3" y="10.75" width="18" height="2.5" rx="1.25" fill="url(#menuGradient)" />
      <rect x="3" y="15.5" width="18" height="2.5" rx="1.25" fill="url(#menuGradient)" />
      <defs>
        <linearGradient id="menuGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F26822" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
      </defs>
    </svg>
  );
}