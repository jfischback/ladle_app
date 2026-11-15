"use client";

import { useState, useTransition } from "react";
import { lookupStores, saveSettings } from "@/app/actions/settings";
import { DAY_NAMES, MOTIVATIONS, type Motivation, type Settings } from "@/lib/settings";
import type { StoreLocation } from "@/lib/kroger";


export function SetupWizard({ initial, isEdit, krogerEnabled }: { initial: Settings; isEdit: boolean; krogerEnabled: boolean }) {
  const [s, setS] = useState<Settings>(initial);
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS((prev) => ({ ...prev, [k]: v }));
  const last = isEdit ? 5 : 6;

  function finish(startWith?: "ours" | "own") {
    setError(null);
    startTransition(async () => {
      try {
        await saveSettings(s, startWith);
      } catch (e) {
        // redirect() throws a special error that Next handles; anything else is a real problem.
        if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
        setError("Something didn't save. Check your answers and try again.");
      }
    });
  }

  const canNext =
    (step !== 0 || s.motivation.length > 0) &&
    (step !== 3 || s.weeklyBudget >= 10) &&
    (step !== 2 || s.storeName.trim().length > 0 || !!s.storeLocationId);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          {isEdit ? "Settings" : "Setup"} · {Math.min(step + 1, last + 1)} of {last + 1}
        </p>
        <div className="mt-2 h-2 rounded-full bg-oat" aria-hidden="true">
          <div className="h-2 rounded-full bg-olive transition-all" style={{ width: `${((step + 1) / (last + 1)) * 100}%` }} />
        </div>
      </div>

      <section className="card p-6" aria-labelledby="q-title">
        <h1 id="q-title" className="mb-1 text-2xl font-bold">{QUESTION[step]}</h1>
        <p className="mb-6 text-muted">{HINT[step]}</p>

        {step === 0 && <MotivationStep value={s.motivation} onChange={(v) => set("motivation", v)} />}

        {step === 1 && (
          <div className="space-y-5">
            <Counter label="Adults" value={s.adults} min={1} max={12} onChange={(v) => set("adults", v)} />
            <Counter label="Kids" value={s.kids} min={0} max={12} onChange={(v) => set("kids", v)} />
            <YesNo label="Is there a baby at home?" value={s.hasBaby} onChange={(v) => { set("hasBaby", v); if (!v) set("babyAgeMonths", null); else if (s.babyAgeMonths == null) set("babyAgeMonths", 6); }} />
            {s.hasBaby && (
              <div>
                <label htmlFor="babyAge" className="label">Baby&apos;s age</label>
                <select id="babyAge" className="field" value={s.babyAgeMonths ?? 6} onChange={(e) => set("babyAgeMonths", Number(e.target.value))}>
                  {Array.from({ length: 37 }, (_, m) => (
                    <option key={m} value={m}>{m} {m === 1 ? "month" : "months"}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {step === 2 && <StoreStep s={s} set={set} krogerEnabled={krogerEnabled} />}

        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label htmlFor="budget" className="label">Weekly grocery budget</label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-semibold text-muted">$</span>
                <input id="budget" type="number" inputMode="numeric" min={10} step={5} className="field text-2xl" value={s.weeklyBudget || ""} onChange={(e) => set("weeklyBudget", Number(e.target.value))} />
              </div>
            </div>
            <Choice
              label="How strict?"
              value={s.budgetMode}
              onChange={(v) => set("budgetMode", v)}
              options={[
                { value: "target", label: "Target", hint: "Aim for it. Going over a little is fine for a good week." },
                { value: "hard", label: "Hard limit", hint: "Never go over, even if it drops a good dinner." },
              ]}
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <Counter label="Dinners cooked per week" value={s.dinnersPerWeek} min={1} max={7} onChange={(v) => set("dinnersPerWeek", v)} />
            <Counter label="Weeks before a dinner can repeat" value={s.noRepeatWeeks} min={0} max={12} onChange={(v) => set("noRepeatWeeks", v)} />
            <YesNo label="Favor quick meals on weeknights?" value={s.favorQuickWeeknights} onChange={(v) => set("favorQuickWeeknights", v)} />
            <p className="text-sm text-muted">Breakfast and lunch aren&apos;t planned yet, just dinners.</p>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <div>
              <label htmlFor="sale" className="label">What counts as a sale?</label>
              <div className="flex items-center gap-2">
                <input id="sale" type="number" inputMode="numeric" min={1} max={90} className="field w-28 text-2xl" value={s.saleThresholdPct || ""} onChange={(e) => set("saleThresholdPct", Number(e.target.value))} />
                <span className="text-lg">% off or more</span>
              </div>
              <p className="mt-1 text-sm text-muted">Most real grocery sales are 25 to 40% off. 20% is a good starting point.</p>
            </div>
            <YesNo label="Prefer premium brands when they're on sale?" value={s.preferPremiumOnSale} onChange={(v) => set("preferPremiumOnSale", v)} />
          </div>
        )}

        {step === 6 && !isEdit && (
          <div className="grid gap-3">
            <button className="btn-primary min-h-14 text-lg" disabled={pending} onClick={() => finish("ours")}>
              {pending ? "Setting things up…" : "Start with our recipes"}
            </button>
            <p className="text-center text-sm text-muted">Adds our 30 family-tested dinners to your list. You can remove any later.</p>
            <button className="btn-secondary" disabled={pending} onClick={() => finish("own")}>
              Add my own
            </button>
          </div>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl bg-terracotta-soft px-3 py-2 text-terracotta-dark">{error}</p>}
      </section>

      <div className="mt-4 flex justify-between">
        <button className="btn-quiet" onClick={() => setStep((x) => x - 1)} disabled={step === 0 || pending}>
          Back
        </button>
        {step < last && (
          <button className="btn-primary" onClick={() => setStep((x) => x + 1)} disabled={!canNext}>
            Next
          </button>
        )}
        {isEdit && step === last && (
          <button className="btn-primary" onClick={() => finish()} disabled={pending || !canNext}>
            {pending ? "Saving…" : "Save settings"}
          </button>
        )}
      </div>
    </div>
  );
}

const QUESTION = [
  "What matters most to you?",
  "Who's eating?",
  "Where do you shop?",
  "What's your weekly budget?",
  "How do you cook?",
  "How do you buy?",
  "Last step: your recipes",
];
const HINT = [
  "Tap them in order, most important first. This changes how we pick dinners.",
  "We use this for portions and baby-safe choices.",
  "We plan around what's on sale at your Fry's.",
  "We keep the week's dinners near this number.",
  "We plan dinners only, for now.",
  "Two quick rules for picking products.",
  "Most families start with ours and add favorites over time.",
];

function MotivationStep({ value, onChange }: { value: Motivation[]; onChange: (v: Motivation[]) => void }) {
  const toggle = (m: Motivation) => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m]);
  return (
    <div className="grid gap-3">
      {(Object.keys(MOTIVATIONS) as Motivation[]).map((m) => {
        const rank = value.indexOf(m);
        return (
          <button
            key={m}
            type="button"
            aria-pressed={rank >= 0}
            onClick={() => toggle(m)}
            className={`flex min-h-14 items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-semibold ${rank >= 0 ? "border-olive bg-olive-soft" : "border-line bg-card hover:border-olive"}`}
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-base ${rank >= 0 ? "bg-olive text-cream" : "bg-oat text-muted"}`}>
              {rank >= 0 ? rank + 1 : ""}
            </span>
            {MOTIVATIONS[m]}
          </button>
        );
      })}
    </div>
  );
}

function StoreStep({ s, set, krogerEnabled }: { s: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void; krogerEnabled: boolean }) {
  const [stores, setStores] = useState<StoreLocation[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const find = () =>
    start(async () => {
      setMsg(null);
      const res = await lookupStores(s.zip);
      if (res.error) setMsg(res.error);
      else if (res.stores) {
        setStores(res.stores);
        if (!res.stores.length) setMsg("No Fry's stores found near that zip.");
      }
    });
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="zip" className="label">Zip code</label>
        <div className="flex gap-2">
          <input id="zip" inputMode="numeric" autoComplete="postal-code" maxLength={5} className="field" value={s.zip} onChange={(e) => set("zip", e.target.value.replace(/\D/g, ""))} />
          {krogerEnabled && (
            <button type="button" className="btn-secondary shrink-0" onClick={find} disabled={pending || s.zip.length !== 5}>
              {pending ? "Looking…" : "Find my Fry's"}
            </button>
          )}
        </div>
        {msg && <p className="mt-1 text-sm text-terracotta-dark">{msg}</p>}
      </div>
      {krogerEnabled && stores && stores.length > 0 ? (
        <fieldset>
          <legend className="label">Pick your store</legend>
          <div className="grid gap-2">
            {stores.map((st) => (
              <label key={st.locationId} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${s.storeLocationId === st.locationId ? "border-olive bg-olive-soft" : "border-line"}`}>
                <input type="radio" name="store" className="mt-1 accent-olive" checked={s.storeLocationId === st.locationId} onChange={() => { set("storeLocationId", st.locationId); set("storeName", `${st.name} · ${st.address}`); }} />
                <span><span className="font-semibold">{st.name}</span><br /><span className="text-sm text-muted">{st.address}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div>
          <label htmlFor="storeName" className="label">Your Fry&apos;s</label>
          <input id="storeName" className="field" placeholder="e.g. Fry's on Camelback & 44th" value={s.storeName} onChange={(e) => { set("storeName", e.target.value); set("storeLocationId", null); }} />
          {!krogerEnabled && <p className="mt-1 text-sm text-muted">Store search turns on once Fry&apos;s is connected.</p>}
        </div>
      )}
      <Choice
        label="Pickup or delivery?"
        value={s.fulfillment}
        onChange={(v) => set("fulfillment", v)}
        options={[
          { value: "pickup", label: "Curbside pickup" },
          { value: "delivery", label: "Delivery" },
        ]}
      />
      <div>
        <label htmlFor="shopDay" className="label">Shopping day</label>
        <select id="shopDay" className="field" value={s.shoppingDay} onChange={(e) => set("shoppingDay", Number(e.target.value))}>
          {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
      </div>
    </div>
  );
}

function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-lg font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label.toLowerCase()}`} className="btn-secondary h-11 w-11 p-0 text-2xl" disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <span className="w-8 text-center text-2xl font-bold" aria-live="polite">{value}</span>
        <button type="button" aria-label={`More ${label.toLowerCase()}`} className="btn-secondary h-11 w-11 p-0 text-2xl" disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
      </div>
    </div>
  );
}

function YesNo({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-3">
      <legend className="sr-only">{label}</legend>
      <span className="text-lg font-semibold" aria-hidden="true">{label}</span>
      <div className="flex gap-2">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`btn min-w-20 border-2 ${value === v ? "border-olive bg-olive text-cream" : "border-line bg-card text-ink"}`}>
            {v ? "Yes" : "No"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: { value: T; label: string; hint?: string }[] }) {
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="grid gap-2">
        {options.map((o) => (
          <label key={o.value} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${value === o.value ? "border-olive bg-olive-soft" : "border-line bg-card"}`}>
            <input type="radio" className="mt-1 accent-olive" checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>
              <span className="font-semibold">{o.label}</span>
              {o.hint && <><br /><span className="text-sm text-muted">{o.hint}</span></>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
