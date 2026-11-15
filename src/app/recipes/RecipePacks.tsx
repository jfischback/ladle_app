"use client";

import { useState, useTransition } from "react";
import { addRecipePack } from "@/app/actions/recipes";
import { PACKS } from "@/lib/packs";

/** One-tap recipe packs. */
export function RecipePacks({ counts }: { counts: Record<string, number> }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Record<string, number>>({});
  return (
    <section className="mb-5" aria-label="Recipe packs">
      <h2 className="mb-2 text-xl font-semibold">Recipe packs</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {PACKS.filter((p) => counts[p.tag]).map((p) => (
          <div key={p.tag} className="card flex items-center gap-3 p-3">
            <span className="text-3xl" aria-hidden="true">{p.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{p.title} <span className="font-normal text-muted">· {counts[p.tag]}</span></span>
              <span className="block text-sm text-muted">{p.blurb}</span>
            </span>
            <button className="btn-secondary min-h-9 shrink-0 px-3 text-sm" disabled={pending}
              onClick={() => start(async () => { const r = await addRecipePack(p.tag); setDone((d) => ({ ...d, [p.tag]: r.added })); })}>
              {done[p.tag] == null ? "Add" : done[p.tag] ? `✓ ${done[p.tag]} added` : "✓ Have them"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
