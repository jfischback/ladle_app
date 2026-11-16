"use client";

import { useState, useTransition } from "react";
import { createParty } from "@/app/actions/party";
import { PARTY_KINDS } from "@/lib/party";

/** Start a party: what kind, what to call it, when, and how many are coming. */
export function NewParty({ defaultDate, min }: { defaultDate: string; min: string }) {
  const [kind, setKind] = useState<string>("birthday");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate);
  const [guests, setGuests] = useState(20);
  const [meal, setMeal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const label = PARTY_KINDS.find((k) => k.key === kind)?.label ?? "Party";
  return (
    <form
      className="card space-y-4 p-5"
      aria-labelledby="new-party-title"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await createParty({ kind, title: title || label, date, guests, meal });
          if (r?.error) setError(r.error);
        });
      }}
    >
      <h2 id="new-party-title" className="text-xl font-semibold">Plan a new party</h2>
      <fieldset>
        <legend className="mb-2 font-bold">What kind of party?</legend>
        <div className="flex flex-wrap gap-2">
          {PARTY_KINDS.map((k) => (
            <label key={k.key} className={`cursor-pointer rounded-full border-2 px-3 py-1.5 font-semibold ${kind === k.key ? "border-olive bg-olive text-cream" : "border-line bg-card"}`}>
              <input type="radio" name="kind" value={k.key} checked={kind === k.key} onChange={() => setKind(k.key)} className="sr-only" />
              <span aria-hidden="true">{k.icon} </span>{k.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="font-bold">Call it</span>
          <input className="field mt-1 w-full" value={title} maxLength={60} placeholder={kind === "birthday" ? "Sam's 8th birthday" : label} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-bold">When</span>
          <input type="date" className="field mt-1 w-full" value={date} min={min} required onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block">
          <span className="font-bold">How many guests?</span>
          <input type="number" inputMode="numeric" className="field mt-1 w-full" value={guests} min={4} max={150} required onChange={(e) => setGuests(Number(e.target.value))} />
        </label>
        <fieldset>
          <legend className="font-bold">Is the food the meal?</legend>
          <div className="mt-1 flex flex-col gap-1">
            <label className="flex items-center gap-2"><input type="radio" name="meal" checked={!meal} onChange={() => setMeal(false)} /> Snacks and bites (people eat a meal too)</label>
            <label className="flex items-center gap-2"><input type="radio" name="meal" checked={meal} onChange={() => setMeal(true)} /> Yes, this is their lunch or dinner</label>
          </div>
        </fieldset>
      </div>
      <button className="btn-primary" disabled={pending}>{pending ? "Planning…" : "Plan the food →"}</button>
      {error && <p role="alert" className="text-sm font-bold text-terracotta-dark">{error}</p>}
    </form>
  );
}
