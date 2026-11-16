"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { planUpcomingWeek } from "@/app/actions/plans";

type Night = "cook" | "busy" | "out";
type Defaults = { cookDays: number[]; busyDays: number[]; budget: number; tryNew: boolean; adults: number; kids: number; desserts: number };
type Table = { adults: number; kids: number };

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const STEPS = ["This week's nights", "Who's around", "This week's wishes", "Ready?"];
const NIGHTS: { key: Night; label: string; hint: string }[] = [
  { key: "cook", label: "🍲 Cook", hint: "a regular dinner" },
  { key: "busy", label: "⚡ Quick", hint: "a busy night: something quick" },
  { key: "out", label: "🍕 Off", hint: "a night off: eating out or leftovers" },
];

/** The weekly check-in: which nights, who's eating, budget and wishes. Then Ladle plans the week around it. */
export function PlanWeekCheckIn({ thisWeek, days, defaults, athletes, creators }: { thisWeek: boolean; days: { date: string; weekday: number }[]; defaults: Defaults; athletes: number; creators: string[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nights, setNights] = useState<Record<number, Night>>(() =>
    Object.fromEntries(days.map((d) => [d.weekday, !defaults.cookDays.includes(d.weekday) ? "out" : defaults.busyDays.includes(d.weekday) ? "busy" : "cook"])),
  );
  const [tables, setTables] = useState<Record<number, Table>>({});
  const [budget, setBudget] = useState(String(defaults.budget));
  const [useUp, setUseUp] = useState("");
  const [craving, setCraving] = useState("");
  const [tryNew, setTryNew] = useState(defaults.tryNew);
  const [desserts, setDesserts] = useState(defaults.desserts);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const cooking = days.filter((d) => nights[d.weekday] !== "out");
  const usual: Table = { adults: defaults.adults, kids: defaults.kids };
  const tableFor = (wd: number) => tables[wd] ?? usual;
  const changedTables = cooking.filter((d) => tables[d.weekday] && (tables[d.weekday].adults !== usual.adults || tables[d.weekday].kids !== usual.kids));
  const budgetNum = Number(budget.replace(/[$,\s]/g, ""));

  const plan = () =>
    start(async () => {
      setError(null);
      const r = await planUpcomingWeek(thisWeek, {
        cookDays: cooking.map((d) => d.weekday),
        busyDays: cooking.filter((d) => nights[d.weekday] === "busy").map((d) => d.weekday),
        budget: Number.isFinite(budgetNum) && budgetNum >= 10 ? budgetNum : null,
        useUp,
        craving,
        tryNew,
        desserts,
        eating: changedTables.map((d) => ({ weekday: d.weekday, ...tables[d.weekday] })),
      });
      if (r?.error) setError(r.error);
      else router.push("/");
    });

  const people = (t: Table) => `${t.adults} adult${t.adults === 1 ? "" : "s"}${t.kids ? `, ${t.kids} kid${t.kids === 1 ? "" : "s"}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5" aria-hidden="true">
        {STEPS.map((s, i) => <div key={s} className={`h-2.5 flex-1 rounded-full ${i <= step ? "bg-terracotta" : "bg-oat"}`} />)}
      </div>
      <section className="card space-y-4 p-5" aria-labelledby="checkin-step">
        <h2 id="checkin-step" className="text-2xl font-semibold">{step + 1}. {STEPS[step]}</h2>

        {step === 0 && (
          <>
            <p className="text-muted">Tap a night to change it.</p>
            <ul className="space-y-2">
              {days.map((d) => (
                <li key={d.date} className="flex items-center gap-2">
                  <span className="w-11 shrink-0 font-bold">{DAY[d.weekday].slice(0, 3)}</span>
                  <div role="radiogroup" aria-label={DAY[d.weekday]} className="grid flex-1 grid-cols-3 gap-1">
                    {NIGHTS.map((n) => {
                      const on = nights[d.weekday] === n.key;
                      return (
                        <button key={n.key} type="button" role="radio" aria-checked={on} title={n.hint} onClick={() => setNights((x) => ({ ...x, [d.weekday]: n.key }))}
                          className={`whitespace-nowrap rounded-full border-2 px-1 py-1 text-sm font-bold ${on ? "border-olive bg-olive text-cream" : "border-line bg-card text-ink hover:border-olive/50"}`}>
                          {n.label}
                        </button>
                      );
                    })}
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted">⚡ Quick: a busy night, so a dinner that&apos;s fast to make. 🍕 Off: eating out or leftovers.</p>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-muted">Usually {people(usual)}. Company coming, or someone away? Change those nights and the groceries follow.</p>
            {cooking.length ? (
              <ul className="space-y-2">
                {cooking.map((d) => {
                  const t = tableFor(d.weekday);
                  const set = (k: keyof Table, v: number) => setTables((x) => ({ ...x, [d.weekday]: { ...t, [k]: Math.max(0, Math.min(30, v)) } }));
                  return (
                    <li key={d.date} className="flex flex-wrap items-center gap-2">
                      <span className="w-24 font-bold">{DAY[d.weekday]}</span>
                      {(["adults", "kids"] as const).map((k) => (
                        <span key={k} className="flex items-center gap-1">
                          <button type="button" className="btn-secondary h-9 min-h-9 w-9 px-0" aria-label={`Fewer ${k} on ${DAY[d.weekday]}`} disabled={t[k] <= 0 || (k === "adults" ? t.adults + t.kids <= 1 : t.adults + t.kids <= 1)} onClick={() => set(k, t[k] - 1)}>−</button>
                          <span className="w-16 text-center text-sm font-bold">{t[k]} {k}</span>
                          <button type="button" className="btn-secondary h-9 min-h-9 w-9 px-0" aria-label={`More ${k} on ${DAY[d.weekday]}`} onClick={() => set(k, t[k] + 1)}>+</button>
                        </span>
                      ))}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p>No cooking nights this week.</p>
            )}
            <div className="rounded-2xl bg-olive-soft/70 p-3 text-sm">
              <b>💪 Anyone training this week?</b>{" "}
              {athletes ? `${athletes} ${athletes === 1 ? "person is" : "people are"} in athlete mode: their portions and protein are already planned in.` : "Athlete mode sizes portions, protein and snacks for whoever's training."}{" "}
              <Link href="/athletes" className="font-bold text-olive-dark underline">{athletes ? "Change athlete mode" : "Set up athlete mode"}</Link>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label htmlFor="ci-budget" className="label">Budget for this week</label>
              <div className="relative w-40">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">$</span>
                <input id="ci-budget" inputMode="decimal" className="field pl-7" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
            </div>
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
              </span>
            </label>
          </>
        )}

        {step === 3 && (
          <ul className="space-y-1.5">
            <li>🍲 <b>{cooking.length} dinner{cooking.length === 1 ? "" : "s"}</b>{cooking.some((d) => nights[d.weekday] === "busy") ? `, quick ones on ${cooking.filter((d) => nights[d.weekday] === "busy").map((d) => DAY[d.weekday].slice(0, 3)).join(", ")}` : ""}</li>
            {days.some((d) => nights[d.weekday] === "out") && <li>🍕 Nights off: {days.filter((d) => nights[d.weekday] === "out").map((d) => DAY[d.weekday].slice(0, 3)).join(", ")}</li>}
            {changedTables.map((d) => <li key={d.date}>👥 {DAY[d.weekday]}: {people(tables[d.weekday])}</li>)}
            <li>💵 Budget: ${Number.isFinite(budgetNum) && budgetNum >= 10 ? budgetNum : defaults.budget}</li>
            {useUp.trim() && <li>🥫 Use up: {useUp.trim()}</li>}
            {craving.trim() && <li>😋 In the mood for: {craving.trim()}</li>}
            <li>✨ {tryNew ? "Something new from your food creators" : "Just your own recipes"}</li>
            {desserts > 0 && <li>🍰 Dessert {desserts} night{desserts === 1 ? "" : "s"}</li>}
          </ul>
        )}

        {error && <p role="alert" className="font-bold text-terracotta-dark">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <button type="button" className="btn-quiet" disabled={step === 0 || pending} onClick={() => setStep((s) => s - 1)}>← Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" className="btn-warm px-7" disabled={step === 0 && !cooking.length} onClick={() => setStep((s) => s + 1)}>Next →</button>
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
