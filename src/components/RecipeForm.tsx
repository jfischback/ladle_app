"use client";

import { useState, useTransition } from "react";
import { saveRecipe, type RecipeInputType } from "@/app/actions/recipes";
import type { Ingredient } from "@/lib/types";

export type RecipeFormValues = {
  meal?: string;
  name: string;
  protein: string | null;
  servings: number | null;
  totalMinutes: number | null;
  ingredients: Ingredient[];
  steps: string[];
  tags: string[];
  ease: number | null;
  prepAhead: string | null;
  creditName: string | null;
  creditUrl: string | null;
};

const TAGS = ["quick", "one-pot", "kid-friendly", "slow-cooker", "sheet-pan", "grill", "make-ahead"];
const PROTEINS = ["Chicken", "Beef", "Pork", "Sausage", "Turkey", "Fish", "Shrimp", "Vegetarian", "Beans (no meat)"];

const blank: RecipeFormValues = {
  meal: "dinner", name: "", protein: null, servings: null, totalMinutes: null,
  ingredients: [{ amount: "", unit: "", item: "" }], steps: [""], tags: [], ease: null, prepAhead: null, creditName: null, creditUrl: null,
};

export function RecipeForm({ id, initial }: { id?: string; initial?: Partial<RecipeFormValues> }) {
  const [v, setV] = useState<RecipeFormValues>({ ...blank, ...initial });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof RecipeFormValues>(k: K, val: RecipeFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const num = (s: string) => (s.trim() === "" ? null : Math.max(0, Math.round(Number(s))) || null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const input: RecipeInputType = {
      ...v,
      meal: v.meal === "lunch" ? "lunch" : "dinner",
      creditName: v.creditName?.trim() || null,
      creditUrl: v.creditUrl?.trim() || null,
      prepAhead: v.prepAhead?.trim() || null,
      protein: v.protein?.trim() || null,
    };
    start(async () => {
      const res = await saveRecipe(input, id);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="card space-y-4 p-5">
        <div>
          <label htmlFor="name" className="label">Recipe name</label>
          <input id="name" required className="field text-lg" value={v.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <fieldset>
          <legend className="label">Is it a dinner or a lunch?</legend>
          <div className="flex gap-2">
            {(["dinner", "lunch"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={(v.meal ?? "dinner") === m} onClick={() => set("meal", m)}
                className={`btn min-h-10 border-2 px-4 text-sm ${(v.meal ?? "dinner") === m ? "border-olive bg-olive text-cream" : "border-line bg-card text-ink"}`}>
                {m === "dinner" ? "🍽 Dinner" : "🥪 Lunch"}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="protein" className="label">Main protein</label>
            <input id="protein" list="proteins" className="field" value={v.protein ?? ""} onChange={(e) => set("protein", e.target.value)} />
            <datalist id="proteins">{PROTEINS.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
          <div>
            <label htmlFor="mins" className="label">Total minutes</label>
            <input id="mins" type="number" inputMode="numeric" min={1} className="field" value={v.totalMinutes ?? ""} onChange={(e) => set("totalMinutes", num(e.target.value))} />
          </div>
          <div>
            <label htmlFor="servings" className="label">Servings</label>
            <input id="servings" type="number" inputMode="numeric" min={1} className="field" value={v.servings ?? ""} onChange={(e) => set("servings", num(e.target.value))} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ease" className="label">Ease of cooking</label>
            <select id="ease" className="field" value={v.ease ?? ""} onChange={(e) => set("ease", e.target.value ? Number(e.target.value) : null)}>
              <option value="">Not set</option>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} {n === 1 ? "(hard)" : n === 5 ? "(easy)" : ""}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="prep" className="label">Day-before prep</label>
            <input id="prep" className="field" placeholder="e.g. Marinate the chicken overnight" value={v.prepAhead ?? ""} onChange={(e) => set("prepAhead", e.target.value)} />
          </div>
        </div>
        <fieldset>
          <legend className="label">Tags</legend>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((t) => {
              const on = v.tags.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} onClick={() => set("tags", on ? v.tags.filter((x) => x !== t) : [...v.tags, t])} className={`rounded-full border-2 px-3 py-1.5 text-sm font-semibold ${on ? "border-olive bg-olive text-cream" : "border-line bg-card"}`}>
                  {t}
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-xl font-bold">Ingredients</h2>
        <div className="hidden grid-cols-[5rem_6rem_1fr_2.75rem] gap-2 text-sm font-semibold text-muted sm:grid">
          <span>Amount</span><span>Unit</span><span>Item</span><span />
        </div>
        {v.ingredients.map((ing, i) => (
          <div key={i} className="grid grid-cols-[4.5rem_5.5rem_1fr_2.75rem] gap-2 sm:grid-cols-[5rem_6rem_1fr_2.75rem]">
            {(["amount", "unit", "item"] as const).map((k) => (
              <input key={k} aria-label={`Ingredient ${i + 1} ${k}`} className="field px-2" placeholder={k === "amount" ? "1 1/2" : k === "unit" ? "cups" : "chicken thighs"} value={ing[k]}
                onChange={(e) => set("ingredients", v.ingredients.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
            ))}
            <button type="button" aria-label={`Remove ingredient ${i + 1}`} className="btn-quiet h-11 w-11 p-0 text-xl" onClick={() => set("ingredients", v.ingredients.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="btn-secondary min-h-10 text-sm" onClick={() => set("ingredients", [...v.ingredients, { amount: "", unit: "", item: "" }])}>+ Add ingredient</button>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-xl font-bold">Steps</h2>
        <p className="text-sm text-muted">Plain words, in your own voice.</p>
        {v.steps.map((s, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive font-bold text-cream">{i + 1}</span>
            <textarea aria-label={`Step ${i + 1}`} rows={2} className="field" value={s} onChange={(e) => set("steps", v.steps.map((x, j) => (j === i ? e.target.value : x)))} />
            <button type="button" aria-label={`Remove step ${i + 1}`} className="btn-quiet h-11 w-11 shrink-0 p-0 text-xl" onClick={() => set("steps", v.steps.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <button type="button" className="btn-secondary min-h-10 text-sm" onClick={() => set("steps", [...v.steps, ""])}>+ Add step</button>
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label htmlFor="credit" className="label">Credit (optional)</label>
          <input id="credit" className="field" placeholder="Inspired by …" value={v.creditName ?? ""} onChange={(e) => set("creditName", e.target.value)} />
        </div>
        <div>
          <label htmlFor="creditUrl" className="label">Source link (optional)</label>
          <input id="creditUrl" type="url" className="field" value={v.creditUrl ?? ""} onChange={(e) => set("creditUrl", e.target.value)} />
        </div>
      </div>

      {error && <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-terracotta-dark">{error}</p>}
      <button className="btn-primary w-full text-lg sm:w-auto" disabled={pending}>{pending ? "Saving…" : "Save recipe"}</button>
    </form>
  );
}
