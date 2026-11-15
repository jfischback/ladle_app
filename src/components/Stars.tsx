"use client";

import { useState } from "react";

/** Ratings are 1-5, shown as hearts ("how much did the family love it?"). */
function Heart({ filled, className }: { filled: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 20.5s-7.5-4.6-9.3-9.4C1.4 7.6 3.6 4 7.2 4c2.1 0 3.6 1.2 4.8 2.9C13.2 5.2 14.7 4 16.8 4c3.6 0 5.8 3.6 4.5 7.1-1.8 4.8-9.3 9.4-9.3 9.4z"
        fill={filled ? "var(--color-terracotta)" : "transparent"}
        stroke={filled ? "var(--color-terracotta)" : "var(--color-line)"}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const WORDS = ["", "Not a hit", "It was okay", "Pretty good", "Really liked it", "Family favorite!"];

export function Stars({ value, size = "text-lg" }: { value: number | null; size?: string }) {
  const h = size === "text-base" ? "h-4 w-4" : "h-5 w-5";
  if (value == null) return <span className="tag bg-ochre-soft text-ochre-dark">New to try</span>;
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${value} of 5 hearts`}>
      {[1, 2, 3, 4, 5].map((n) => <Heart key={n} filled={n <= value} className={h} />)}
    </span>
  );
}

export function StarPicker({ value, onPick, label = "Rate it" }: { value: number | null; onPick: (n: number) => void; label?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div>
      <div role="group" aria-label={label} className="flex" onMouseLeave={() => setHover(null)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} heart${n > 1 ? "s" : ""}: ${WORDS[n]}`}
            aria-pressed={value === n}
            onMouseEnter={() => setHover(n)}
            onClick={() => onPick(n)}
            className="flex h-11 w-10 items-center justify-center transition-transform hover:scale-110 active:scale-90"
          >
            <Heart filled={n <= shown} className="h-8 w-8" />
          </button>
        ))}
      </div>
      <p className="h-5 pl-2 text-sm font-semibold text-terracotta-dark" aria-hidden="true">{WORDS[shown]}</p>
    </div>
  );
}
