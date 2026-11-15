"use client";

import { useState } from "react";

export function Stars({ value, size = "text-lg" }: { value: number | null; size?: string }) {
  if (value == null) return <span className={`${size} text-muted`}>Not rated</span>;
  return (
    <span className={`${size} text-ochre`} role="img" aria-label={`${value} of 5 stars`}>
      {"★".repeat(value)}
      <span className="text-line">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export function StarPicker({ value, onPick, label = "Rate it" }: { value: number | null; onPick: (n: number) => void; label?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;
  return (
    <div role="group" aria-label={label} className="flex" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-pressed={value === n}
          onMouseEnter={() => setHover(n)}
          onClick={() => onPick(n)}
          className={`h-11 w-11 text-3xl leading-none ${n <= shown ? "text-ochre" : "text-line"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}
