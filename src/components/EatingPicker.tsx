"use client";

import { useState, useTransition } from "react";
import { setEating } from "@/app/actions/plans";

type Eating = { adults: number; kids: number };

/** "Who's eating tonight?": company coming, or someone away. Sizes that night's groceries before the list is made. */
export function EatingPicker({ planId, index, eating, household }: { planId: string; index: number; eating: Eating | null | undefined; household: Eating }) {
  const [who, setWho] = useState<Eating>(eating ?? household);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const changed = who.adults !== (eating ?? household).adults || who.kids !== (eating ?? household).kids;
  const save = (next: Eating | null) =>
    start(async () => {
      setError(null);
      const r = await setEating(planId, index, next);
      if (r?.error) setError(r.error);
      else if (next == null) setWho(household);
    });
  const stepper = (key: keyof Eating, label: string, min: number) => (
    <div className="flex items-center gap-1.5">
      <button type="button" className="btn-secondary h-9 min-h-9 w-9 px-0" aria-label={`Fewer ${label}`} disabled={pending || who[key] <= min} onClick={() => setWho((w) => ({ ...w, [key]: w[key] - 1 }))}>−</button>
      <span className="w-14 text-center text-sm font-bold" aria-live="polite">{who[key]} {label}</span>
      <button type="button" className="btn-secondary h-9 min-h-9 w-9 px-0" aria-label={`More ${label}`} disabled={pending || who[key] >= 30} onClick={() => setWho((w) => ({ ...w, [key]: w[key] + 1 }))}>+</button>
    </div>
  );
  return (
    <div className="space-y-2">
      <p className="font-bold">Who&apos;s eating?</p>
      <div className="flex flex-wrap items-center gap-3">
        {stepper("adults", "adults", 0)}
        {stepper("kids", "kids", 0)}
      </div>
      <div className="flex flex-wrap gap-2">
        {changed && <button type="button" className="btn-primary min-h-10 px-4 text-sm" disabled={pending || who.adults + who.kids < 1} onClick={() => save(who)}>{pending ? "Saving…" : "Size dinner for them"}</button>}
        {eating && <button type="button" className="btn-quiet min-h-10 px-3 text-sm" disabled={pending} onClick={() => save(null)}>Back to the usual ({household.adults} adults, {household.kids} kids)</button>}
      </div>
      <p className="text-xs text-muted">Company coming, or someone away? The groceries for this dinner follow.</p>
      {error && <p role="alert" className="text-sm font-bold text-terracotta-dark">{error}</p>}
    </div>
  );
}
