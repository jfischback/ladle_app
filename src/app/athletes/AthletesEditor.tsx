"use client";

import { useState, useTransition } from "react";
import { saveAthletes } from "../actions/athletes";
import { GOALS, newAthlete, portionFor, suggestTargets, type Athlete, type AthleteGoal } from "@/lib/athletes";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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
  const suggest = (goal: AthleteGoal, weight: number | null) => (weight ? suggestTargets(goal, weight) : {});
  const portion = portionFor(a);
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
        <legend className="label">Goal</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(GOALS) as AthleteGoal[]).map((g) => {
            const on = a.goal === g;
            return (
              <button key={g} type="button" aria-pressed={on} onClick={() => onChange({ goal: g, ...suggest(g, a.weightLb) })}
                className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors ${on ? "border-olive bg-olive-soft" : "border-line bg-card hover:border-olive/50"}`}>
                <span className="text-2xl" aria-hidden="true">{GOALS[g].icon}</span>
                <span><span className="block font-bold">{GOALS[g].label}</span><span className="text-sm text-muted">{GOALS[g].blurb}</span></span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="label">Body weight (lb)</span>
          <input className="field" inputMode="numeric" value={a.weightLb ?? ""} placeholder="e.g. 250"
            onChange={(e) => {
              const w = Number(e.target.value.replace(/\D/g, "")) || null;
              onChange({ weightLb: w, ...(w && w >= 60 && w <= 600 ? suggest(a.goal, w) : {}) });
            }} />
        </label>
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
        {a.weightLb ? "Filled in from body weight and goal. Change them to your coach's numbers anytime." : "Enter body weight and we'll suggest numbers."}
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
          <span className="label">Next competition or race <span className="font-normal text-muted">(optional)</span></span>
          <input type="date" className="field" value={a.competitionDate ?? ""} onChange={(e) => onChange({ competitionDate: e.target.value || null })} />
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
