"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addExtra, removeExtra, saveExtrasRule, updateExtra } from "@/app/actions/extras";
import { CATEGORIES, EXTRA_IDEAS, MODE_LABEL } from "@/lib/extras";
import type { ExtraCategory, ExtrasRule } from "@/lib/types";

type Mode = "always" | "on-sale" | "rotate" | "when-low";
type Item = { id: string; category: ExtraCategory; name: string; mode: Mode; qty: number; saleQty: number | null; anyBrand: boolean; servings: number | null; status: "have" | "low" | "out" };
const MODES: Mode[] = ["always", "on-sale", "rotate", "when-low"];
const MODE_HINT: Record<Mode, string> = {
  always: "Bought every trip",
  "on-sale": "Only when it's on sale",
  rotate: "Takes turns with the others",
  "when-low": "Only when you mark it low",
};

function Stepper({ value, min, max, label, onChange }: { value: number; min: number; max: number; label: string; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center gap-1" role="group" aria-label={label}>
      <button type="button" aria-label={`Less: ${label}`} className="h-7 w-7 rounded-full bg-oat font-bold disabled:opacity-40" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span className="w-6 text-center font-bold tabular-nums">{value}</span>
      <button type="button" aria-label={`More: ${label}`} className="h-7 w-7 rounded-full bg-oat font-bold disabled:opacity-40" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </span>
  );
}

export function ExtrasEditor({ category, items, rules, thisWeek }: { category: ExtraCategory; items: Item[]; rules: Record<ExtraCategory, ExtrasRule>; thisWeek: { category: ExtraCategory; item: string; quantity: number; reason: string; sale: string | null }[] }) {
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<Mode>("on-sale");
  const [anyBrand, setAnyBrand] = useState(false);
  const rule = rules[category];
  const [never, setNever] = useState(rule.neverWords.join(", "));
  const mine = items.filter((i) => i.category === category);
  const week = thisWeek.filter((l) => l.category === category);
  const ideas = EXTRA_IDEAS[category].filter((i) => !mine.some((m) => m.name.toLowerCase() === i.name.toLowerCase()));
  const save = (r: Partial<ExtrasRule>) => start(() => saveExtrasRule(category, { ...rule, ...r }));
  const cat = CATEGORIES.find((c) => c.key === category)!;

  return (
    <div className="space-y-5">
      <nav aria-label="Categories" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-oat p-1">
        {CATEGORIES.map((c) => (
          <Link key={c.key} href={`/extras?c=${c.key}`} aria-current={c.key === category ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-2 font-bold ${c.key === category ? "bg-card text-terracotta-dark shadow-soft" : "text-olive-dark"}`}>
            {c.icon} {c.label} <span className="text-muted">({items.filter((i) => i.category === c.key).length})</span>
          </Link>
        ))}
      </nav>

      {week.length > 0 && (
        <p className="rounded-2xl bg-ochre-soft px-4 py-3 text-sm">
          <span className="font-bold">On this week&apos;s list:</span> {week.map((l) => `${l.item}${l.quantity > 1 ? ` ×${l.quantity}` : ""}${l.sale ? ` (${l.sale})` : ""}`).join(", ")}
        </p>
      )}

      <section className="card p-4 sm:p-5" aria-labelledby="items-h">
        <h2 id="items-h" className="mb-2 flex items-center gap-2 text-xl font-semibold"><span aria-hidden="true">{cat.icon}</span> Your {cat.label.toLowerCase()}</h2>
        {mine.length === 0 ? (
          <p className="py-3 text-muted">Nothing yet. Add your family&apos;s favorites below, or tap a few ideas.</p>
        ) : (
          <ul className={`divide-y divide-line/70 ${pending ? "opacity-80" : ""}`}>
            {mine.map((i) => (
              <li key={i.id} className="space-y-2 py-3">
                <div className="flex items-start gap-2">
                  <span className="min-w-0 flex-1 font-semibold leading-snug">{i.name}</span>
                  <button aria-label={`Remove ${i.name}`} title="Remove" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-terracotta-dark" onClick={() => start(() => removeExtra(i.id))}>×</button>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
                  <select aria-label={`How to buy ${i.name}`} className="field w-auto py-1 text-sm" value={i.mode} onChange={(e) => start(() => updateExtra(i.id, { mode: e.target.value }))}>
                    {MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
                  </select>
                  <span className="inline-flex items-center gap-1.5">Buy <Stepper value={i.qty} min={1} max={24} label={`how many ${i.name}`} onChange={(v) => start(() => updateExtra(i.id, { qty: v }))} /></span>
                  <span className="inline-flex items-center gap-1.5">On sale <Stepper value={i.saleQty ?? i.qty} min={1} max={24} label={`how many ${i.name} when on sale`} onChange={(v) => start(() => updateExtra(i.id, { saleQty: v }))} /></span>
                  <label className="inline-flex items-center gap-1.5 font-semibold">
                    <input type="checkbox" className="h-4 w-4" checked={i.anyBrand} onChange={(e) => start(() => updateExtra(i.id, { anyBrand: e.target.checked }))} /> Any brand
                  </label>
                  {category === "baby" && (
                    <span className="inline-flex items-center gap-1.5">Servings per pack <Stepper value={i.servings ?? 1} min={1} max={48} label={`servings per pack of ${i.name}`} onChange={(v) => start(() => updateExtra(i.id, { servings: v }))} /></span>
                  )}
                  {i.mode === "when-low" && (
                    <span className="inline-flex rounded-full bg-oat p-0.5" role="group" aria-label={`How much ${i.name} do you have?`}>
                      {(["have", "low", "out"] as const).map((st) => (
                        <button key={st} type="button" aria-pressed={i.status === st} onClick={() => start(() => updateExtra(i.id, { status: st }))}
                          className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${i.status === st ? (st === "have" ? "bg-olive text-cream" : st === "low" ? "bg-ochre text-ink" : "bg-terracotta text-cream") : "text-muted"}`}>
                          {st}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted">{MODE_HINT[i.mode]}{i.saleQty && i.saleQty !== i.qty ? ` · ${i.qty}, or ${i.saleQty} when on sale` : ""}{i.anyBrand ? " · any brand on sale counts" : ""}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="card space-y-2 p-4 sm:p-5" onSubmit={(e) => { e.preventDefault(); start(async () => { await addExtra({ category, name, mode, anyBrand, servings: category === "baby" ? 1 : null }); setName(""); setAnyBrand(false); }); }}>
        <p className="label">Add to {cat.label.toLowerCase()}</p>
        <div className="flex flex-wrap gap-2">
          <input className="field min-w-0 basis-full sm:basis-0 sm:flex-[2]" aria-label="Item" placeholder={category === "sweets" ? "e.g. Reese's Peanut Butter Cups" : category === "drinks" ? "e.g. Snapple Peach Tea" : category === "baby" ? "e.g. Fruit puree pouches" : category === "pets" ? "e.g. Purina Pro Plan dog food" : "e.g. Goldfish crackers"} value={name} onChange={(e) => setName(e.target.value)} />
          <select className="field w-auto flex-1" aria-label="How to buy it" value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
            {MODES.map((m) => <option key={m} value={m}>{MODE_LABEL[m]}</option>)}
          </select>
          <button className="btn-primary shrink-0" disabled={name.trim().length < 2 || pending}>+ Add</button>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4" checked={anyBrand} onChange={(e) => setAnyBrand(e.target.checked)} /> Any brand counts (if any brand is on sale, buy it)</label>
      </form>

      <section className="card space-y-3 p-4 sm:p-5" aria-labelledby="rules-h">
        <h2 id="rules-h" className="text-xl font-semibold">{cat.label} rules</h2>
        {category === "baby" ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">Aim for this many servings a week</span>
            <Stepper value={rule.servingsTarget ?? 0} min={0} max={50} label="servings a week" onChange={(v) => save({ servingsTarget: v || null })} />
            <p className="w-full text-xs text-muted">Counted by servings, not packages: a 6-pack of applesauce is 6. &quot;Rotate&quot; and &quot;on sale&quot; items fill it up. 0 turns it off.</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">&quot;Rotate&quot; items to pick each week</span>
            <Stepper value={rule.rotateCount} min={0} max={10} label="rotate picks a week" onChange={(v) => save({ rotateCount: v })} />
          </div>
        )}
        <div>
          <label htmlFor="never" className="label">Never buy (for &quot;any brand&quot; items)</label>
          <input id="never" className="field" placeholder={category === "sweets" ? "e.g. dark chocolate, cola, licorice, bakery" : category === "baby" ? "e.g. honey, toddler" : "e.g. spicy"} value={never}
            onChange={(e) => setNever(e.target.value)} onBlur={() => save({ neverWords: never.split(",").map((w) => w.trim()).filter((w) => w.length >= 2) })} />
          <p className="mt-1 text-xs text-muted">Products with these words are skipped when any brand counts. Items you name exactly (like Red Vines) are still bought.</p>
        </div>
      </section>

      {ideas.length > 0 && (
        <section className="rounded-3xl bg-oat p-4 sm:p-5" aria-labelledby="ideas-h">
          <h2 id="ideas-h" className="mb-2 font-bold">Quick ideas</h2>
          <ul className="flex flex-wrap gap-2">
            {ideas.map((i) => (
              <li key={i.name}>
                <button className="btn-secondary min-h-10 px-3 text-sm" disabled={pending}
                  onClick={() => start(async () => { await addExtra({ category, name: i.name, mode: i.mode, anyBrand: i.anyBrand ?? false, servings: i.servings ?? null, qty: i.qty ?? 1, saleQty: i.saleQty ?? null }); })}>
                  + {i.name} <span className="text-muted">· {MODE_LABEL[i.mode]}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
