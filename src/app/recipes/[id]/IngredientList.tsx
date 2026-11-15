"use client";

import { useEffect, useState } from "react";
import { setServingsFactor } from "./servings-store";
import type { Ingredient } from "@/lib/types";
import { scaleIngredient } from "@/lib/scaling";

/** Tap ingredients off as you gather them; change the servings and every amount follows. */
export function IngredientList({ recipeId, ingredients, servings, familyServings = null, why = null }: { recipeId: string; ingredients: Ingredient[]; servings?: number | null; familyServings?: number | null; why?: string | null }) {
  const [got, setGot] = useState<Set<number>>(new Set());
  const base = servings && servings > 0 ? servings : null;
  // Start at what the family eats (what the grocery list bought for), not what the recipe was written for.
  const start = base && familyServings ? Math.min(48, Math.max(1, familyServings)) : base;
  const [makes, setMakes] = useState(start ?? 0);
  const factor = base ? makes / base : 1;
  // Cooking mode uses the same servings.
  useEffect(() => setServingsFactor(recipeId, factor), [recipeId, factor]);
  const toggle = (n: number) => setGot((prev) => { const next = new Set(prev); if (next.has(n)) next.delete(n); else next.add(n); return next; });
  return (
    <div className="space-y-2">
      {base && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">Makes</span>
          <button type="button" aria-label="Fewer servings" className="btn-secondary h-9 min-h-9 w-9 px-0" disabled={makes <= 1} onClick={() => setMakes((m) => Math.max(1, m - 1))}>−</button>
          <span className="w-8 text-center text-lg font-bold" aria-live="polite">{makes}</span>
          <button type="button" aria-label="More servings" className="btn-secondary h-9 min-h-9 w-9 px-0" disabled={makes >= 48} onClick={() => setMakes((m) => Math.min(48, m + 1))}>+</button>
          <span className="text-muted">servings</span>
          {makes !== base && <button type="button" className="btn-quiet min-h-9 px-2 text-sm" onClick={() => setMakes(base)}>As written ({base})</button>}
          {start !== base && makes !== start && <button type="button" className="btn-quiet min-h-9 px-2 text-sm" onClick={() => setMakes(start!)}>For us ({start})</button>}
        </div>
      )}
      {base && start !== base && makes === start && why && <p className="text-sm text-muted">{why}</p>}
      <ul className="card divide-y divide-line/70 p-2">
        {ingredients.map((raw, n) => {
          const i = scaleIngredient(raw, factor);
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
    </div>
  );
}
