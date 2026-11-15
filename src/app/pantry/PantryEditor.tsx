"use client";

import { useState, useTransition } from "react";
import { addPantryItem, removePantryItem, updatePantryItem } from "@/app/actions/pantry";
import { PANTRY_IDEAS, PLACE_LABEL, guessPlace, sameThing, type Place } from "@/lib/pantry";

type Item = { id: string; name: string; place: Place; status: "have" | "low" | "out"; onSaleOnly: boolean };
const STATUS: { v: Item["status"]; label: string }[] = [{ v: "have", label: "Have" }, { v: "low", label: "Low" }, { v: "out", label: "Out" }];
const PLACES: Place[] = ["pantry", "fridge", "freezer"];
const PLACE_ICON: Record<Place, string> = { pantry: "🥫", fridge: "🧊", freezer: "❄️" };

export function PantryEditor({ items }: { items: Item[] }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [place, setPlace] = useState<Place>("pantry");
  const [onSale, setOnSale] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = (n: string) => items.some((i) => i.name.toLowerCase() === n.toLowerCase() || sameThing(n, i.name));
  const ideas = PANTRY_IDEAS.filter((i) => !has(i.name));
  const running = items.filter((i) => i.status !== "have");

  return (
    <div className="space-y-5">
      {running.length > 0 && (
        <p className="rounded-2xl bg-ochre-soft px-4 py-3 text-sm">
          <span className="font-bold">Running low or out:</span> {running.map((i) => i.name).join(", ")}. {running.some((i) => !i.onSaleOnly) ? "These go on your next grocery list when a recipe needs them." : ""}
          {running.some((i) => i.onSaleOnly) && " ⭐ items are added when they go on sale."}
        </p>
      )}

      {PLACES.map((pl) => {
        const list = items.filter((i) => i.place === pl);
        if (!list.length) return null;
        return (
          <section key={pl} className="card p-4 sm:p-5" aria-labelledby={`pl-${pl}`}>
            <h2 id={`pl-${pl}`} className="mb-2 flex items-center gap-2 text-xl font-semibold"><span aria-hidden="true">{PLACE_ICON[pl]}</span> {PLACE_LABEL[pl]}</h2>
            <ul className="divide-y divide-line/70">
              {list.map((i) => (
                <li key={i.id} className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] ${pending ? "opacity-80" : ""}`}>
                  <button
                    type="button"
                    aria-pressed={i.onSaleOnly}
                    aria-label={`Buy ${i.name} only on sale`}
                    title={i.onSaleOnly ? "Only bought on sale" : "Tap to buy only on sale"}
                    onClick={() => start(() => updatePantryItem(i.id, { onSaleOnly: !i.onSaleOnly }))}
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-lg ${i.onSaleOnly ? "bg-ochre-soft" : "opacity-30 hover:opacity-70"}`}
                  >
                    ⭐
                  </button>
                  <span className="font-semibold leading-snug">{i.name}</span>
                  <button aria-label={`Remove ${i.name}`} title="Remove" className="flex h-8 w-8 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-terracotta-dark sm:order-last" onClick={() => start(() => removePantryItem(i.id))}>×</button>
                  <div className="col-span-2 col-start-2 flex w-fit rounded-full bg-oat p-0.5 sm:col-span-1 sm:col-start-auto" role="group" aria-label={`How much ${i.name} do you have?`}>
                    {STATUS.map((st) => (
                      <button key={st.v} type="button" aria-pressed={i.status === st.v} onClick={() => start(() => updatePantryItem(i.id, { status: st.v }))}
                        className={`rounded-full px-3 py-1 text-xs font-bold ${i.status === st.v ? (st.v === "have" ? "bg-olive text-cream" : st.v === "low" ? "bg-ochre text-ink" : "bg-terracotta text-cream") : "text-muted"}`}>
                        {st.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {items.length === 0 && (
        <p className="card p-5 text-muted">Nothing here yet. Add what you keep on hand, or tap a few ideas below. When you approve a week, the grocery list also asks about long-lasting items and remembers your answers.</p>
      )}

      <form
        className="card space-y-2 p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            setError(null);
            const r = await addPantryItem({ name, place, onSaleOnly: onSale });
            if (r?.error) setError(r.error);
            else { setName(""); setOnSale(false); }
          });
        }}
      >
        <p className="label">Add to your pantry</p>
        <div className="flex flex-wrap gap-2">
          <input className="field min-w-0 basis-full sm:basis-0 sm:flex-[2]" placeholder="e.g. Rao's Marinara" aria-label="Item" value={name} onChange={(e) => { setName(e.target.value); setPlace(guessPlace(e.target.value)); }} />
          <select className="field w-auto flex-1" aria-label="Where it's kept" value={place} onChange={(e) => setPlace(e.target.value as Place)}>
            {PLACES.map((p) => <option key={p} value={p}>{PLACE_LABEL[p]}</option>)}
          </select>
          <button className="btn-primary shrink-0" disabled={name.trim().length < 2 || pending}>+ Add</button>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-5 w-5 accent-[var(--color-ochre)]" checked={onSale} onChange={(e) => setOnSale(e.target.checked)} />
          ⭐ Only buy it on sale (premium stock-up item)
        </label>
        {error && <p className="text-sm text-terracotta-dark">{error}</p>}
      </form>

      {ideas.length > 0 && (
        <section className="rounded-3xl bg-oat p-4 sm:p-5" aria-labelledby="pantry-ideas">
          <h2 id="pantry-ideas" className="mb-2 font-bold">Quick ideas</h2>
          <ul className="flex flex-wrap gap-2">
            {ideas.map((i) => (
              <li key={i.name}>
                <button className="btn-secondary min-h-10 px-3 text-sm" disabled={pending} onClick={() => start(async () => { await addPantryItem(i); })}>
                  + {i.onSaleOnly ? "⭐ " : ""}{i.name}
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">⭐ means it&apos;s only bought on sale, when you&apos;re running low.</p>
        </section>
      )}
    </div>
  );
}
