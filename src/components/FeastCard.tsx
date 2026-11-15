"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { removeFeast, setFeast } from "@/app/actions/feast";
import { feastIcon, feastLabel, feastMenu, feastTimeline, mainFor } from "@/lib/feast";
import type { PlanDay } from "@/lib/types";
import { dayName, shortDate } from "@/lib/week";

/** Pick the guests and dishes for a holiday dinner (Thanksgiving). */
export function FeastPlanner({ planId, index, day, defaultGuests, onDone }: { planId: string; index: number; day: PlanDay; defaultGuests: number; onDone?: () => void }) {
  const menu = feastMenu(day.holiday ?? "") ?? [];
  const [guests, setGuests] = useState(day.feast?.guests ?? Math.max(2, defaultGuests));
  const [dishes, setDishes] = useState<string[]>(day.feast?.dishes ?? menu.filter((d) => d.default).map((d) => d.key));
  const [frozen, setFrozen] = useState(day.feast?.frozen ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const main = mainFor({ holiday: day.holiday ?? "", guests, dishes, frozen });
  const mainKey = menu.find((d) => d.main)?.key;
  const save = () =>
    start(async () => {
      setError(null);
      const r = await setFeast(planId, index, { guests, dishes, frozen });
      if (r.error) setError(r.error);
      else onDone?.();
    });
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={`guests-${index}`} className="font-bold">How many people?</label>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-secondary min-h-10 w-10 px-0" aria-label="Fewer people" onClick={() => setGuests((g) => Math.max(2, g - 1))}>−</button>
          <input id={`guests-${index}`} type="number" inputMode="numeric" min={2} max={40} value={guests} onChange={(e) => setGuests(Math.min(40, Math.max(2, Number(e.target.value) || 2)))} className="field w-20 text-center" />
          <button type="button" className="btn-secondary min-h-10 w-10 px-0" aria-label="More people" onClick={() => setGuests((g) => Math.min(40, g + 1))}>+</button>
        </div>
      </div>
      <fieldset>
        <legend className="mb-1 font-bold">The menu</legend>
        <div className="grid gap-1 sm:grid-cols-2">
          {menu.map((d) => (
            <label key={d.key} className="flex items-center gap-2 rounded-xl bg-card px-3 py-2">
              <input type="checkbox" checked={dishes.includes(d.key)} onChange={(e) => setDishes((x) => (e.target.checked ? [...x, d.key] : x.filter((k) => k !== d.key)))} />
              <span>{d.name}{d.key === mainKey && main ? ` (${main.two ? "2 × " : ""}${main.lb} lb ${main.kind})` : ""}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {main?.thawDays != null && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={frozen} onChange={(e) => setFrozen(e.target.checked)} />
          <span>The turkey will be frozen (we&apos;ll tell you when to start thawing it)</span>
        </label>
      )}
      {error && <p role="alert" className="text-sm font-bold text-terracotta-dark">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={pending || !dishes.length} onClick={save}>{pending ? "Saving…" : day.feast ? "Save changes" : `Plan ${feastLabel(day.holiday ?? "")} dinner`}</button>
        {day.feast && (
          <button type="button" className="btn-quiet" disabled={pending} onClick={() => start(async () => { await removeFeast(planId, index); onDone?.(); })}>Take it off the plan</button>
        )}
      </div>
      <p className="text-xs text-muted">Everything goes on your grocery list in its own section, sized for {guests} people{main ? ", leftovers included" : ""}.</p>
    </div>
  );
}

/** The holiday dinner on its day: the menu, the turkey, and the countdown. */
export function FeastCard({ planId, index, day, isToday, canChange, locked, defaultGuests, when = {} }: { planId: string; index: number; day: PlanDay; isToday: boolean; canChange: boolean; locked: boolean; defaultGuests: number; when?: { boughtOn?: string; today?: string } }) {
  const [editing, setEditing] = useState(false);
  const feast = day.feast!;
  const menu = feastMenu(feast.holiday) ?? [];
  const main = mainFor(feast);
  const mainKey = menu.find((d) => d.main)?.key;
  const steps = feastTimeline(feast, day.date, when);
  return (
    <div className={`card overflow-hidden ${isToday ? "ring-2 ring-terracotta shadow-lift" : ""}`}>
      <div className="bg-ochre-soft p-4">
        <p className="text-sm font-extrabold text-terracotta">{isToday ? "Today" : dayName(day.date)} {Number(day.date.slice(8))} · {feast.holiday}</p>
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-2xl font-semibold leading-snug">{feastIcon(feast.holiday)} {feastLabel(feast.holiday)} dinner for {feast.guests}</p>
          {canChange && <button type="button" className="btn-secondary min-h-10 shrink-0 px-3.5 text-sm" aria-expanded={editing} onClick={() => setEditing((e) => !e)}>{editing ? "Close" : "Change"}</button>}
        </div>
        <p className="mt-1 text-sm">
          {menu.filter((d) => feast.dishes.includes(d.key)).map((d) => (d.key === mainKey && main ? `${d.name} (${main.two ? "2 × " : ""}${main.lb} lb)` : d.name)).join(" · ")}
        </p>
      </div>
      {editing ? (
        <div className="border-t border-line bg-cream/60 p-4">
          <FeastPlanner planId={planId} index={index} day={day} defaultGuests={defaultGuests} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <div className="space-y-3 p-4">
          {steps.length > 0 && (
            <ol className="space-y-1.5 text-sm">
              {steps.map((s) => (
                <li key={s.date + s.what} className="flex gap-2"><b className="w-16 shrink-0 text-olive-dark">{s.date === day.date ? "The day of" : shortDate(s.date)}</b><span>{s.what}</span></li>
              ))}
            </ol>
          )}
          {locked && feast.replaced && (
            <p className="rounded-2xl bg-blush/70 px-3 py-2 text-sm">The groceries for {feast.replaced} are on your list too: cook it another night, or freeze them for later.</p>
          )}
          <Link href={`/feast/${planId}/${index}`} className="btn-warm w-full sm:w-auto">📖 Recipes &amp; countdown</Link>
        </div>
      )}
    </div>
  );
}
