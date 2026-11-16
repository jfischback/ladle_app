"use client";

import { useState, useTransition } from "react";
import { importFromLink, importFromPhoto, type DraftResult } from "@/app/actions/recipes";
import { RecipeForm, type RecipeFormValues } from "@/components/RecipeForm";

type Mode = "type" | "link" | "photo";

export function NewRecipe({ importEnabled }: { importEnabled: boolean }) {
  const [mode, setMode] = useState<Mode>(importEnabled ? "link" : "type");
  const [draft, setDraft] = useState<Partial<RecipeFormValues> | null>(null);
  const [draftKey, setDraftKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function applyResult(res: DraftResult, creditFallback?: string) {
    if (res.error || !res.draft) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    const d = res.draft;
    setDraft({
      name: d.name,
      protein: d.protein || null,
      servings: d.servings,
      totalMinutes: d.totalMinutes,
      ingredients: d.ingredients.length ? d.ingredients : [{ amount: "", unit: "", item: "" }],
      steps: d.steps.length ? d.steps : [""],
      tags: d.tags,
      prepAhead: d.prepAhead || null,
      creditName: d.creditName ? `Inspired by ${d.creditName}` : creditFallback ?? null,
      creditUrl: d.creditUrl ?? null,
    });
    setDraftKey((k) => k + 1);
    setMode("type");
  }

  return (
    <div className="space-y-6">
      <div role="tablist" className="flex flex-wrap gap-2">
        {([
          ["link", "Save from link"],
          ["photo", "Snap a photo"],
          ["type", "Type it in"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setError(null); }} className={`rounded-full px-4 py-2 font-semibold ${mode === m ? "bg-olive text-cream" : "bg-oat text-olive-dark hover:bg-olive-soft"}`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "link" && (
        <form
          className="card space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const url = String(new FormData(e.currentTarget).get("url") ?? "");
            setError(null);
            start(async () => applyResult(await importFromLink(url)));
          }}
        >
          <label htmlFor="url" className="label">Paste one recipe link</label>
          <input id="url" name="url" type="url" required className="field" placeholder="https://…" />
          <p className="text-sm text-muted">We pull the ingredients and steps into your private list, in plain words, and keep the creator&apos;s name and link attached.</p>
          <button className="btn-primary" disabled={pending || !importEnabled}>{pending ? "Reading the page…" : "Get recipe"}</button>
        </form>
      )}

      {mode === "photo" && (
        <form
          className="card space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            setError(null);
            start(async () => applyResult(await importFromPhoto(form)));
          }}
        >
          <label htmlFor="photo" className="label">Photo of a recipe</label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/gif" capture="environment" required className="field file:mr-3 file:rounded-full file:border-0 file:bg-olive-soft file:px-3 file:py-1 file:font-semibold" />
          <p className="text-sm text-muted">A cookbook page, recipe card or screenshot. It saves to your list only, never the shared set.</p>
          <button className="btn-primary" disabled={pending || !importEnabled}>{pending ? "Reading the photo…" : "Read recipe"}</button>
        </form>
      )}

      {(mode === "link" || mode === "photo") && !importEnabled && (
        <p className="rounded-xl bg-ochre-soft px-3 py-2">Importing needs the Claude API key to be set up. You can still type a recipe in.</p>
      )}
      {error && <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-terracotta-dark">{error}</p>}

      {mode === "type" && (
        <>
          {draft && <p className="rounded-xl bg-olive-soft px-3 py-2">Here&apos;s what we found. Check it over, then save.</p>}
          <RecipeForm key={draftKey} initial={draft ?? undefined} />
        </>
      )}
    </div>
  );
}
