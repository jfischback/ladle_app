"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Ingredient } from "@/lib/types";
import { scaleIngredient } from "@/lib/scaling";
import { useServingsFactor } from "./servings-store";

/** Minutes mentioned in a step ("simmer 15 minutes", "bake 20 to 25 minutes"): the longer number, for a timer. */
export function stepMinutes(step: string): number | null {
  const m = step.toLowerCase().match(/(\d+)(?:\s*(?:to|-|–)\s*(\d+))?\s*(minutes?|mins?|hours?|hrs?)\b/);
  if (!m) return null;
  const n = Number(m[2] ?? m[1]);
  const minutes = /^h/.test(m[3]) ? n * 60 : n;
  return minutes > 0 && minutes <= 600 ? minutes : null;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/**
 * Cooking mode: one step at a time in big type, big buttons for messy hands, the screen kept awake,
 * and a one-tap timer when a step says how long.
 */
export function CookMode({ recipeId, name, steps, ingredients, startOpen = false, notes = null }: { recipeId: string; name: string; steps: string[]; ingredients: Ingredient[]; startOpen?: boolean; notes?: string | null }) {
  const factor = useServingsFactor(recipeId);
  const [open, setOpenState] = useState(startOpen);
  // Opened from "Start cooking" (?cook=1): closing it takes that off the address, so a reload doesn't reopen it.
  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    if (!v && window.location.search.includes("cook=1")) {
      const url = new URL(window.location.href);
      url.searchParams.delete("cook");
      window.history.replaceState(window.history.state, "", url);
    }
  }, []);
  const [at, setAt] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  // `endsAt` is the clock time the timer finishes: the countdown is read from the clock, so a phone that
  // slows or pauses the page in the background can't make it run long.
  const [timer, setTimer] = useState<{ left: number; total: number; running: boolean; endsAt: number } | null>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const lock = useRef<{ release: () => Promise<void> } | null>(null);

  // Keep the screen on while cooking.
  useEffect(() => {
    if (!open) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const grab = () => nav.wakeLock?.request("screen").then((l) => { lock.current = l; }).catch(() => {});
    grab();
    const again = () => { if (document.visibilityState === "visible") grab(); };
    document.addEventListener("visibilitychange", again);
    return () => { document.removeEventListener("visibilitychange", again); lock.current?.release().catch(() => {}); lock.current = null; };
  }, [open]);

  // The timer ticks, then beeps and buzzes when it's done.
  useEffect(() => {
    if (!timer?.running) return;
    if (timer.left <= 0) {
      try {
        const ctx = new AudioContext();
        [0, 0.35, 0.7].forEach((t) => { const o = ctx.createOscillator(); o.frequency.value = 880; o.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2); });
      } catch {}
      navigator.vibrate?.([300, 150, 300, 150, 300]);
      setTimer((t) => (t ? { ...t, running: false } : t));
      return;
    }
    const tick = () => setTimer((t) => (t && t.running ? { ...t, left: Math.max(0, Math.ceil((t.endsAt - Date.now()) / 1000)) } : t));
    const id = setTimeout(tick, 500);
    // Back from the background: catch up straight away.
    document.addEventListener("visibilitychange", tick);
    return () => { clearTimeout(id); document.removeEventListener("visibilitychange", tick); };
  }, [timer]);

  // A real dialog for the keyboard and screen readers: focus moves in, Tab stays inside, and focus goes back
  // to "Start cooking" when it closes.
  useEffect(() => {
    if (!open) return;
    const box = dialog.current;
    const back = opener.current;
    box?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !box) return;
      const stops = [...box.querySelectorAll<HTMLElement>("button:not([disabled]), summary, a[href], [tabindex]:not([tabindex='-1'])")];
      if (!stops.length) return;
      const first = stops[0];
      const lastStop = stops[stops.length - 1];
      const here = document.activeElement;
      if (e.shiftKey && (here === first || here === box)) { e.preventDefault(); lastStop.focus(); }
      else if (!e.shiftKey && (here === lastStop || !box.contains(here))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.removeEventListener("keydown", trap); back?.focus(); };
  }, [open]);

  const go = useCallback((d: number) => setAt((n) => Math.min(steps.length - 1, Math.max(0, n + d))), [steps.length]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowRight") go(1); if (e.key === "ArrowLeft") go(-1); if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, go, setOpen]);

  if (!steps.length) return null;
  const minutes = stepMinutes(steps[at]);
  const last = at === steps.length - 1;

  return (
    <>
      <button ref={opener} type="button" className="btn-warm w-full sm:w-auto" onClick={() => { setOpen(true); setAt(0); }}>👩‍🍳 Start cooking</button>
      {open && (
        <div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`Cooking ${name}`} className="fixed inset-0 z-50 flex flex-col bg-cream outline-none">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <p className="min-w-0 truncate font-display text-lg font-semibold">{name}</p>
            <button type="button" className="btn-quiet min-h-10 px-3" onClick={() => setOpen(false)}>{last ? "Finish cooking" : "Exit cooking"}</button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6">
            {notes && (
              <details className="mb-4 rounded-2xl bg-ochre-soft px-4 py-2" open={at === 0}>
                <summary className="cursor-pointer font-bold">📝 Our notes</summary>
                <p className="mt-1 whitespace-pre-line">{notes}</p>
              </details>
            )}
            {factor !== 1 && /\d/.test(steps[at]) && <p className="mb-3 rounded-2xl bg-ochre-soft px-3 py-2 text-sm">You&apos;re not making the recipe as written, so go by the ingredient list for amounts. Numbers inside the steps are for the original size.</p>}
            <p className="eyebrow">Step {at + 1} of {steps.length}</p>
            <p className="mt-3 text-2xl leading-relaxed sm:text-3xl">{steps[at]}</p>
            {minutes && (
              <div className="mt-6 rounded-3xl bg-ochre-soft p-4">
                {timer && timer.total === minutes * 60 ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`font-display text-4xl font-semibold ${timer.left === 0 ? "text-terracotta-dark" : ""}`} aria-live="polite">{timer.left === 0 ? "Time's up!" : mmss(timer.left)}</span>
                    {timer.left > 0 && <button type="button" className="btn-secondary min-h-10 px-4" onClick={() => setTimer({ ...timer, running: !timer.running, endsAt: Date.now() + timer.left * 1000 })}>{timer.running ? "Pause" : "Resume"}</button>}
                    <button type="button" className="btn-quiet min-h-10 px-3" onClick={() => setTimer(null)}>Clear</button>
                  </div>
                ) : (
                  <button type="button" className="btn-primary" onClick={() => setTimer({ left: minutes * 60, total: minutes * 60, running: true, endsAt: Date.now() + minutes * 60_000 })}>⏲️ Start a {minutes >= 60 && minutes % 60 === 0 ? `${minutes / 60}-hour` : `${minutes}-minute`} timer</button>
                )}
              </div>
            )}
            <button type="button" className="mt-6 text-sm font-bold text-olive-dark underline" onClick={() => setShowIngredients((v) => !v)}>{showIngredients ? "Hide ingredients" : "Show ingredients"}</button>
            {showIngredients && (
              <ul className="mt-2 space-y-1 text-lg">
                {ingredients.map((raw, n) => { const i = scaleIngredient(raw, factor); return <li key={n}><b>{[i.amount, i.unit].filter(Boolean).join(" ")}</b> {i.item}</li>; })}
              </ul>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-line p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button type="button" className="btn-secondary min-h-16 text-lg" disabled={at === 0} onClick={() => go(-1)}>← Back</button>
            {last ? (
              <button type="button" className="btn-primary min-h-16 text-lg" onClick={() => setOpen(false)}>🎉 All done</button>
            ) : (
              <button type="button" className="btn-primary min-h-16 text-lg" onClick={() => go(1)}>Next →</button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
