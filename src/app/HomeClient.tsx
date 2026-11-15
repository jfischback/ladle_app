"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { approvePlan, planUpcomingWeek, rateCookedDinner, startOver, swapDay } from "./actions/plans";
import { StarPicker } from "@/components/Stars";
import type { PlanDay } from "@/lib/types";
import { dayName, money, shortDate } from "@/lib/week";

function ErrorNote({ error }: { error: string | null }) {
  return error ? <p role="alert" className="rounded-xl bg-terracotta-soft px-3 py-2 text-terracotta-dark">{error}</p> : null;
}

export function PlanButton({ label, big }: { label: string; big?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        className={big ? "btn-primary min-h-14 px-8 text-lg" : "btn-secondary"}
        disabled={pending}
        onClick={() => start(async () => { setError(null); const r = await planUpcomingWeek(); if (r?.error) setError(r.error); })}
      >
        {pending ? "Planning your week…" : label}
      </button>
      {pending && <p className="text-sm text-muted">Picking dinners from your recipes. This takes a few seconds.</p>}
      <ErrorNote error={error} />
    </div>
  );
}

export function DayCard({ planId, index, day, isToday, locked, recipes }: {
  planId: string; index: number; day: PlanDay; isToday: boolean; locked: boolean; recipes: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const swap = (recipeId: string | null) =>
    start(async () => {
      setError(null);
      const r = await swapDay(planId, index, recipeId);
      if (r?.error) setError(r.error);
      else setOpen(false);
    });
  const used = new Set<string>();

  return (
    <div className={`card p-4 ${isToday ? "border-2 border-olive" : ""} ${pending ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            {dayName(day.date)} · {shortDate(day.date)} {isToday && <span className="text-olive-dark">· Tonight</span>}
          </p>
          {day.recipeId ? (
            <Link href={`/recipes/${day.recipeId}`} className="text-xl font-bold leading-snug hover:underline">{day.recipeName}</Link>
          ) : (
            <p className="text-xl font-bold text-muted">No-cook night</p>
          )}
          {day.reason && day.recipeId && <p className="mt-1 text-muted">{day.reason}</p>}
          {day.saleItems.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">{day.saleItems.map((s) => <span key={s} className="tag-sale">On sale: {s}</span>)}</div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {day.recipeId && day.estimatedCost != null && <span className="text-lg font-semibold">{money(day.estimatedCost)}</span>}
          {!locked && (
            <button className="btn-secondary min-h-10 px-4 text-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              Swap
            </button>
          )}
        </div>
      </div>
      {open && !locked && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {day.alternatives.length > 0 && (
            <ul className="grid gap-2">
              {day.alternatives.map((a) => {
                used.add(a.recipeId);
                return (
                  <li key={a.recipeId}>
                    <button className="w-full rounded-xl border-2 border-line bg-cream p-3 text-left hover:border-olive" disabled={pending} onClick={() => swap(a.recipeId)}>
                      <span className="flex justify-between gap-2 font-semibold"><span>{a.recipeName}</span><span>{money(a.estimatedCost)}</span></span>
                      <span className="text-sm text-muted">{a.reason}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <select aria-label="Pick any recipe" className="field flex-1" defaultValue="" disabled={pending} onChange={(e) => e.target.value && swap(e.target.value)}>
              <option value="" disabled>Or pick any recipe…</option>
              {recipes.filter((r) => r.id !== day.recipeId && !used.has(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {day.recipeId && <button className="btn-quiet" disabled={pending} onClick={() => swap(null)}>Make it a no-cook night</button>}
          </div>
          <ErrorNote error={error} />
        </div>
      )}
    </div>
  );
}

export function ApproveBar({ planId }: { planId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <button
        className="btn-primary min-h-14 w-full text-xl"
        disabled={pending}
        onClick={() => start(async () => { setError(null); const r = await approvePlan(planId); if (r?.error) setError(r.error); })}
      >
        {pending ? "Building your grocery list…" : "Approve"}
      </button>
      <p className="text-center text-sm text-muted">Approving locks the week and makes your grocery list. You stay in charge of paying and checkout.</p>
      <ErrorNote error={error} />
    </div>
  );
}

export function StartOverButton({ planId, approved }: { planId: string; approved: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-quiet"
      disabled={pending}
      onClick={() => {
        if (approved && !confirm("Unlock this week and plan it again? The current plan stays in your records.")) return;
        start(() => startOver(planId));
      }}
    >
      {approved ? "Re-plan this week" : "Start over"}
    </button>
  );
}

export function RatePrompt({ planId, dayIndex, label }: { planId: string; dayIndex: number; label: string }) {
  const [pending, start] = useTransition();
  return (
    <div className={`card flex flex-wrap items-center justify-between gap-2 p-4 ${pending ? "opacity-60" : ""}`}>
      <p className="font-semibold">{label}</p>
      <div className="flex items-center gap-1">
        <StarPicker value={null} label={label} onPick={(n) => start(() => rateCookedDinner(planId, dayIndex, n))} />
        <button className="btn-quiet min-h-10 px-3 text-sm" onClick={() => start(() => rateCookedDinner(planId, dayIndex, null))}>Skip</button>
      </div>
    </div>
  );
}
