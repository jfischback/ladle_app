/** The approved "ladle" wordmark: the d is a ladle (half-bowl with soup, straight handle with a hook). */
export function Wordmark({ className = "h-8 w-auto", ink = "#4F5B3A", soup = "#B5654A" }: { className?: string; ink?: string; soup?: string }) {
  return (
    <svg role="img" aria-label="ladle" viewBox="10 10 490 220" className={className}>
      <g fill="none" stroke={ink} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round">
        <path d="M40 60 V200" />
        <circle cx="122" cy="160" r="40" />
        <path d="M162 120 V200" />
        <path d="M200 150 A44 50 0 0 0 288 150" />
        <ellipse cx="244" cy="150" rx="44" ry="14" fill={soup} />
        <path d="M288 150 V75 A15 15 0 0 1 318 75 V80" />
        <path d="M348 60 V200" />
        <path d="M390 160 H470 A40 40 0 1 0 460.6 185.7" />
      </g>
    </svg>
  );
}
