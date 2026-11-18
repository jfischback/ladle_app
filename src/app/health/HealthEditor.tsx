"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { saveHealthPeople } from "../actions/health";
import { CONDITIONS } from "@/lib/athletes";
import { HEALTH_CONDITIONS, newHealthPerson, type HealthCondition, type HealthPerson } from "@/lib/health";

export function HealthEditor({ initial }: { initial: HealthPerson[] }) {
  // Opening the page with nobody on it starts one card, so there's something to fill in.
  const [list, setList] = useState<HealthPerson[]>(initial.length ? initial : [newHealthPerson()]);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const kept = (l: HealthPerson[]) => l.filter((p) => p.conditions.length > 0);
  const dirty = JSON.stringify(kept(list)) !== saved;

  const update = (id: string, patch: Partial<HealthPerson>) => setList((l) => l.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const save = () =>
    start(async () => {
      const r = await saveHealthPeople(list);
      if (!r.error) setSaved(JSON.stringify(kept(list)));
      const n = kept(list).length;
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: n ? "Saved! Re-plan the week to use these." : "No health needs are set." });
    });

  return (
    <div className="space-y-4">
      {list.map((p) => <PersonCard key={p.id} p={p} onChange={(x) => update(p.id, x)} onRemove={() => setList((l) => l.filter((x) => x.id !== p.id))} />)}

      <button type="button" className="btn-secondary w-full" onClick={() => setList((l) => [...l, newHealthPerson()])}>
        <span aria-hidden="true">🩺</span> {list.length ? "Add another person" : "Add a person"}
      </button>

      {(dirty || msg) && (
        <div className="sticky bottom-24 z-20 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-card p-4 shadow-lift sm:bottom-4">
          <p className={`font-semibold ${msg && !msg.ok ? "text-terracotta-dark" : "text-olive-dark"}`}>{msg && !dirty ? msg.text : msg && !msg.ok ? msg.text : "You have changes."}</p>
          {dirty && <button className="btn-primary" disabled={pending} onClick={save}>{pending ? "Saving…" : "✓ Save"}</button>}
        </div>
      )}
    </div>
  );
}

function PersonCard({ p, onChange, onRemove }: { p: HealthPerson; onChange: (x: Partial<HealthPerson>) => void; onRemove: () => void }) {
  const has = (c: HealthCondition) => p.conditions.includes(c);
  const toggle = (c: HealthCondition) => onChange({ conditions: has(c) ? p.conditions.filter((x) => x !== c) : [...p.conditions, c] });
  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="label">Name</span>
          <input className="field" value={p.name} maxLength={40} placeholder="e.g. Dad" onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <button type="button" className="btn-quiet min-h-11 px-3 text-sm" onClick={onRemove}>Remove</button>
      </div>

      <fieldset className="space-y-3">
        <legend className="label">What should dinners work around?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {HEALTH_CONDITIONS.map((c) => (
            <button key={c} type="button" aria-pressed={has(c)} onClick={() => toggle(c)}
              className={`flex flex-col items-start rounded-2xl border-2 p-3 text-left ${has(c) ? "border-olive bg-olive-soft" : "border-line bg-card hover:border-olive/50"}`}>
              <span className="font-bold"><span aria-hidden="true">{CONDITIONS[c].icon}</span> {CONDITIONS[c].label}</span>
              <span className="text-sm text-muted">{CONDITIONS[c].blurb}</span>
            </button>
          ))}
        </div>
        {has("diabetes") && (
          <label className="block">
            <span className="label">Carbs per meal (grams)</span>
            <input className="field" inputMode="numeric" value={p.carbsPerMeal} onChange={(e) => onChange({ carbsPerMeal: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
            <span className="mt-1 block text-sm text-muted">Use the number from your doctor or diabetes educator; 45 to 60 g is common. We&apos;ll steer away from dinners that go well over it and say which side to cut or swap.</span>
          </label>
        )}
        {has("lowsodium") && (
          <div>
            <span className="label">Sodium a day</span>
            <div className="flex flex-wrap gap-1.5">
              {[1500, 2000, 2300].map((v) => (
                <button key={v} type="button" aria-pressed={p.sodiumPerDay === v} onClick={() => onChange({ sodiumPerDay: v })}
                  className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${p.sodiumPerDay === v ? "border-olive bg-olive text-cream" : "border-line bg-card"}`}>{v.toLocaleString("en-US")} mg</button>
              ))}
            </div>
          </div>
        )}
        {has("keto") && <p className="text-sm text-muted">We&apos;ll favor low-carb dinners for everyone and tell {p.name || "them"} which sides to skip. <Link href="/recipes?tab=browse" className="font-bold underline">Add the low-carb recipe pack</Link> for more choices.</p>}
      </fieldset>
    </section>
  );
}
