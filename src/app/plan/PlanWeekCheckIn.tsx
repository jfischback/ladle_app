"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { GoalCard } from "@/components/GoalCard";
import { planUpcomingWeek } from "@/app/actions/plans";
import { saveFoodRules, setCostCutting, setMode } from "@/app/actions/settings";
import { FoodRulesStep } from "@/app/setup/SetupWizard";
import { rulesSummary, type FoodRule } from "@/lib/diet";
import { COST_CUTTING, MODES, type Mode } from "@/lib/settings";

type Night = "cook" | "busy" | "out";
type Defaults = { cookDays: number[]; busyDays: number[]; budget: number; tryNew: boolean; adults: number; kids: number; desserts: number };
type Table = { adults: number; kids: number };
type Rules = { rules: FoodRule[]; dislikes: string[]; allow: string[] };
/** A week that can be planned: the rest of the one in progress ("now") or the next one. */
export type WeekChoice = { key: "now" | "next"; weekOf: string; title: string; range: string; days: { date: string; weekday: number }[]; status: "none" | "draft" | "approved";
  /** The plan this week already has (or just had): which nights it cooks and who's eating, to start from. */
  current?: { weekday: number; cook: boolean; eating: Table | null }[] };
type StepKey = "week" | "nights" | "who" | "rules" | "wishes" | "pricing" | "ready";

const GOAL_HINT: Record<Mode, string> = { normal: "Favorites, sales and new things", workout: "More protein for everyone" };
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDay = (date: string) => `${MON[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8))}`;
const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TITLE: Record<StepKey, string> = { week: "Which week?", nights: "Which nights?", who: "Who's around", rules: "Food rules still right?", wishes: "This week's wishes", pricing: "Goal and budget", ready: "Ready?" };
const NIGHTS: { key: Night; icon: string; label: string; hint: string }[] = [
  { key: "cook", icon: "🍲", label: "Cook", hint: "A regular dinner" },
  { key: "busy", icon: "⚡", label: "Quick", hint: "Busy night, fast dinner" },
  { key: "out", icon: "🍕", label: "Off", hint: "Eating out or leftovers" },
];
// Answers are kept while this tab is open, so a side trip (athlete mode, food creators) doesn't lose them.
const KEEP = "ladle-checkin";

/** The weekly check-in: which week, which nights, who's eating, food rules, wishes, then mode and budget. Then Ladle plans the week. */
export function PlanWeekCheckIn({ weeks, initialWeek, fresh = false, firstWeek = false, defaults, foodRules, mode: savedMode, costCutting: savedCost = false, alsoPlanned = [], athletes, health = 0, creators }: { weeks: WeekChoice[]; initialWeek: "now" | "next"; fresh?: boolean; firstWeek?: boolean; defaults: Defaults; foodRules: Rules; mode: Mode; costCutting?: boolean; alsoPlanned?: string[]; athletes: number; health?: number; creators: string[] }) {
  const router = useRouter();
  const open = weeks.filter((w) => w.status !== "approved");
  // The week question only shows when there's a real choice to make. The food rules check is skipped on the very
  // first plan: they were just answered in setup. Mode and budget come last, right before planning.
  const steps: StepKey[] = [...(weeks.length > 1 ? (["week"] as const) : []), "nights", "who", ...(firstWeek ? [] : (["rules"] as const)), "wishes", "pricing", "ready"];
  const [stepKey, setStepKey] = useState<StepKey>(steps[0]);
  const step = Math.max(0, steps.indexOf(stepKey));
  const [weekKey, setWeekKey] = useState<"now" | "next">(initialWeek);
  const week = weeks.find((w) => w.key === weekKey) ?? open[0];
  const days = week.days;
  // A week that already has a plan starts from that plan's nights and tables; otherwise from the usual settings.
  const seedNights = (w: WeekChoice): Record<number, Night> =>
    Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((wd) => {
      const now = w.current?.find((c) => c.weekday === wd);
      const cooks = now ? now.cook : defaults.cookDays.includes(wd);
      return [wd, !cooks ? "out" : defaults.busyDays.includes(wd) ? "busy" : "cook"];
    }));
  const seedTables = (w: WeekChoice): Record<number, Table> => Object.fromEntries((w.current ?? []).flatMap((c) => (c.cook && c.eating ? [[c.weekday, c.eating]] : [])));
  const [nights, setNights] = useState<Record<number, Night>>(() => seedNights(week));
  const [tables, setTables] = useState<Record<number, Table>>(() => seedTables(week));
  const pickWeek = (w: WeekChoice) => { setWeekKey(w.key); setNights(seedNights(w)); setTables(seedTables(w)); };
  const [budget, setBudget] = useState(String(defaults.budget));
  const [useUp, setUseUp] = useState("");
  const [craving, setCraving] = useState("");
  const [tryNew, setTryNew] = useState(defaults.tryNew);
  const [desserts, setDesserts] = useState(defaults.desserts);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Food rules, the goal and Cost Cutting are saved for every week, right from these screens.
  const [rules, setRules] = useState<Rules>(foodRules);
  const [draft, setDraft] = useState<Rules>(foodRules);
  const [editingRules, setEditingRules] = useState(false);
  const [mode, setModeNow] = useState<Mode>(MODES[savedMode] ? savedMode : "normal");
  const [cost, setCostNow] = useState(savedCost);
  const [saving, startSaving] = useTransition();
  const [stillError, setStillError] = useState<string | null>(null);

  // Pick up where they left off (same tab, same weeks on offer), then keep the answers as they change.
  const restored = useRef(false);
  const weeksKey = weeks.map((w) => `${w.key}:${w.weekOf}:${w.days.length}`).join("|");
  useEffect(() => {
    try {
      // Arriving from "Start over" or "Re-plan" begins from that plan, not from answers left over from another time.
      const kept = fresh ? null : JSON.parse(sessionStorage.getItem(KEEP) ?? "null");
      if (kept && kept.weeksKey === weeksKey) {
        if (open.some((w) => w.key === kept.weekKey)) setWeekKey(kept.weekKey);
        if (steps.includes(kept.stepKey)) setStepKey(kept.stepKey);
        setNights(kept.nights); setTables(kept.tables); if (typeof kept.budget === "string" && kept.budget.trim()) setBudget(kept.budget); setUseUp(kept.useUp); setCraving(kept.craving); setTryNew(kept.tryNew); setDesserts(kept.desserts);
      }
    } catch {}
    restored.current = true;
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!restored.current) return;
    try { sessionStorage.setItem(KEEP, JSON.stringify({ weeksKey, weekKey, stepKey, nights, tables, budget, useUp, craving, tryNew, desserts })); } catch {}
  }, [weeksKey, weekKey, stepKey, nights, tables, budget, useUp, craving, tryNew, desserts]);

  const cooking = days.filter((d) => nights[d.weekday] !== "out");
  const usual: Table = { adults: defaults.adults, kids: defaults.kids };
  const tableFor = (wd: number) => tables[wd] ?? usual;
  const changedTables = cooking.filter((d) => tables[d.weekday] && (tables[d.weekday].adults !== usual.adults || tables[d.weekday].kids !== usual.kids));
  const budgetNum = Number(budget.replace(/[$,\s]/g, ""));
  const budgetOk = Number.isFinite(budgetNum) && budgetNum >= 10;
  const summary = rulesSummary(rules.rules, rules.dislikes, rules.allow);

  const plan = () =>
    start(async () => {
      setError(null);
      const r = await planUpcomingWeek(week.key === "now", {
        cookDays: cooking.map((d) => d.weekday),
        busyDays: cooking.filter((d) => nights[d.weekday] === "busy").map((d) => d.weekday),
        budget: budgetOk ? budgetNum : null,
        useUp,
        craving,
        tryNew,
        desserts,
        eating: changedTables.map((d) => ({ weekday: d.weekday, ...tables[d.weekday] })),
      });
      if (r?.error) setError(r.error);
      else {
        try { sessionStorage.removeItem(KEEP); } catch {}
        // Straight to the week that was just planned.
        router.push(`/?week=${week.weekOf}`);
      }
    });

  const saveRules = () =>
    startSaving(async () => {
      setStillError(null);
      const r = await saveFoodRules({ foodRules: draft.rules, dislikes: draft.dislikes, allowAnyway: draft.allow });
      if (r?.error) setStillError(r.error);
      else { setRules(draft); setEditingRules(false); }
    });
  const pickMode = (k: Mode) =>
    startSaving(async () => {
      setStillError(null);
      const r = await setMode(k);
      if (r?.error) setStillError(r.error);
      else setModeNow(k);
    });
  const toggleCost = () =>
    startSaving(async () => {
      setStillError(null);
      const r = await setCostCutting(!cost);
      if (r?.error) setStillError(r.error);
      else setCostNow(!cost);
    });

  const people = (t: Table) => `${t.adults} adult${t.adults === 1 ? "" : "s"}${t.kids ? `, ${t.kids} kid${t.kids === 1 ? "" : "s"}` : ""}`;
  const last = step === steps.length - 1;
  const canNext = stepKey === "nights" ? cooking.length > 0 : stepKey === "rules" ? !editingRules && !saving : stepKey === "pricing" ? !saving : true;

  return (
    <div className="space-y-4">
      <div>
        <p className="eyebrow">Step {step + 1} of {steps.length}{stepKey !== "week" ? ` · ${week.title}, ${week.range}` : ""}</p>
        <div className="mt-2 flex gap-1.5" aria-hidden="true">
          {steps.map((s, i) => <div key={s} className={`h-2.5 flex-1 rounded-full ${i <= step ? "bg-terracotta" : "bg-oat"}`} />)}
        </div>
      </div>
      <section className="card space-y-4 p-5" aria-labelledby="checkin-step">
        <h2 id="checkin-step" className="text-2xl font-semibold">{TITLE[stepKey]}</h2>

        {stepKey === "week" && (
          <>
            <p className="text-muted">Pick the days you want dinners for.</p>
            <div role="radiogroup" aria-label="Which week" className="space-y-2">
              {weeks.map((w) => {
                const on = w.key === weekKey;
                const done = w.status === "approved";
                return (
                  <button key={w.key} type="button" role="radio" aria-checked={on} disabled={done} onClick={() => w.key !== weekKey && pickWeek(w)}
                    className={`flex w-full items-start gap-3 rounded-2xl border-2 p-3.5 text-left ${done ? "border-line bg-oat/60 text-muted" : on ? "border-olive bg-olive-soft" : "border-line bg-card hover:border-olive/50"}`}>
                    <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${on && !done ? "border-olive bg-olive text-cream" : "border-line bg-card"}`}>{on && !done ? "✓" : ""}</span>
                    <span>
                      <span className="block text-lg font-bold">{w.title}</span>
                      <span className="block">{w.range} · {w.days.length} days</span>
                      {done && <span className="block text-sm">Already approved. To change it, open it on Home and tap &ldquo;Re-plan this week.&rdquo;</span>}
                      {w.status === "draft" && <span className="block text-sm text-muted">There&apos;s a plan waiting for your OK. Planning again replaces it with new picks.</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {stepKey === "nights" && (
          <>
            <p className="text-muted">{week.current ? "These match the plan you have now." : "These are your usual nights."} Tap to change any night.</p>
            <ul className="grid grid-cols-3 gap-2 text-center text-sm" aria-label="What each choice means">
              {NIGHTS.map((n) => <li key={n.key} className="rounded-xl bg-oat/70 px-1.5 py-1.5"><b><span aria-hidden="true">{n.icon}</span> {n.label}</b><span className="block text-muted">{n.hint}</span></li>)}
            </ul>
            <ul className="divide-y divide-line rounded-2xl border-2 border-line">
              {days.map((d) => (
                <li key={d.date} className="space-y-1.5 px-3 py-3 sm:flex sm:items-center sm:gap-3 sm:space-y-0">
                  <p className="leading-tight sm:w-32 sm:shrink-0">
                    <span className="text-lg font-bold">{DAY[d.weekday]}</span> <span className="text-muted">{shortDay(d.date)}</span>
                  </p>
                  <div role="radiogroup" aria-label={DAY[d.weekday]} className="grid flex-1 grid-cols-3 gap-2">
                    {NIGHTS.map((n) => {
                      const on = nights[d.weekday] === n.key;
                      return (
                        <button key={n.key} type="button" role="radio" aria-checked={on} aria-label={`${n.label}: ${n.hint}`} onClick={() => setNights((x) => ({ ...x, [d.weekday]: n.key }))}
                          className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl border-2 text-base font-bold transition-all active:scale-95 ${on ? "border-olive bg-olive text-cream shadow-soft" : "border-line bg-card text-muted hover:border-olive/50"}`}>
                          <span aria-hidden="true" className="text-lg leading-none">{n.icon}</span>
                          {n.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
            <p className="font-semibold">{cooking.length} dinner{cooking.length === 1 ? "" : "s"} to plan{days.some((d) => nights[d.weekday] === "busy") ? `, ${days.filter((d) => nights[d.weekday] === "busy").length} quick` : ""}.</p>
            {!cooking.length && <p role="alert" className="font-bold text-terracotta-dark">Pick at least one night to cook.</p>}
          </>
        )}

        {stepKey === "who" && (
          <>
            <p className="text-muted">Usually {people(usual)}. Company coming, or someone away? Change those nights and the groceries follow.</p>
            <ul className="space-y-2">
              {cooking.map((d) => {
                const t = tableFor(d.weekday);
                const set = (k: keyof Table, v: number) => setTables((x) => ({ ...x, [d.weekday]: { ...t, [k]: Math.max(0, Math.min(30, v)) } }));
                return (
                  <li key={d.date} className="flex flex-wrap items-center gap-2">
                    <span className="w-full font-bold sm:w-24">{DAY[d.weekday]}</span>
                    {(["adults", "kids"] as const).map((k) => (
                      <span key={k} className="flex items-center gap-1">
                        <button type="button" className="btn-secondary h-9 min-h-9 w-9 px-0" aria-label={`Fewer ${k} on ${DAY[d.weekday]}`} disabled={t[k] <= 0 || t.adults + t.kids <= 1} onClick={() => set(k, t[k] - 1)}>−</button>
                        <span className="w-16 text-center text-sm font-bold">{t[k]} {k}</span>
                        <button type="button" className="btn-secondary h-9 min-h-9 w-9 px-0" aria-label={`More ${k} on ${DAY[d.weekday]}`} onClick={() => set(k, t[k] + 1)}>+</button>
                      </span>
                    ))}
                  </li>
                );
              })}
            </ul>
            <div className="space-y-3">
              <GoalCard icon="💪" title="Anyone training this week?"
                text={athletes ? `${athletes} ${athletes === 1 ? "person is" : "people are"} in athlete mode: portions and protein are planned in.` : "Bigger portions, more protein and the right snacks for whoever's working out."}
                href="/athletes" button={athletes ? "Change" : "Set up athlete mode"} />
              <GoalCard icon="🩺" tone="ochre" title="Diabetes or watching salt?"
                text={health ? `${health} ${health === 1 ? "person's" : "people's"} health needs are planned in.` : "Dinners steered around carbs or sodium, with tips on which side to cut."}
                href="/health" button={health ? "Change" : "Add health needs"} />
            </div>
            <p className="text-sm text-muted">Your answers here are kept while you&apos;re gone.</p>
          </>
        )}

        {stepKey === "rules" && (
          <>
            <p className="text-muted">A quick look before the dinners are picked. Change them if anything&apos;s different now.</p>

            <div className="rounded-2xl border-2 border-line p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold">🥗 Food rules</p>
                  <p className={summary ? "" : "text-muted"}>{summary || "None set. Every recipe in your box can be picked."}</p>
                </div>
                {!editingRules && <button type="button" className="btn-secondary min-h-10 shrink-0 px-3.5 text-sm" onClick={() => { setDraft(rules); setEditingRules(true); }}>Change</button>}
              </div>
              {editingRules && (
                <div className="mt-4 space-y-4 border-t border-line pt-4">
                  <FoodRulesStep rules={draft.rules} dislikes={draft.dislikes} allow={draft.allow} onRules={(v) => setDraft((x) => ({ ...x, rules: v }))} onDislikes={(v) => setDraft((x) => ({ ...x, dislikes: v }))} onAllow={(v) => setDraft((x) => ({ ...x, allow: v }))} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-primary" disabled={saving} onClick={saveRules}>{saving ? "Saving…" : "Save food rules"}</button>
                    <button type="button" className="btn-quiet" disabled={saving} onClick={() => setEditingRules(false)}>Cancel</button>
                  </div>
                </div>
              )}
              <p className="mt-2 text-sm text-muted">Saved for every week, not just this one. Ladle skips recipes whose ingredients break these. For allergies, still check every label yourself.</p>
            </div>

            {stillError && <p role="alert" className="font-bold text-terracotta-dark">{stillError}</p>}
            {editingRules && <p className="text-sm text-muted">Save or cancel the food rules to keep going.</p>}
          </>
        )}

        {stepKey === "wishes" && (
          <>
            <p className="text-muted">All optional. Skip what doesn&apos;t matter this week.</p>
            <div>
              <label htmlFor="ci-useup" className="label">Anything to use up?</label>
              <input id="ci-useup" className="field" placeholder="chicken, rice, half a bag of spinach…" value={useUp} maxLength={300} onChange={(e) => setUseUp(e.target.value)} />
            </div>
            <div>
              <label htmlFor="ci-craving" className="label">In the mood for anything?</label>
              <input id="ci-craving" className="field" placeholder="tacos, soup, something Italian…" value={craving} maxLength={80} onChange={(e) => setCraving(e.target.value)} />
            </div>
            <fieldset>
              <legend className="label">🍰 Dessert this week?</legend>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <label key={n} className={`cursor-pointer rounded-full border-2 px-3 py-1 font-semibold ${desserts === n ? "border-olive bg-olive text-cream" : "border-line bg-card"}`}>
                    <input type="radio" name="ci-desserts" className="sr-only" checked={desserts === n} onChange={() => setDesserts(n)} />
                    {n === 0 ? "None" : `${n} night${n === 1 ? "" : "s"}`}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={tryNew} onChange={(e) => setTryNew(e.target.checked)} />
              <span>
                <b>Try something new</b> from your food creators{creators.length ? ` (${creators.slice(0, 2).join(", ")}${creators.length > 2 ? "…" : ""})` : ""}.{" "}
                {!creators.length && <Link href="/recipes?tab=cooks" className="font-bold text-olive-dark underline">Follow a few first</Link>}
                {!creators.length && <span className="block text-sm text-muted">Your answers here are kept while you&apos;re gone.</span>}
              </span>
            </label>
          </>
        )}

        {stepKey === "pricing" && (
          <>
            <p className="text-muted">Three quick answers, then Ladle plans the week.</p>

            <fieldset>
              <legend className="text-lg font-bold">1. What&apos;s the goal?</legend>
              <div role="radiogroup" aria-label="Goal" className="mt-2 grid grid-cols-2 gap-2">
                {(Object.keys(MODES) as Mode[]).map((k) => (
                  <button key={k} type="button" role="radio" aria-checked={k === mode} disabled={saving} onClick={() => k !== mode && pickMode(k)}
                    className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 p-3 text-center ${k === mode ? "border-olive bg-olive text-cream" : "border-line bg-card hover:border-olive/50"}`}>
                    <span className="text-2xl" aria-hidden="true">{MODES[k].icon}</span>
                    <span className="text-lg font-bold">{MODES[k].label}</span>
                    <span className={`text-sm ${k === mode ? "text-cream/90" : "text-muted"}`}>{GOAL_HINT[k]}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-lg font-bold">2. Buy the cheapest brands?</legend>
              <div role="radiogroup" aria-label="Buy the cheapest brands" className="mt-2 grid grid-cols-2 gap-2">
                {[true, false].map((v) => (
                  <button key={String(v)} type="button" role="radio" aria-checked={cost === v} disabled={saving} onClick={() => cost !== v && toggleCost()}
                    className={`flex flex-col items-center gap-0.5 rounded-2xl border-2 p-3 text-center ${cost === v ? "border-olive bg-olive text-cream" : "border-line bg-card hover:border-olive/50"}`}>
                    <span className="text-2xl" aria-hidden="true">{v ? "💵" : "🏷️"}</span>
                    <span className="text-lg font-bold">{v ? "Yes, save money" : "No"}</span>
                    <span className={`text-sm ${cost === v ? "text-cream/90" : "text-muted"}`}>{v ? "Cheapest dinners and products win" : "Your usual picks and brands"}</span>
                  </button>
                ))}
              </div>
              <p className="mt-1 text-sm text-muted">This is Cost Cutting. It works with either goal.</p>
            </fieldset>

            <div>
              <label htmlFor="ci-budget" className="text-lg font-bold">3. Spend up to how much this week?</label>
              <div className="relative mt-2 w-40">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-muted">$</span>
                <input id="ci-budget" inputMode="decimal" className="field pl-7 text-lg" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              {!budgetOk && <p className="mt-1 text-sm text-terracotta-dark">That doesn&apos;t look like a budget, so we&apos;ll use your usual ${defaults.budget}.</p>}
            </div>

            <p className="rounded-2xl bg-oat/70 p-3 text-sm">The goal and cheapest brands stay on for future weeks until you change them. The budget is just for this week; your usual is ${defaults.budget}.</p>
            {stillError && <p role="alert" className="font-bold text-terracotta-dark">{stillError}</p>}
          </>
        )}

        {stepKey === "ready" && (
          <>
            <p className="text-muted">Here&apos;s what Ladle will plan around. Go back to change anything.</p>
            <ul className="space-y-1.5">
              <li>🗓 <b>{week.title}</b>, {week.range}</li>
              <li>🍲 <b>{cooking.length} dinner{cooking.length === 1 ? "" : "s"}</b>{cooking.some((d) => nights[d.weekday] === "busy") ? `, quick ones on ${cooking.filter((d) => nights[d.weekday] === "busy").map((d) => DAY[d.weekday].slice(0, 3)).join(", ")}` : ""}</li>
              {days.some((d) => nights[d.weekday] === "out") && <li>🍕 Nights off: {days.filter((d) => nights[d.weekday] === "out").map((d) => DAY[d.weekday].slice(0, 3)).join(", ")}</li>}
              {changedTables.map((d) => <li key={d.date}>👥 {DAY[d.weekday]}: {people(tables[d.weekday])}</li>)}
              <li>🥗 Food rules: {summary || "none"}</li>
              <li>🎯 {MODES[mode].label} mode{cost ? ` with ${COST_CUTTING.label}` : ""}</li>
              <li>💵 Budget: ${budgetOk ? budgetNum : defaults.budget}</li>
              {useUp.trim() && <li>🥫 Use up: {useUp.trim()}</li>}
              {craving.trim() && <li>😋 In the mood for: {craving.trim()}</li>}
              <li>✨ {tryNew ? "Something new from your food creators" : "Just your own recipes"}</li>
              {desserts > 0 && <li>🍰 Dessert {desserts} night{desserts === 1 ? "" : "s"}</li>}
              {alsoPlanned.length > 0 && <li>☕ Also planned, from your <Link href="/setup?step=5" className="font-bold text-olive-dark underline">Cooking settings</Link>: {alsoPlanned.join(", ")}</li>}
            </ul>
            {week.status === "draft" && <p className="rounded-2xl bg-ochre-soft p-3 text-sm">This replaces the plan that&apos;s waiting for your OK.</p>}
          </>
        )}

        {error && (
          <div role="alert" className="space-y-2 rounded-2xl bg-terracotta-soft p-3">
            <p className="font-bold text-terracotta-dark">{error}</p>
            {/recipe/i.test(error) && (
              <p className="flex flex-wrap gap-2">
                <Link href="/recipes?tab=browse" className="btn-secondary min-h-10 px-3.5 text-sm">Add recipes</Link>
                <button type="button" className="btn-quiet min-h-10 px-3 text-sm" onClick={() => { setError(null); setStepKey("nights"); }}>Pick fewer nights</button>
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button type="button" className="btn-quiet" disabled={step === 0 || pending} onClick={() => setStepKey(steps[step - 1])}>← Back</button>
          {!last ? (
            <button type="button" className="btn-warm px-7" disabled={!canNext} onClick={() => setStepKey(steps[step + 1])}>Next →</button>
          ) : (
            <button type="button" className="btn-warm min-h-14 px-8 text-lg" disabled={pending || !cooking.length} onClick={plan}>
              {pending ? <><span className="animate-wiggle inline-block" aria-hidden="true">🥄</span> Stirring up your week…</> : "Plan my week"}
            </button>
          )}
        </div>
        {pending && <p className="text-sm text-muted">Checking prices and picking dinners. This takes a few seconds.</p>}
      </section>
    </div>
  );
}
