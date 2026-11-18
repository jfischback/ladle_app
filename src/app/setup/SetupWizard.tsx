"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { GoalCard } from "@/components/GoalCard";
import { lookupStores, markSectionSeen, saveSettings } from "@/app/actions/settings";
import { addRecipePack } from "@/app/actions/recipes";
import { SAFE_FOOD_IDEAS, WONT_EAT_IDEAS, type PickyEater } from "@/lib/picky";
import { EQUIPMENT } from "@/lib/prep";
import { DAY_NAMES, MOTIVATIONS, type Motivation, type Settings } from "@/lib/settings";
import { FOOD_RULES, FOOD_RULE_GROUPS, parseDislikes, type FoodRule } from "@/lib/diet";
import type { StoreLocation } from "@/lib/kroger";


// First time through, only the essentials (who's eating, food rules, store, budget), then the recipe box.
// Everything else starts on sensible defaults and is on the "Getting started" list on Home.
const FIRST_TIME = [1, 8, 2, 3, 4, 7];
const ALL_SECTIONS = [0, 1, 8, 2, 3, 5, 6, 4]; // Budget last: the money questions come at the end

export function SetupWizard({ initial, isEdit, krogerEnabled, startStep = null, forName = null }: { initial: Settings; isEdit: boolean; krogerEnabled: boolean; startStep?: number | null; forName?: string | null }) {
  const [s, setS] = useState<Settings>(initial);
  const order = isEdit ? ALL_SECTIONS : FIRST_TIME;
  const [step, setStep] = useState(startStep != null && order.includes(startStep) ? startStep : order[0]);
  const pos = order.indexOf(step);
  const go = (d: number) => setStep(order[Math.min(order.length - 1, Math.max(0, pos + d))]);
  // Getting started: opening the cooking section in Settings ticks it off.
  useEffect(() => {
    if (isEdit && step === 5) markSectionSeen("cooking").catch(() => {});
  }, [isEdit, step]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setSaved(false); setS((prev) => ({ ...prev, [k]: v })); };

  function finish(startWith?: "ours" | "own") {
    setError(null);
    startTransition(async () => {
      try {
        await saveSettings(s, startWith, isEdit);
        if (isEdit) setSaved(true);
      } catch (e) {
        // redirect() throws a special error that Next handles; anything else is a real problem.
        if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
        setError("Something didn't save. Check your answers and try again.");
      }
    });
  }

  // Everything that must be filled in before Settings can be saved, with a plain reason when it isn't.
  const invalidReason =
    !s.motivation.length ? "Pick at least one priority under Priorities."
    : s.weeklyBudget < 10 ? "Set a weekly budget of at least $10 under Budget."
    : !s.storeName.trim() && !s.storeLocationId ? "Pick or type your store under Store."
    : !s.cookDays.length ? "Pick at least one night under Cooking."
    : null;
  const allValid = !invalidReason;

  const canNext =
    (step !== 0 || s.motivation.length > 0) &&
    (step !== 4 || s.weeklyBudget >= 10) &&
    (step !== 3 || s.storeName.trim().length > 0 || !!s.storeLocationId) &&
    (step !== 5 || s.cookDays.length > 0);

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6">
        {(!isEdit || forName) && <p className="eyebrow">
          {forName ? (isEdit ? `Settings for ${forName}` : `Setting up for ${forName}`) : isEdit ? "Settings" : pos === 0 ? "Welcome to Ladle!" : "Getting to know you"}{isEdit ? "" : ` · ${pos + 1} of ${order.length}`}
        </p>}
        {isEdit ? (
          // Settings isn't a march through steps: pick a section, change it, save.
          <h1 className="text-4xl font-semibold">Settings</h1>
        ) : (
          <div className="mt-2 flex gap-1.5" aria-hidden="true">
            {order.map((_, i) => (
              <div key={i} className={`h-2.5 flex-1 rounded-full transition-colors ${i <= pos ? "bg-terracotta" : "bg-oat"}`} />
            ))}
          </div>
        )}
        {isEdit && (
          // In Settings, jump straight to any question.
          <nav aria-label="Settings sections" className="mt-3 flex flex-wrap gap-1.5">
            {ALL_SECTIONS.map((i) => (
              <button key={i} type="button" aria-current={i === step ? "step" : undefined} onClick={() => setStep(i)} className={`rounded-full px-3 py-1 text-sm font-bold transition-colors ${i === step ? "bg-terracotta text-cream" : "bg-oat text-olive-dark hover:bg-olive-soft"}`}>
                <span aria-hidden="true">{ICON[i]}</span> {SHORT[i]}
              </button>
            ))}
            <a href="/staples" className="rounded-full bg-oat px-3 py-1 text-sm font-bold text-olive-dark hover:bg-olive-soft"><span aria-hidden="true">🧺</span> Staples</a>
            <a href="/pantry" className="rounded-full bg-oat px-3 py-1 text-sm font-bold text-olive-dark hover:bg-olive-soft"><span aria-hidden="true">🥫</span> Pantry</a>
            <a href="/extras" className="rounded-full bg-oat px-3 py-1 text-sm font-bold text-olive-dark hover:bg-olive-soft"><span aria-hidden="true">🍿</span> Snacks &amp; more</a>
            <a href="/athletes" className="rounded-full bg-oat px-3 py-1 text-sm font-bold text-olive-dark hover:bg-olive-soft"><span aria-hidden="true">💪</span> Athletes</a>
            <a href="/health" className="rounded-full bg-oat px-3 py-1 text-sm font-bold text-olive-dark hover:bg-olive-soft"><span aria-hidden="true">🩺</span> Health needs</a>
            <a href="/household" className="rounded-full bg-oat px-3 py-1 text-sm font-bold text-olive-dark hover:bg-olive-soft"><span aria-hidden="true">🏡</span> Household</a>
          </nav>
        )}
      </div>

      <section key={step} className="card animate-pop p-6" aria-labelledby="q-title">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-terracotta-soft text-4xl" aria-hidden="true">{ICON[step]}</div>
        {isEdit ? <h2 id="q-title" className="mb-1 text-3xl font-semibold">{QUESTION[step]}</h2> : <h1 id="q-title" className="mb-1 text-3xl font-semibold">{QUESTION[step]}</h1>}
        <p className="mb-6 text-lg text-muted">{HINT[step]}</p>

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
            <PickySection s={s} set={set} />
            <div className="space-y-3">
              <GoalCard icon="💪" title="Anyone training?" text="Bigger portions, more protein and the right snacks for whoever's working out."
                href={isEdit ? "/athletes" : undefined} button="Set up athlete mode" note="On Home after setup" />
              <GoalCard icon="🩺" tone="ochre" title="Diabetes or watching salt?" text="Dinners steered around carbs or sodium, with tips on which side to cut."
                href={isEdit ? "/health" : undefined} button="Add health needs" note="On Home after setup" />
            </div>
          </div>
        )}

        {step === 8 && <LunchSection s={s} set={set} />}

        {step === 2 && <FoodRulesStep rules={s.foodRules} dislikes={s.dislikes} allow={s.allowAnyway ?? []} onRules={(v) => set("foodRules", v)} onDislikes={(v) => set("dislikes", v)} onAllow={(v) => set("allowAnyway", v)} />}

        {step === 3 && <StoreStep s={s} set={set} krogerEnabled={krogerEnabled} />}

        {step === 4 && (
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
                { value: "hard", label: "Hard limit", hint: "Ladle's estimate stays under it, even if that drops a good dinner. Store prices can still change at checkout." },
              ]}
            />
            <TightBudget s={s} set={set} />
          </div>
        )}

        {step === 5 && (
          <div className="space-y-5">
            <DayPicker value={s.cookDays} onChange={(v) => { set("cookDays", v); set("dinnersPerWeek", v.length); set("busyDays", (s.busyDays ?? []).filter((d) => v.includes(d))); }} />
            <PrepSection s={s} set={set} />
            <BusyPicker cookDays={s.cookDays} value={s.busyDays ?? []} minutes={s.busyMaxMinutes ?? 30} onChange={(v) => set("busyDays", v)} onMinutes={(m) => set("busyMaxMinutes", m)} />
            <div>
              <Counter label="Same main protein, at most" value={s.maxSameProtein ?? 2} min={1} max={4} onChange={(v) => set("maxSameProtein", v)} />
              <p className="mt-1 text-sm text-muted">Nights a week with the same main protein (chicken, beef…). It&apos;s never two nights in a row either.</p>
            </div>
            <BreakfastSection s={s} set={set} />
            <Counter label="Weeks before a dinner can repeat" value={s.noRepeatWeeks} min={0} max={12} onChange={(v) => set("noRepeatWeeks", v)} />
            <YesNo label="Favor quick meals on weeknights?" value={s.favorQuickWeeknights} onChange={(v) => set("favorQuickWeeknights", v)} />
            <div>
              <Counter label="New recipes to try each week" value={s.newRecipesPerWeek ?? 1} min={0} max={2} onChange={(v) => set("newRecipesPerWeek", v)} />
              <p className="mt-1 text-sm text-muted">From the cooks you follow, picked when their ingredients are on sale. 0 sticks to your saved recipes.</p>
            </div>
            <div>
              <Counter label="Dessert nights a week" value={s.dessertNights ?? 0} min={0} max={3} onChange={(v) => set("dessertNights", v)} />
              <p className="mt-1 text-sm text-muted">A dessert after dinner, weekends first, with sale ingredients when there are some. 0 for none.</p>
            </div>
          </div>
        )}

        {step === 6 && (
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

        {step === 7 && !isEdit && (
          <div className="grid gap-3">
            <button className="btn-warm min-h-14 text-lg" disabled={pending} onClick={() => finish("ours")}>
              {pending ? "Setting things up…" : "Start with our recipes"}
            </button>
            <p className="text-center text-sm text-muted">Adds our family-tested recipes that fit your family&apos;s food rules, kitchen and size. You can add recipe packs or remove any later.</p>
            <p className="text-center text-sm text-muted">The rest (cooking nights, food creators, athlete mode and more) is on your Getting started list on Home, whenever you&apos;re ready.</p>
            <button className="btn-secondary" disabled={pending} onClick={() => finish("own")}>
              Add my own
            </button>
          </div>
        )}

        {error && <p role="alert" className="mt-4 rounded-xl bg-terracotta-soft px-3 py-2 text-terracotta-dark">{error}</p>}
      </section>

      {isEdit ? (
        // Settings: save from any section, not just the last one.
        <div className="sticky bottom-24 z-20 mt-4 sm:bottom-4">
          <div className="flex items-center justify-between gap-2 rounded-[2rem] bg-card/95 p-2 shadow-lift ring-1 ring-line/60 backdrop-blur">
            <button className="btn-quiet whitespace-nowrap px-3 text-sm" onClick={() => go(-1)} disabled={pos === 0 || pending}>← Back</button>
            {pos < order.length - 1 && <button className="btn-secondary whitespace-nowrap px-3 text-sm" onClick={() => go(1)} disabled={pending}>Next →</button>}
            <button className="btn-warm flex-1 whitespace-nowrap px-4 sm:flex-none" onClick={() => finish()} disabled={pending || !allValid}>
              {pending ? "Saving…" : saved ? "✓ Saved" : "Save changes"}
            </button>
          </div>
          {saved && <p role="status" className="mt-2 rounded-2xl bg-olive-soft p-3 text-center font-bold text-olive-dark">Saved. Your next plan uses these. <Link href="/" className="underline">Back to this week</Link></p>}
          {!allValid && <p className="mt-2 text-center text-sm text-terracotta-dark">{invalidReason}</p>}
        </div>
      ) : (
        <div className="mt-4 flex justify-between">
          <button className={`btn-quiet ${pos === 0 ? "invisible" : ""}`} onClick={() => go(-1)} disabled={pos === 0 || pending}>
            ← Back
          </button>
          {pos < order.length - 1 && (
            <button className="btn-warm px-7" onClick={() => go(1)} disabled={!canNext}>
              Next →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const QUESTION = [
  "What matters most to you?",
  "Who's eating?",
  "Any food rules?",
  "Where do you shop?",
  "What's your weekly budget?",
  "How do you cook?",
  "How do you buy?",
  "Last step: your recipe box",
  "Lunch at home on weekdays?",
];
const ICON = ["💛", "👨‍👩‍👧", "🥗", "🛒", "💰", "🍳", "🏷️", "📖", "🥪"];
const SHORT = ["Priorities", "Family", "Food rules", "Store", "Budget", "Cooking", "Buying", "Recipes", "Lunch"];
const MOTIVATION_ICON: Record<Motivation, string> = { save_money: "💰", eat_healthier: "🥦", try_new: "✨" };
const HINT = [
  "Tap them in order, most important first. This changes how we pick dinners.",
  "We use this for portions and baby-safe choices.",
  "Allergies, diets, or foods your family won't eat. Ladle skips recipes whose ingredients break these. For allergies, still check every label yourself.",
  "We plan around what's on sale at your store: Kroger, Fry's, Ralphs, King Soopers, Smith's, Fred Meyer, Harris Teeter and other Kroger stores.",
  "We keep the estimate for dinners, staples and snacks near this number.",
  "Pick the nights you want dinner planned. The others are nights off.",
  "Two quick rules for picking products.",
  "Most families start with ours and add favorites over time.",
  "We'll plan last night's leftovers first, and a quick lunch when there aren't any.",
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
            className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-bold transition-all active:scale-[0.98] ${rank >= 0 ? "border-terracotta bg-blush" : "border-line bg-card hover:border-terracotta/60"}`}
          >
            <span className={`flex h-8 w-8 items-center justify-center rounded-full text-base ${rank >= 0 ? "bg-terracotta text-cream" : "bg-oat text-muted"}`}>
              {rank >= 0 ? rank + 1 : ""}
            </span>
            <span aria-hidden="true">{MOTIVATION_ICON[m]}</span>
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
        if (!res.stores.length) setMsg("No Kroger-family stores found near that zip. You can still type your store below.");
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
              {pending ? "Looking…" : "Find my store"}
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
              <label key={st.locationId} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${s.storeLocationId === st.locationId ? "border-terracotta bg-blush" : "border-line bg-card"}`}>
                <input type="radio" name="store" className="mt-1 accent-terracotta" checked={s.storeLocationId === st.locationId} onChange={() => { set("storeLocationId", st.locationId); set("storeName", `${st.name} · ${st.address}`); }} />
                <span><span className="font-semibold">{st.name}</span><br /><span className="text-sm text-muted">{st.address}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : (
        <div>
          <label htmlFor="storeName" className="label">Your store</label>
          <input id="storeName" className="field" placeholder="e.g. Kroger on Main St" value={s.storeName} onChange={(e) => { set("storeName", e.target.value); set("storeLocationId", null); }} />
          {!krogerEnabled && <p className="mt-1 text-sm text-muted">Just type the one you usually go to.</p>}
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

/** Meal prep day and kitchen equipment. */
function PrepSection({ s, set }: { s: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const have = s.equipment ?? [];
  const toggle = (k: (typeof EQUIPMENT)[number]["key"]) => set("equipment", have.includes(k) ? have.filter((x) => x !== k) : [...have, k]);
  return (
    <section className="space-y-4 rounded-3xl border-2 border-line p-4">
      <div>
        <h3 className="text-lg font-semibold">🥡 Meal prep day</h3>
        <p className="text-sm text-muted">Pick a day to get ahead: we&apos;ll make a checklist (cook the rice, chop everything, brown the meat, make a casserole) so weeknights just need finishing.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[null, 0, 1, 2, 3, 4, 5, 6].map((d) => {
            const on = (s.prepDay ?? null) === d;
            return (
              <button key={String(d)} type="button" aria-pressed={on} onClick={() => set("prepDay", d)}
                className={`rounded-full border-2 px-3 py-1 text-sm font-bold ${on ? "border-olive bg-olive text-cream" : "border-line bg-card text-ink"}`}>
                {d == null ? "No prep day" : DAY_NAMES[d].slice(0, 3)}
              </button>
            );
          })}
        </div>
        {s.prepDay != null && (
          <div className="mt-3"><Counter label="Prep time (minutes)" value={s.prepMinutes ?? 120} min={30} max={300} onChange={(v) => set("prepMinutes", Math.round(v / 15) * 15 || 30)} /></div>
        )}
      </div>
      <fieldset>
        <legend className="text-lg font-semibold">What&apos;s in your kitchen?</legend>
        <p className="mb-2 text-sm text-muted">Dorm room with just a microwave? We&apos;ll skip dinners you can&apos;t make. Have a slow cooker? Slow-cooker dinners work on busy nights.</p>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT.map((e) => {
            const on = have.includes(e.key);
            return (
              <button key={e.key} type="button" aria-pressed={on} onClick={() => toggle(e.key)}
                className={`flex items-center gap-1 rounded-full border-2 px-3 py-1 text-sm font-bold ${on ? "border-olive bg-olive-soft text-olive-dark" : "border-line bg-card text-muted"}`}>
                <span aria-hidden="true">{on ? "✓" : e.icon}</span> {e.label}
              </button>
            );
          })}
        </div>
        {!have.includes("stovetop") && !have.includes("oven") && have.length > 0 && (
          <p className="mt-2 text-sm"><Link href="/recipes?tab=browse" className="font-bold text-olive-dark underline">Add the microwave-only recipe pack</Link> so there&apos;s plenty to plan.</p>
        )}
      </fieldset>
    </section>
  );
}

/** Picky eaters: their own won't-eat list and safe foods. Not food rules: dinners can still have these, with tips. */
function PickySection({ s, set }: { s: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const list = s.pickyEaters ?? [];
  const update = (id: string, patch: Partial<PickyEater>) => set("pickyEaters", list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const add = () => set("pickyEaters", [...list, { id: Math.random().toString(36).slice(2, 10), name: "", wontEat: [], safeFoods: [] }]);
  return (
    <section className="space-y-3 rounded-3xl border-2 border-line p-4">
      <div>
        <h3 className="text-lg font-semibold">🧒 Picky eaters</h3>
        <p className="text-sm text-muted">Not allergies, just &ldquo;won&apos;t touch it.&rdquo; We still plan family dinners, with tips like &ldquo;set aside a plain portion for Ava before the sauce,&rdquo; and we learn which dinners they actually eat.</p>
      </div>
      {list.map((p) => (
        <div key={p.id} className="space-y-3 rounded-2xl bg-cream/70 p-3">
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1">
              <span className="label">Name</span>
              <input className="field" maxLength={40} value={p.name} placeholder="e.g. Ava" onChange={(e) => update(p.id, { name: e.target.value })} />
            </label>
            <button type="button" className="btn-quiet min-h-11 px-3 text-sm" onClick={() => set("pickyEaters", list.filter((x) => x.id !== p.id))}>Remove</button>
          </div>
          <ChipPicker label="Won't eat" ideas={WONT_EAT_IDEAS} value={p.wontEat} onChange={(v) => update(p.id, { wontEat: v })} tone="warm" />
          <ChipPicker label="Always eats (safe foods)" ideas={SAFE_FOOD_IDEAS} value={p.safeFoods} onChange={(v) => update(p.id, { safeFoods: v })} tone="olive" />
        </div>
      ))}
      <button type="button" className="btn-secondary min-h-10 px-4 text-sm" onClick={add}>+ Add a picky eater</button>
    </section>
  );
}

function ChipPicker({ label, ideas, value, onChange, tone }: { label: string; ideas: string[]; value: string[]; onChange: (v: string[]) => void; tone: "warm" | "olive" }) {
  const [text, setText] = useState("");
  const all = [...new Set([...ideas, ...value])];
  const on = (w: string) => value.includes(w);
  const toggle = (w: string) => onChange(on(w) ? value.filter((x) => x !== w) : [...value, w]);
  const addTyped = () => { const w = text.trim().toLowerCase(); if (w.length >= 2 && !on(w)) onChange([...value, w]); setText(""); };
  return (
    <fieldset>
      <legend className="label">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {all.map((w) => (
          <button key={w} type="button" aria-pressed={on(w)} onClick={() => toggle(w)}
            className={`rounded-full border-2 px-3 py-1 text-sm font-bold transition-colors ${on(w) ? (tone === "warm" ? "border-terracotta bg-terracotta text-cream" : "border-olive bg-olive text-cream") : "border-line bg-card text-ink"}`}>{w}</button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input className="field min-h-10 py-1" placeholder="Add your own" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTyped(); } }} />
        <button type="button" className="btn-secondary min-h-10 shrink-0 px-3 text-sm" onClick={addTyped}>Add</button>
      </div>
    </fieldset>
  );
}

/** "Every dollar counts": cheapest wins, plus the ways to stretch a tight budget. */
function TightBudget({ s, set }: { s: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const [pending, start] = useTransition();
  const [added, setAdded] = useState<number | null>(null);
  const toggle = (on: boolean) => {
    set("tightBudget", on);
    if (on) { set("budgetMode", "hard"); set("preferPremiumOnSale", false); set("cookOnceEatTwice", true); }
  };
  return (
    <div className={`space-y-4 rounded-3xl border-2 p-4 ${s.tightBudget ? "border-olive bg-olive-soft/60" : "border-line"}`}>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-6 w-6 accent-olive" checked={s.tightBudget} onChange={(e) => toggle(e.target.checked)} />
        <span>
          <span className="block text-lg font-bold">💵 Cost Cutting: every dollar counts</span>
          <span className="text-muted">For a fixed income, a student budget or a lean month. The cheapest dinners and the lowest price per ounce win every time; brands don&apos;t matter, and optional snacks drop off first if the week runs over.</span>
        </span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-olive" checked={s.cookOnceEatTwice} onChange={(e) => set("cookOnceEatTwice", e.target.checked)} />
        <span><b>Cook once, eat twice</b> <span className="text-muted">A double batch, then leftovers the next planned night. Half the cooking, less to buy, nothing wasted.</span></span>
      </label>
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 accent-olive" checked={s.snap} onChange={(e) => set("snap", e.target.checked)} />
        <span><b>I pay with SNAP / EBT</b> <span className="text-muted">We&apos;ll remind you how to pay with EBT on pickup orders.</span></span>
      </label>
      {s.tightBudget && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-3">
          <span className="min-w-0 flex-1 text-sm"><b>Budget recipe pack:</b> 20 filling dinners for about $1 to $2.50 a plate (rice and beans, sheet-pan chicken, potato soup…).</span>
          <button type="button" className="btn-secondary min-h-9 px-3 text-sm" disabled={pending} onClick={() => start(async () => setAdded((await addRecipePack("budget")).added))}>
            {added == null ? "Add them" : added ? `✓ Added ${added}` : "✓ Already added"}
          </button>
        </div>
      )}
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
          <button key={String(v)} type="button" aria-pressed={value === v} onClick={() => onChange(v)} className={`btn min-w-20 border-2 ${value === v ? "border-terracotta bg-terracotta text-cream" : "border-line bg-card text-ink"}`}>
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
          <label key={o.value} className={`flex cursor-pointer gap-3 rounded-xl border-2 p-3 ${value === o.value ? "border-terracotta bg-blush" : "border-line bg-card"}`}>
            <input type="radio" className="mt-1 accent-terracotta" checked={value === o.value} onChange={() => onChange(o.value)} />
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

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function DayPicker({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  const presets: [string, number[]][] = [["Weeknights", [1, 2, 3, 4]], ["Sun–Thu", [0, 1, 2, 3, 4]], ["Every night", [0, 1, 2, 3, 4, 5, 6]]];
  return (
    <fieldset>
      <legend className="text-lg font-semibold">Which nights should we plan?</legend>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {DAY_SHORT.map((d, i) => {
          const on = value.includes(i);
          return (
            <button key={d} type="button" aria-pressed={on} aria-label={DAY_NAMES[i]} onClick={() => toggle(i)}
              className={`flex h-14 flex-col items-center justify-center rounded-2xl border-2 text-[0.8rem] font-extrabold sm:text-sm transition-all active:scale-95 ${on ? "border-terracotta bg-terracotta text-cream shadow-soft" : "border-line bg-card text-muted hover:border-terracotta/60"}`}>
              {d}
              <span aria-hidden="true" className="text-xs font-bold">{on ? "🍽" : "–"}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {presets.map(([label, days]) => (
          <button key={label} type="button" className="rounded-full bg-oat px-3 py-1 text-sm font-bold text-olive-dark hover:bg-olive-soft" onClick={() => onChange(days)}>{label}</button>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {value.length ? `${value.length} dinner${value.length === 1 ? "" : "s"} a week · nights off: ${DAY_SHORT.filter((_, i) => !value.includes(i)).join(", ") || "none"}` : "Pick at least one night."}
      </p>
    </fieldset>
  );
}

export function FoodRulesStep({ rules, dislikes, allow, onRules, onDislikes, onAllow }: { rules: FoodRule[]; dislikes: string[]; allow: string[]; onRules: (v: FoodRule[]) => void; onDislikes: (v: string[]) => void; onAllow: (v: string[]) => void }) {
  const [text, setText] = useState(dislikes.join(", "));
  const [allowText, setAllowText] = useState(allow.join(", "));
  const toggle = (r: FoodRule) => {
    let next = rules.includes(r) ? rules.filter((x) => x !== r) : [...rules, r];
    // Vegetarian already covers pescatarian.
    if (r === "vegetarian" && next.includes("vegetarian")) next = next.filter((x) => x !== "pescatarian");
    if (r === "pescatarian" && next.includes("pescatarian")) next = next.filter((x) => x !== "vegetarian");
    onRules(next);
  };
  return (
    <div className="space-y-5">
      {FOOD_RULE_GROUPS.map((g) => (
        <fieldset key={g.group}>
          <legend className="label">{g.title}</legend>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(FOOD_RULES) as FoodRule[]).filter((k) => FOOD_RULES[k].group === g.group).map((k) => {
              const on = rules.includes(k);
              return (
                <button key={k} type="button" aria-pressed={on} onClick={() => toggle(k)}
                  className={`flex min-h-11 items-center gap-1.5 rounded-full border-2 px-3.5 font-bold transition-all active:scale-95 ${on ? "border-terracotta bg-blush text-terracotta-dark" : "border-line bg-card text-ink hover:border-terracotta/60"}`}>
                  <span aria-hidden="true">{on ? "✓" : FOOD_RULES[k].icon}</span> {FOOD_RULES[k].label}
                </button>
              );
            })}
          </div>
          {g.group === "texture" && <p className="mt-1 text-sm text-muted">Leaves out bone-in chicken, ribs, wings, drumsticks and whole fish.</p>}
        </fieldset>
      ))}
      <div>
        <label htmlFor="dislikes" className="label">Foods your family won&apos;t eat</label>
        <input id="dislikes" className="field" placeholder="e.g. mushrooms, olives, cilantro" value={text}
          onChange={(e) => { setText(e.target.value); onDislikes(parseDislikes(e.target.value)); }} />
        <p className="mt-1 text-sm text-muted">Separate with commas. Dinners with these are skipped too.</p>
      </div>
      {rules.some((r) => FOOD_RULES[r].group !== "allergy") && (
        <div>
          <label htmlFor="allowAnyway" className="label">Allowed anyway</label>
          <input id="allowAnyway" className="field" placeholder="e.g. sushi" value={allowText}
            onChange={(e) => { setAllowText(e.target.value); onAllow(e.target.value.split(",").map((w) => w.trim()).filter((w) => w.length >= 2)); }} />
          <p className="mt-1 text-sm text-muted">Dishes that are fine even though they break a diet rule above, like store-bought sushi with No seafood. Allergies always apply.</p>
        </div>
      )}
      {rules.length === 0 && dislikes.length === 0 && <p className="text-sm text-muted">No rules? That&apos;s fine, just tap Next.</p>}
    </div>
  );
}

function BusyPicker({ cookDays, value, minutes, onChange, onMinutes }: { cookDays: number[]; value: number[]; minutes: number; onChange: (v: number[]) => void; onMinutes: (m: number) => void }) {
  if (!cookDays.length) return null;
  const toggle = (d: number) => onChange(value.includes(d) ? value.filter((x) => x !== d) : [...value, d].sort());
  return (
    <fieldset>
      <legend className="text-lg font-semibold">Busy nights?</legend>
      <p className="mb-2 text-sm text-muted">Practice, late work, church… We&apos;ll only plan quick dinners on these.</p>
      <div className="flex flex-wrap gap-1.5">
        {cookDays.map((d) => {
          const on = value.includes(d);
          return (
            <button key={d} type="button" aria-pressed={on} aria-label={`Busy: ${DAY_NAMES[d]}`} onClick={() => toggle(d)}
              className={`flex min-h-10 items-center gap-1 rounded-full border-2 px-3 text-sm font-bold transition-all active:scale-95 ${on ? "border-ochre bg-ochre-soft text-ochre-dark" : "border-line bg-card text-ink hover:border-ochre"}`}>
              {on ? "⚡" : ""} {DAY_NAMES[d]}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <label className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
          Quick means
          <select className="field w-auto py-1" value={minutes} onChange={(e) => onMinutes(Number(e.target.value))}>
            {[20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes or less</option>)}
          </select>
        </label>
      )}
    </fieldset>
  );
}

const PROTEIN_CHOICES = ["Chicken", "Beef", "Pork", "Sausage", "Turkey", "Fish", "Seafood"];

function LunchSection({ s, set }: { s: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const days = s.lunchDays ?? [];
  const toggleDay = (d: number) => set("lunchDays", days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());
  const noReheat = s.holidayNoReheat ?? [];
  const hasLittleOnes = s.kids > 0 || s.hasBaby;
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="label">Which weekdays?</legend>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5].map((d) => {
            const on = days.includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} aria-label={`Lunch at home: ${DAY_NAMES[d]}`} onClick={() => toggleDay(d)}
                className={`min-h-10 rounded-full border-2 px-3 text-sm font-bold transition-all active:scale-95 ${on ? "border-terracotta bg-blush text-terracotta-dark" : "border-line bg-card text-ink hover:border-terracotta/60"}`}>
                {on ? "🥪 " : ""}{DAY_NAMES[d].slice(0, 3)}
              </button>
            );
          })}
          <button type="button" className="rounded-full bg-oat px-3 text-sm font-bold text-olive-dark hover:bg-olive-soft" onClick={() => set("lunchDays", days.length === 5 ? [] : [1, 2, 3, 4, 5])}>
            {days.length === 5 ? "None" : "Mon–Fri"}
          </button>
        </div>
      </fieldset>
      {days.length > 0 && (
        <div className="space-y-3">
          <Counter label="Adults at lunch" value={s.lunchAdults ?? 1} min={0} max={s.adults} onChange={(v) => set("lunchAdults", v)} />
          {hasLittleOnes && <YesNo label={s.kids > 0 ? "Kids eat lunch at home too?" : "Baby eats lunch at home too?"} value={s.lunchKids ?? true} onChange={(v) => set("lunchKids", v)} />}
        </div>
      )}
      <YesNo label="On federal holidays, is everyone home for lunch?" value={s.holidayEveryoneHome ?? true} onChange={(v) => set("holidayEveryoneHome", v)} />
      {(s.holidayEveryoneHome ?? true) && (
        <fieldset>
          <legend className="text-sm font-semibold">Leftovers someone won&apos;t eat reheated on those days</legend>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {PROTEIN_CHOICES.map((p) => {
              const on = noReheat.includes(p);
              return (
                <button key={p} type="button" aria-pressed={on} onClick={() => set("holidayNoReheat", on ? noReheat.filter((x) => x !== p) : [...noReheat, p])}
                  className={`min-h-9 rounded-full border-2 px-3 text-sm font-bold ${on ? "border-ochre bg-ochre-soft text-ochre-dark" : "border-line bg-card text-ink"}`}>
                  {on ? "✓ " : ""}{p}
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-muted">We won&apos;t plan these the night before a holiday.</p>
        </fieldset>
      )}
    </div>
  );
}

function BreakfastSection({ s, set }: { s: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const days = s.breakfastDays ?? [];
  const toggleDay = (d: number) => set("breakfastDays", days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());
  const [must, setMust] = useState((s.breakfastMustHave ?? []).join(", "));
  const hasLittleOnes = s.kids > 0 || s.hasBaby;
  return (
    <div className="space-y-4 border-t border-line pt-5">
      <fieldset>
        <legend className="text-lg font-semibold">Plan breakfasts too?</legend>
        <p className="mb-2 text-sm text-muted">Quick weekday breakfasts, planned with the week and added to the list.</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3, 4, 5].map((d) => {
            const on = days.includes(d);
            return (
              <button key={d} type="button" aria-pressed={on} aria-label={`Breakfast: ${DAY_NAMES[d]}`} onClick={() => toggleDay(d)}
                className={`min-h-10 rounded-full border-2 px-3 text-sm font-bold transition-all active:scale-95 ${on ? "border-terracotta bg-blush text-terracotta-dark" : "border-line bg-card text-ink hover:border-terracotta/60"}`}>
                {on ? "☕ " : ""}{DAY_NAMES[d].slice(0, 3)}
              </button>
            );
          })}
          <button type="button" className="rounded-full bg-oat px-3 text-sm font-bold text-olive-dark hover:bg-olive-soft" onClick={() => set("breakfastDays", days.length === 5 ? [] : [1, 2, 3, 4, 5])}>
            {days.length === 5 ? "None" : "Mon–Fri"}
          </button>
        </div>
      </fieldset>
      {days.length > 0 && (
        <div className="space-y-4">
          <Counter label="Adults at breakfast" value={s.breakfastAdults ?? 1} min={0} max={s.adults} onChange={(v) => set("breakfastAdults", v)} />
          {hasLittleOnes && <YesNo label={s.kids > 0 ? "Kids too?" : "Baby too?"} value={s.breakfastKids ?? true} onChange={(v) => set("breakfastKids", v)} />}
          <label className="flex flex-wrap items-center justify-between gap-2 text-lg font-semibold">
            Quick means
            <select className="field w-auto py-1 text-base" value={s.breakfastMaxMinutes ?? 15} onChange={(e) => set("breakfastMaxMinutes", Number(e.target.value))}>
              {[10, 15, 20, 30].map((m) => <option key={m} value={m}>{m} minutes or less</option>)}
            </select>
          </label>
          <div>
            <Counter label="Bread-based breakfasts a week" value={Math.min(s.breadBreakfasts ?? 1, days.length)} min={0} max={days.length} onChange={(v) => set("breadBreakfasts", v)} />
            <p className="mt-1 text-sm text-muted">Pancakes, waffles, French toast, bagels. The rest are egg or protein breakfasts.</p>
          </div>
          <div>
            <label htmlFor="mustHave" className="label">Every week, at least one</label>
            <input id="mustHave" className="field" placeholder="e.g. omelet" value={must}
              onChange={(e) => { setMust(e.target.value); set("breakfastMustHave", e.target.value.split(",").map((w) => w.trim()).filter((w) => w.length >= 2)); }} />
          </div>
          <YesNo label="Use the week's best breakfast-meat sale (ham, sausage, bacon)?" value={s.breakfastMeatDeal ?? true} onChange={(v) => set("breakfastMeatDeal", v)} />
        </div>
      )}
    </div>
  );
}
