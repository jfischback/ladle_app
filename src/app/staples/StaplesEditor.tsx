"use client";

import { useState, useTransition } from "react";
import { saveStaples } from "@/app/actions/staples";
import { STAPLE_IDEAS, stapleTerm } from "@/lib/staples";
import type { Staple } from "@/lib/types";

type PriceInfo = Record<string, { price: number | null; sale: { pctOff: number; salePrice: number; regularPrice: number } | null }>;

export function StaplesEditor({ initial, priceInfo }: { initial: Staple[]; priceInfo: PriceInfo }) {
  const [list, setList] = useState<Staple[]>(initial);
  const [item, setItem] = useState("");
  const [qty, setQty] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (next: Staple[]) => {
    setList(next);
    start(async () => {
      setStatus(null);
      const r = await saveStaples(next);
      setStatus(r?.error ?? "Saved");
    });
  };
  const has = (name: string) => list.some((s) => stapleTerm(s.item) === stapleTerm(name));
  const add = (s: Staple) => { if (s.item.trim().length >= 2 && !has(s.item)) save([...list, { ...s, item: s.item.trim() }]); };
  const update = (i: number, patch: Partial<Staple>) => save(list.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const ideas = STAPLE_IDEAS.filter((s) => !has(s.item));
  const activeCount = list.filter((s) => s.active).length;

  return (
    <div className="space-y-5">
      <section className="card p-4 sm:p-5" aria-labelledby="list-title">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <h2 id="list-title" className="flex items-center gap-2 text-xl font-semibold"><span aria-hidden="true">🧺</span> Your staples</h2>
          <span className="text-sm text-muted" aria-live="polite">{pending ? "Saving…" : status === "Saved" ? "✓ Saved" : status}</span>
        </div>
        {list.length === 0 ? (
          <p className="px-1 py-4 text-muted">Nothing yet. Add your own below, or tap a few ideas to start.</p>
        ) : (
          <ul className="divide-y divide-line/70">
            {list.map((s, i) => {
              const info = priceInfo[stapleTerm(s.item)];
              return (
                <li key={s.item} className={`flex items-center gap-3 px-1 py-2.5 ${s.active ? "" : "opacity-55"}`}>
                  <label className="flex cursor-pointer items-center">
                    <input type="checkbox" className="peer sr-only" checked={s.active} onChange={() => update(i, { active: !s.active })} aria-label={`Buy ${s.item} this week`} />
                    <span aria-hidden="true" className={`flex h-7 w-7 items-center justify-center rounded-full border-2 font-bold peer-focus-visible:ring-2 peer-focus-visible:ring-olive ${s.active ? "border-olive bg-olive text-cream" : "border-line bg-card"}`}>{s.active ? "✓" : ""}</span>
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold leading-snug">{s.item}</p>
                    <input
                      aria-label={`How much ${s.item}`}
                      className="w-full rounded-lg bg-transparent px-0 text-sm text-muted outline-none focus:bg-cream focus:px-2"
                      defaultValue={s.quantity}
                      placeholder="How much? e.g. 1 gallon"
                      onBlur={(e) => e.target.value !== s.quantity && update(i, { quantity: e.target.value })}
                    />
                    {!s.active && <p className="text-xs text-muted">Skipping this week</p>}
                  </div>
                  {info?.sale ? (
                    <span className="shrink-0 text-right text-sm">
                      <span className="tag-sale">{info.sale.pctOff}% off</span>
                      <span className="block font-bold text-terracotta-dark">${info.sale.salePrice.toFixed(2)}</span>
                    </span>
                  ) : info?.price != null ? (
                    <span className="shrink-0 text-sm font-semibold text-muted">${info.price.toFixed(2)}</span>
                  ) : null}
                  <button aria-label={`Remove ${s.item}`} title="Remove" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-cream hover:text-terracotta-dark" onClick={() => save(list.filter((_, k) => k !== i))}>×</button>
                </li>
              );
            })}
          </ul>
        )}
        {list.length > 0 && (
          <p className="mt-2 px-1 text-sm text-muted">
            {activeCount} on this week&apos;s list. Untick anything you don&apos;t need this week; it stays saved for next time.
          </p>
        )}
      </section>

      <form className="card space-y-2 p-4 sm:p-5" onSubmit={(e) => { e.preventDefault(); add({ item, quantity: qty.trim(), active: true }); setItem(""); setQty(""); }}>
        <p className="label">Add a staple</p>
        <div className="flex flex-wrap gap-2">
          <input className="field min-w-0 basis-full sm:basis-0 sm:flex-[2]" placeholder="Item, e.g. Milk" value={item} onChange={(e) => setItem(e.target.value)} aria-label="Item" />
          <input className="field min-w-0 flex-1" placeholder="How much, e.g. 1 gallon" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="How much" />
          <button className="btn-primary shrink-0" disabled={item.trim().length < 2 || has(item)}>+ Add</button>
        </div>
        {item.trim() && has(item) && <p className="text-sm text-terracotta-dark">That&apos;s already on your list.</p>}
      </form>

      {ideas.length > 0 && (
        <section className="rounded-3xl bg-oat p-4 sm:p-5" aria-labelledby="ideas-title">
          <h2 id="ideas-title" className="mb-2 font-bold">Quick ideas</h2>
          <ul className="flex flex-wrap gap-2">
            {ideas.map((s) => (
              <li key={s.item}>
                <button className="btn-secondary min-h-10 px-3 text-sm" onClick={() => add(s)}>+ {s.item}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-sm text-muted">Prices show after you plan a week with your store picked in Settings.</p>
    </div>
  );
}
