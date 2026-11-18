"use client";

import { useState, useTransition } from "react";
import { setCostCutting, setMode } from "@/app/actions/settings";
import { COST_CUTTING, MODES, type Mode } from "@/lib/settings";

const usd = (n: number) => "$" + n.toFixed(0);

/**
 * The mode banner, always on Home: the current goal (Normal or Workout), whether Cost Cutting is on (it works with
 * either goal), that the family's dietary filters are on whatever the mode, and what Cost Cutting saved. Tap to change.
 */
export function ModeBanner({ mode, costCutting, dietary, saved }: { mode: Mode; costCutting: boolean; dietary: string; saved: { week: number; month: number } | null }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const m = MODES[mode] ?? MODES.normal;
  return (
    <section aria-label="Mode" className="no-print rounded-3xl border-2 border-olive/30 bg-olive-soft/70 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">
          <span aria-hidden="true">{m.icon}</span> {m.label} mode
          {costCutting && <> · <span aria-hidden="true">{COST_CUTTING.icon}</span> {COST_CUTTING.label}</>}
          <span className="font-normal text-muted"> · {dietary ? `Dietary filters on: ${dietary}` : "No dietary filters set"}</span>
        </p>
        <button type="button" className="btn-quiet min-h-9 px-3 text-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Change"}</button>
      </div>
      {costCutting && saved && saved.week > 0 && (
        <p className="mt-1 text-sm">
          <b>Cost Cutting saved you about {usd(saved.week)} this week</b>{saved.month > saved.week ? ` and ${usd(saved.month)} this month` : ""}, compared with a typical week of your dinners.
        </p>
      )}
      {open && (
        <div className="mt-3 space-y-2">
          <div className="space-y-2" role="radiogroup" aria-label="Goal">
            {(Object.keys(MODES) as Mode[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={k === mode} disabled={pending}
                onClick={() => start(async () => { await setMode(k); })}
                className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left ${k === mode ? "border-olive bg-card" : "border-transparent bg-card/60 hover:border-olive/40"}`}>
                <span className="text-xl" aria-hidden="true">{MODES[k].icon}</span>
                <span><span className="block font-bold">{MODES[k].label}</span><span className="block text-sm text-muted">{MODES[k].blurb}</span></span>
              </button>
            ))}
          </div>
          <button type="button" role="switch" aria-checked={costCutting} disabled={pending}
            onClick={() => start(async () => { await setCostCutting(!costCutting); })}
            className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3 text-left ${costCutting ? "border-olive bg-card" : "border-transparent bg-card/60 hover:border-olive/40"}`}>
            <span className="text-xl" aria-hidden="true">{COST_CUTTING.icon}</span>
            <span className="flex-1"><span className="block font-bold">{COST_CUTTING.label}: {costCutting ? "on" : "off"}</span><span className="block text-sm text-muted">{COST_CUTTING.blurb}</span></span>
          </button>
          <p className="text-xs text-muted">Your food rules always apply. Changes shape the next plan you make.</p>
        </div>
      )}
    </section>
  );
}
