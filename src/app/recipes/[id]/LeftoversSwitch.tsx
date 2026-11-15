"use client";

import { useOptimistic, useTransition } from "react";
import { setLeftovers } from "@/app/actions/recipes";

/** Lets a family correct the automatic guess about whether a dinner makes good next-day leftovers. */
export function LeftoversSwitch({ id, good, why }: { id: string; good: boolean; why: string | null }) {
  const [value, setValue] = useOptimistic(good);
  const [, start] = useTransition();
  const choose = (v: boolean) => start(async () => { setValue(v); await setLeftovers(id, v); });
  return (
    <div>
      <p className="font-bold">Good for leftovers?</p>
      <div className="mt-1 flex gap-2" role="group" aria-label="Good for leftovers?">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => choose(v)}
            className={`btn min-h-9 border-2 px-3 text-sm ${value === v ? "border-olive bg-olive text-cream" : "border-line bg-card text-ink"}`}>
            {v ? "Yes, makes lunch" : "One night only"}
          </button>
        ))}
      </div>
      {!value && why && <p className="mt-1 text-xs text-muted">{why}.</p>}
    </div>
  );
}
