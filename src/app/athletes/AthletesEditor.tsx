"use client";

import { useState, useTransition } from "react";
import { saveAthletes } from "../actions/athletes";
import { PHASES, SPORTS, newAthlete, portionFor, suggestTargets, type Athlete, type Phase, type Sport } from "@/lib/athletes";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const EVENT_HINT: Record<string, string> = {
  lift: "We carb up the night before and plan easy meet-day food.",
  race: "We carb-load the 3 days before and plan a race-day breakfast.",
  weighin: "We go lighter the 3 days before, then plan a refuel after weigh-in.",
  show: "Peak week stays plain and lean. Follow your coach's plan.",
  game: "Carbs the night before, and a game-day eating plan.",
};
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function AthletesEditor({ initial }: { initial: Athlete[] }) {
  const [list, setList] = useState<Athlete[]>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Compare against what was last saved (the server may hand fields back in another order).
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const dirty = JSON.stringify(list) !== saved;

  const update = (id: string, patch: Partial<Athlete>) => setList((l) => l.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const save = () =>
    start(async () => {
      const r = await saveAthletes(list);
      if (!r.error) setSaved(JSON.stringify(list));
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: list.length ? "Saved! Re-plan the week to use these goals." : "Athlete mode is off." });
    });

  return (
    <div className="space-y-4">
      {list.map((a) => <AthleteCard key={a.id} a={a} onChange={(p) => update(a.id, p)} onRemove={() => setList((l) => l.filter((x) => x.id !== a.id))} />)}

      <button type="button" className="btn-secondary w-full" onClick={() => setList((l) => [...l, newAthlete()])}>
        <span aria-hidden="true">💪</span> {list.length ? "Add another athlete" : "Add an athlete"}
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

function AthleteCard({ a, onChange, onRemove }: { a: Athlete; onChange: (p: Partial<Athlete>) => void; onRemove: () => void }) {
  // Any change to type, phase, age, miles or weight re-suggests the numbers (when we know the weight).
  const change = (p: Partial<Athlete>) => {
    const next = { ...a, ...p };
    const w = next.weightLb;
    onChange({ ...p, ...(w && w >= 60 && w <= 600 ? suggestTargets(next, w) : {}) });
  };
  const portion = portionFor(a);
  const sport = SPORTS[a.sport];
  return (
    <section className="card space-y-4 p-5">
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="label">Name</span>
          <input className="field" value={a.name} maxLength={40} placeholder="e.g. Jake" onChange={(e) => onChange({ name: e.target.value })} />
        </label>
        <button type="button" className="btn-quiet min-h-11 px-3 text-sm" onClick={onRemove}>Remove</button>
      </div>

      <fieldset>
        <legend className="label">What kind of athlete?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(SPORTS) as Sport[]).map((k) => {
            const on = a.sport === k;
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => change({ sport: k, mealsPerDay: SPORTS[k].meals })}
                className={`flex flex-col items-start gap-0.5 rounded-2xl border-2 p-3 text-left transition-colors ${on ? "border-olive bg-olive-soft" : "border-line bg-card hover:border-olive/50"}`}>
                <span className="text-2xl" aria-hidden="true">{SPORTS[k].icon}</span>
                <span className="font-bold leading-tight">{SPORTS[k].label}</span>
                <span className="text-xs text-muted">{SPORTS[k].blurb}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="label">Right now they&apos;re…</legend>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-oat p-1">
          {(Object.keys(PHASES) as Phase[]).map((k) => {
            const on = a.phase === k;
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => change({ phase: k })}
                className={`rounded-xl px-2 py-2 text-center transition-colors ${on ? "bg-card shadow-soft" : "hover:bg-card/60"}`}>
                <span className="block font-bold">{PHASES[k].label}</span>
                <span className="block text-xs text-muted">{PHASES[k].blurb}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-olive" checked={a.youth} onChange={(e) => change({ youth: e.target.checked, ...(e.target.checked ? { shakes: false } : {}) })} />
        <span><b>Under 18</b> <span className="text-muted">Growing kids need plenty of food. We use real-food snacks instead of protein powder and bars (you can still allow shakes below).</span></span>
      </label>

      <div className={`grid gap-3 ${a.sport === "endurance" ? "sm:grid-cols-2" : ""}`}>
        <label>
          <span className="label">Body weight (lb)</span>
          <input className="field" inputMode="numeric" value={a.weightLb ?? ""} placeholder="e.g. 250"
            onChange={(e) => change({ weightLb: Number(e.target.value.replace(/\D/g, "")) || null })} />
        </label>
        {a.sport === "endurance" && (
          <label>
            <span className="label">Miles a week</span>
            <input className="field" inputMode="numeric" value={a.milesPerWeek ?? ""} placeholder="e.g. 25"
              onChange={(e) => change({ milesPerWeek: Number(e.target.value.replace(/\D/g, "")) || null })} />
          </label>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label>
          <span className="label">Calories a day</span>
          <input className="field" inputMode="numeric" value={a.calories} onChange={(e) => onChange({ calories: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
        </label>
        <label>
          <span className="label">Protein (g) a day</span>
          <input className="field" inputMode="numeric" value={a.protein} onChange={(e) => onChange({ protein: Number(e.target.value.replace(/\D/g, "")) || 0 })} />
        </label>
      </div>
      <p className="-mt-2 text-sm text-muted">
        {a.weightLb ? `Suggested for a ${sport.label.toLowerCase()} at ${a.weightLb} lb. Change them to your coach's numbers anytime.` : "Enter body weight and we'll suggest numbers."}
        {" "}Training days get the full amount; rest days about 10% fewer calories.
      </p>

      <fieldset>
        <legend className="label">Training days</legend>
        <div className="grid grid-cols-7 gap-1">
          {DAYS.map((d, i) => {
            const on = a.trainingDays.includes(i);
            return (
              <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]}
                onClick={() => onChange({ trainingDays: on ? a.trainingDays.filter((x) => x !== i) : [...a.trainingDays, i].sort() })}
                className={`flex h-14 flex-col items-center justify-center rounded-2xl border-2 text-[0.8rem] font-extrabold transition-all active:scale-95 sm:text-sm ${on ? "border-terracotta bg-terracotta text-cream" : "border-line bg-card text-muted hover:border-terracotta/60"}`}>
                {d}<span aria-hidden="true" className="text-xs">{on ? "🏋️" : "–"}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <span className="label">Meals and snacks a day</span>
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Fewer meals" className="btn-secondary h-11 w-11 px-0" disabled={a.mealsPerDay <= 3} onClick={() => onChange({ mealsPerDay: a.mealsPerDay - 1 })}>−</button>
            <span className="w-8 text-center text-xl font-bold">{a.mealsPerDay}</span>
            <button type="button" aria-label="More meals" className="btn-secondary h-11 w-11 px-0" disabled={a.mealsPerDay >= 7} onClick={() => onChange({ mealsPerDay: a.mealsPerDay + 1 })}>+</button>
          </div>
          <p className="mt-1 text-sm text-muted">3 meals + {Math.max(0, a.mealsPerDay - 3)} snack{a.mealsPerDay - 3 === 1 ? "" : "s"} or shake{a.mealsPerDay - 3 === 1 ? "" : "s"}</p>
        </div>
        <label>
          <span className="label">Next {sport.eventLabel} <span className="font-normal text-muted">(optional)</span></span>
          <input type="date" className="field" value={a.competitionDate ?? ""} onChange={(e) => onChange({ competitionDate: e.target.value || null })} />
          <span className="mt-1 block text-sm text-muted">{EVENT_HINT[sport.event]}</span>
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-3">
        <input type="checkbox" className="h-5 w-5 accent-olive" checked={a.shakes} onChange={(e) => onChange({ shakes: e.target.checked })} />
        <span><b>Protein shakes are OK</b> <span className="text-muted">(protein powder goes on the list)</span></span>
      </label>

      <p className="rounded-2xl bg-ochre-soft p-3 text-sm">
        🍽 At meals, {a.name || "they"} get{a.name ? "s" : ""} up to <b>{portion} portion{portion === 1 ? "" : "s"}</b>, sized to each recipe, and the grocery list buys enough.
      </p>
    </section>
  );
}
