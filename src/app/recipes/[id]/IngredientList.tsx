"use client";

import { useState } from "react";
import type { Ingredient } from "@/lib/types";

/** Tap ingredients off as you gather them. */
export function IngredientList({ ingredients }: { ingredients: Ingredient[] }) {
  const [got, setGot] = useState<Set<number>>(new Set());
  const toggle = (n: number) => setGot((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  return (
    <ul className="card divide-y divide-line/70 p-2">
      {ingredients.map((i, n) => {
        const on = got.has(n);
        return (
          <li key={n}>
            <label className={`flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 hover:bg-cream ${on ? "opacity-50" : ""}`}>
              <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(n)} />
              <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold peer-focus-visible:ring-2 peer-focus-visible:ring-olive ${on ? "border-olive bg-olive text-cream" : "border-line bg-card"}`}>
                {on ? "✓" : ""}
              </span>
              <span className={on ? "line-through" : ""}>
                {(i.amount || i.unit) && <span className="font-bold">{[i.amount, i.unit].filter(Boolean).join(" ")} </span>}
                {i.item}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
