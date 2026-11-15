"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { approvePlan, moveDinnerTo, planUpcomingWeek, rateCookedDinner, startOver, swapDay } from "./actions/plans";
import { answerPantryCheck } from "./actions/pantry";
import { addGroceryItem, removeGroceryItem, setGroceryChecks } from "./actions/grocery";
import { ADDED_SECTION } from "@/lib/grocery-add";
import { useRouter } from "next/navigation";
import { groceryText } from "@/lib/grocery-text";
import { PANTRY_SECTIONS } from "@/lib/pantry";
import { StarPicker } from "@/components/Stars";
import { FoodArt } from "@/components/FoodArt";
import { Highlight } from "@/components/Highlight";
import type { Plan } from "@/db/schema";
import type { PlanDay } from "@/lib/types";
import { formatMinutes } from "@/lib/format";
import { dayName, money } from "@/lib/week";

type RecipeInfo = { id: string; name: string; protein: string | null; totalMinutes: number | null };

const CELEBRATE_KEY = "ladle-celebrate";
// Reasons the basic planner writes; they add nothing for the person reading.
const FILLER_REASONS = new Set(["Picked from your recipes", "No-cook night", ""]);

function ErrorNote({ error }: { error: string | null }) {
  return error ? <p role="alert" className="rounded-2xl bg-terracotta-soft px-4 py-2 text-terracotta-dark">{error}</p> : null;
}

export function PlanButton({ label, big }: { label: string; big?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <button
        className={big ? "btn-warm min-h-14 px-8 text-lg" : "btn-secondary"}
        disabled={pending}
        onClick={() => start(async () => { setError(null); const r = await planUpcomingWeek(); if (r?.error) setError(r.error); })}
      >
        {pending ? <><span className="animate-wiggle inline-block" aria-hidden="true">🥄</span> Stirring up your week…</> : label}
      </button>
      {pending && <p className="text-sm text-muted">Checking prices and picking dinners. This takes a few seconds.</p>}
      <ErrorNote error={error} />
    </div>
  );
}

export function DayCard({ planId, index, day, isToday, locked, recipes, plates, picky = [], moveTargets = [] }: {
  planId: string; index: number; day: PlanDay; isToday: boolean; locked: boolean; recipes: RecipeInfo[]; plates?: number; picky?: string[];
  moveTargets?: { index: number; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [moving, setMoving] = useState(false);
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
  const recipe = recipes.find((r) => r.id === day.recipeId);
  const reason = day.reason && !FILLER_REASONS.has(day.reason) ? day.reason : null;
  const cookTime = recipe?.totalMinutes ? formatMinutes(recipe.totalMinutes) : null;

  const move = (to: number) =>
    start(async () => {
      setError(null);
      const r = await moveDinnerTo(planId, index, to);
      if (r?.error) setError(r.error);
      else { setOpen(false); setMoving(false); }
    });
  // After shopping, dinners can't be swapped for new ones, but they can trade nights.
  const canMove = moveTargets.length > 0;
  const swapButton = !locked ? (
    <button className="btn-secondary min-h-10 shrink-0 px-3.5 text-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
      {open ? "Close" : "Swap"}
    </button>
  ) : canMove ? (
    <button className="btn-quiet min-h-10 shrink-0 px-3 text-sm" aria-expanded={moving} onClick={() => setMoving((o) => !o)}>
      {moving ? "Close" : "Move"}
    </button>
  ) : null;
  const movePicker = canMove && (
    <div className="space-y-2">
      <p className="font-bold">{day.recipeId ? (day.leftoverOf ? "Have these leftovers on…" : `Make ${day.recipeName} on…`) : `Trade this night off with…`}</p>
      <div className="flex flex-wrap gap-2">
        {moveTargets.map((t) => (
          <button key={t.index} className="btn-secondary min-h-10 px-3 text-sm" disabled={pending} onClick={() => move(t.index)}>{t.label}</button>
        ))}
      </div>
      <p className="text-xs text-muted">The two nights trade dinners. Your grocery list stays the same.</p>
    </div>
  );

  return (
    <div className={`card overflow-hidden transition-opacity ${isToday ? "ring-2 ring-terracotta shadow-lift" : ""} ${pending ? "opacity-60" : ""}`}>
      {!isToday && !day.recipeId && !day.lunch && !day.breakfast && !day.holiday ? (
        // A plain night off is one slim row, so the week's dinners show sooner.
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-lg" aria-hidden="true">🍕</span>
          <p className="min-w-0 flex-1"><span className="font-extrabold text-terracotta">{dayName(day.date)} {Number(day.date.slice(8))}</span> <span className="text-muted">· Night off</span></p>
          {!locked ? (
            <button className="btn-quiet min-h-9 shrink-0 px-3 text-sm" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? "Close" : "Plan a dinner"}
            </button>
          ) : swapButton}
        </div>
      ) : isToday ? (
        // Tonight gets the big hero treatment.
        <div>
          <div className="relative">
            <FoodArt name={day.recipeName} protein={recipe?.protein} className="h-44 w-full sm:h-52" rounded="rounded-none" />
            <span className="absolute left-4 top-4 rounded-full bg-terracotta px-3 py-1 text-sm font-bold text-cream shadow-soft">
              Tonight · {dayName(day.date)}
            </span>
            {day.fromCook && <NewBadge className="absolute right-4 top-4 shadow-soft" label="✨ New recipe" />}
          </div>
          <div className="flex items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              {day.recipeId ? (
                <Link href={`/recipes/${day.recipeId}`} className="font-display text-2xl font-semibold leading-snug hover:underline">{day.recipeName}</Link>
              ) : (
                <p className="font-display text-2xl font-semibold">Night off tonight!</p>
              )}
              <Details cookTime={day.leftoverOf ? null : cookTime} cost={day.recipeId ? day.estimatedCost : null} noCook={!day.recipeId} leftover={!!day.leftoverOf} plates={plates ? plates * (day.batches ?? 1) : undefined} />
            </div>
            {swapButton}
          </div>
          {day.recipeId && !day.leftoverOf && (
            <div className="-mt-2 px-5 pb-4">
              <Link href={`/recipes/${day.recipeId}?cook=1`} className="btn-warm w-full sm:w-auto">👩‍🍳 Start cooking</Link>
            </div>
          )}
          <WhyLine reason={reason} sale={day.saleItems} className="-mt-2 px-5 pb-5" />
          <PickyLines tips={picky} className="-mt-3 px-5 pb-5" />
          <LunchLine day={day} className="-mt-3 px-5 pb-5" />
        </div>
      ) : (
        <div>
        <div className="flex items-center gap-3 p-3 pr-4">
          <FoodArt name={day.recipeName} protein={recipe?.protein} className="h-[4.5rem] w-[4.5rem]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold text-terracotta">
              {dayName(day.date)} {Number(day.date.slice(8))}
              {day.fromCook && <NewBadge className="ml-1.5 align-middle" label="✨ New" />}
            </p>
            {day.recipeId ? (
              <Link href={`/recipes/${day.recipeId}`} className="block font-bold leading-snug hover:underline">{day.recipeName}</Link>
            ) : (
              <p className="font-bold text-olive-dark">Night off</p>
            )}
            <Details cookTime={day.leftoverOf ? null : cookTime} cost={day.recipeId ? day.estimatedCost : null} noCook={!day.recipeId} leftover={!!day.leftoverOf} plates={plates ? plates * (day.batches ?? 1) : undefined} />
          </div>
          {swapButton}
        </div>
        <WhyLine reason={reason} sale={day.saleItems} className="px-3 pb-3" />
        <PickyLines tips={picky} className="px-3 pb-3" />
        <LunchLine day={day} className="px-3 pb-3" />
        </div>
      )}
      {open && !locked && (
        <div className="space-y-3 border-t border-line bg-cream/60 p-4">
          <p className="font-bold">Swap {dayName(day.date)} for…</p>
          {day.alternatives.length > 0 && (
            <ul className="grid gap-2">
              {day.alternatives.map((a) => {
                used.add(a.recipeId);
                return (
                  <li key={a.recipeId}>
                    <button className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-soft ring-2 ring-transparent hover:ring-olive" disabled={pending} onClick={() => swap(a.recipeId)}>
                      <FoodArt name={a.recipeName} className="h-12 w-12" rounded="rounded-xl" />
                      <span className="min-w-0 flex-1">
                        <span className="flex justify-between gap-2 font-bold"><span>{a.recipeName}</span><span>{money(a.estimatedCost)}</span></span>
                        <span className="text-sm text-muted">{a.reason}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <select aria-label="Pick any recipe" className="field flex-1" defaultValue="" disabled={pending} onChange={(e) => e.target.value && swap(e.target.value)}>
              <option value="" disabled>Pick any of your recipes…</option>
              {recipes.filter((r) => r.id !== day.recipeId && !used.has(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            {day.recipeId && <button className="btn-quiet" disabled={pending} onClick={() => swap(null)}>Take the night off 🍕</button>}
          </div>
          {movePicker && <div className="border-t border-line pt-3">{movePicker}</div>}
          <ErrorNote error={error} />
        </div>
      )}
      {moving && locked && (
        <div className="space-y-2 border-t border-line bg-cream/60 p-4">
          {movePicker}
          <ErrorNote error={error} />
        </div>
      )}
    </div>
  );
}

/** Marks a new recipe from a followed cook. */
function NewBadge({ label, className = "" }: { label: string; className?: string }) {
  return <span className={`inline-flex items-center rounded-full bg-ochre-soft px-2 py-0.5 text-xs font-extrabold text-ochre-dark ${className}`}>{label}</span>;
}

/** Picky-eater tips for a dinner: set a plain portion aside, or a safe side. */
function PickyLines({ tips, className = "" }: { tips: string[]; className?: string }) {
  if (!tips.length) return null;
  return (
    <ul className={`space-y-1 ${className}`}>
      {tips.map((t) => {
        // Each tip starts with its icon (🥡 prep, 🩺 health, 🧒 picky eater).
        const [icon, ...rest] = t.split(" ");
        return <li key={t} className="flex gap-2 rounded-2xl bg-blush/70 px-3 py-1.5 text-sm"><span aria-hidden="true">{icon}</span><span>{rest.join(" ")}</span></li>;
      })}
    </ul>
  );
}

const perPlate = (n: number) => "$" + n.toFixed(2);

function Details({ cookTime, cost, noCook, leftover, plates }: { cookTime: string | null; cost: number | null; noCook: boolean; leftover?: boolean; plates?: number }) {
  if (noCook) return <p className="text-sm text-muted">Leftovers or takeout. No judgment.</p>;
  if (leftover) return <p className="mt-0.5 text-sm font-semibold text-olive-dark">♻️ Leftovers night: just reheat · $0</p>;
  if (!cookTime && cost == null) return null;
  return (
    <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm font-semibold text-muted">
      {cookTime && <span>⏱ {cookTime}</span>}
      {cost != null && <span>{money(cost)}{plates && cost > 0 ? ` · ${perPlate(cost / plates)} a plate` : ""}</span>}
    </p>
  );
}

/** Why this dinner, plus its sale tags: full width under the dinner so it's easy to read. */
/** Tomorrow-style lunch for this day: leftovers, a lunch recipe, or an open slot. */
function LunchLine({ day, className = "" }: { day: PlanDay; className?: string }) {
  const l = day.lunch;
  const b = day.breakfast;
  if (!l && !b && !day.holiday) return null;
  return (
    <div className={`space-y-1.5 ${className}`}>
      {day.holiday && <span className="inline-flex rounded-full bg-olive-soft px-2.5 py-0.5 text-xs font-extrabold text-olive-dark">🎉 {day.holiday}</span>}
      {b && (
        <div className="flex items-start gap-2 rounded-2xl border border-line px-3 py-2 text-sm">
          <span aria-hidden="true">☕</span>
          <span className="min-w-0">
            <span className="font-bold">Breakfast: </span>
            {b.recipeId ? <Link href={`/recipes/${b.recipeId}`} className="font-semibold hover:underline">{b.name}</Link> : <span className="font-semibold">{b.name}</span>}
            <span className="text-muted"> · {b.eaters}</span>
            <span className="block text-xs text-muted">{b.withDeal ? <><span className="font-bold text-terracotta-dark">🏷️ with {b.withDeal}</span></> : b.reason}</span>
          </span>
        </div>
      )}
      {l && (
        <div className="flex items-start gap-2 rounded-2xl border border-line px-3 py-2 text-sm">
          <span aria-hidden="true">🥪</span>
          <span className="min-w-0">
            <span className="font-bold">Lunch: </span>
            {l.recipeId ? <Link href={`/recipes/${l.recipeId}`} className="font-semibold hover:underline">{l.name}</Link> : <span className="font-semibold">{l.name}</span>}
            <span className="text-muted"> · {l.eaters}</span>
            <span className="block text-xs text-muted">{l.reason}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function WhyLine({ reason, sale, className = "" }: { reason: string | null; sale: string[]; className?: string }) {
  if (!reason && !sale.length) return null;
  return (
    <div className={className}>
      {reason && (
        <p className="flex items-start gap-2 rounded-2xl bg-blush px-3 py-2 leading-snug text-ink">
          <span aria-hidden="true">💡</span>
          <span><Highlight text={reason} /></span>
        </p>
      )}
      {sale.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">{sale.filter((s, i) => sale.findIndex((t) => t.replace(/s$/, "") === s.replace(/s$/, "")) === i).map((s) => <span key={s} className="tag-sale">🏷️ {s} on sale</span>)}</div>
      )}
    </div>
  );
}

export function ApproveBar({ planId }: { planId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="sticky bottom-24 z-20 sm:bottom-4">
      <div className="rounded-[2rem] bg-card/95 p-2 shadow-lift ring-1 ring-line/60 backdrop-blur sm:p-3">
        <button
          className="btn-warm min-h-12 w-full text-lg sm:min-h-14"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              try { sessionStorage.setItem(CELEBRATE_KEY, "1"); } catch {}
              const r = await approvePlan(planId);
              if (r?.error) {
                setError(r.error);
                try { sessionStorage.removeItem(CELEBRATE_KEY); } catch {}
              }
            })
          }
        >
          {pending ? <><span className="animate-wiggle inline-block" aria-hidden="true">📝</span> Writing your grocery list…</> : "Looks yummy, make my list!"}
        </button>
        <p className="mt-1.5 px-2 text-center text-xs text-muted sm:mt-2 sm:text-sm">Locks in the week. You still do the paying and checkout.</p>
        <ErrorNote error={error} />
      </div>
    </div>
  );
}

const CONFETTI_COLORS = ["#b5654a", "#d2a24c", "#5e6b47", "#f3e0d8", "#f2c94c"];

/** A little confetti shower right after the week is approved. */
export function Celebrate() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let flag = false;
    try {
      flag = sessionStorage.getItem(CELEBRATE_KEY) === "1";
      sessionStorage.removeItem(CELEBRATE_KEY);
    } catch {}
    if (!flag) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 3500);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <>
      <div className="animate-pop rounded-3xl bg-olive p-5 text-center text-cream shadow-lift" role="status">
        <p className="font-display text-2xl font-semibold">Your week is set! 🎉</p>
        <p>Grocery list is ready below.</p>
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {Array.from({ length: 48 }, (_, i) => (
          <span
            key={i}
            className="confetti-piece absolute top-0 block rounded-sm"
            style={{
              left: `${(i * 37) % 100}%`,
              width: 8 + (i % 3) * 3,
              height: 12 + (i % 4) * 2,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animation: `confetti-fall ${2.2 + (i % 5) * 0.3}s ${(i % 8) * 0.08}s ease-in forwards`,
            }}
          />
        ))}
      </div>
    </>
  );
}

const SECTION_ICONS: [RegExp, string][] = [
  [/^added by you$/i, "📝"],
  [/^produce$/i, "🥬"],
  [/^meat/i, "🥩"],
  [/^deli$/i, "🥪"],
  [/^dairy/i, "🧀"],
  [/^bakery/i, "🍞"],
  [/^canned/i, "🥫"],
  [/^spices/i, "🧂"],
  [/^frozen$/i, "🧊"],
  [/athlete/i, "💪"],
  [/staple/i, "🧺"],
  [/stock up/i, "⭐"],
  [/^snacks$/i, "🍿"],
  [/^sweets$/i, "🍬"],
  [/^drinks$/i, "🥤"],
  [/^baby$/i, "🍼"],
  [/pantry check/i, "❓"],
  [/already in your pantry/i, "✅"],
  [/produce|fruit|veg/i, "🥕"],
  [/meat|seafood|protein|butcher/i, "🥩"],
  [/dairy|egg|cheese|milk/i, "🧀"],
  [/bak|bread/i, "🍞"],
  [/frozen/i, "🧊"],
  [/spice|season|pantry|canned|dry/i, "🫙"],
];
const sectionIcon = (name: string) => SECTION_ICONS.find(([re]) => re.test(name))?.[1] ?? "🛒";

/**
 * The grocery list. Ticks are shared by the whole household: they're saved with the week, and every phone
 * with the list open picks up the others' ticks every few seconds (so two people can split the store).
 * Ticks made with no signal are kept and sent when the phone is back online.
 */
export function GroceryChecklist({ plan, store }: { plan: Plan; store: string }) {
  const list = plan.groceryList;
  const key = `ladle-grocery-${plan.id}`;
  const [checked, setChecked] = useState<Record<string, boolean>>(plan.groceryChecked ?? {});
  const [shared, setShared] = useState(false);
  const router = useRouter();
  const [adding, startAdding] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const addedNow = (list?.sections.find((s) => s.name === ADDED_SECTION)?.items ?? []).map((i) => `${i.quantity} ${i.item}`).join("|");
  // Ticks not yet saved, laid over whatever the server says until they are.
  const pending = useRef<Record<string, boolean>>({});
  const flush = useCallback(async () => {
    const send = { ...pending.current };
    if (!Object.keys(send).length) return;
    try {
      const saved = await setGroceryChecks(plan.id, send);
      for (const [k, v] of Object.entries(send)) if (pending.current[k] === v) delete pending.current[k];
      if (saved) setChecked({ ...saved, ...pending.current });
    } catch { /* offline: try again on the next tick */ }
  }, [plan.id]);
  useEffect(() => {
    // Ticks this phone made before they were shared: send them along once.
    try {
      const old = localStorage.getItem(key);
      if (old) {
        const mine = JSON.parse(old) as Record<string, boolean>;
        const fresh = Object.fromEntries(Object.entries(mine).filter(([k, v]) => v && !(plan.groceryChecked ?? {})[k]));
        localStorage.removeItem(key);
        if (Object.keys(fresh).length) { Object.assign(pending.current, fresh); setChecked((c) => ({ ...c, ...fresh })); flush(); }
      }
    } catch {}
    const pull = async () => {
      if (document.visibilityState !== "visible") return;
      await flush();
      try {
        const res = await fetch(`/api/plans/${plan.id}/checks`, { cache: "no-store" });
        if (res.ok) {
          const { checked: server, added } = await res.json();
          setChecked({ ...server, ...pending.current });
          // Someone else added to the list: show it here too.
          if (Array.isArray(added) && added.join("|") !== addedNow) router.refresh();
        }
      } catch { /* offline */ }
    };
    const id = setInterval(pull, 8000);
    document.addEventListener("visibilitychange", pull);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", pull); };
  }, [key, plan.id, plan.groceryChecked, flush, addedNow, router]);
  if (!list) return null;
  const toggle = (id: string) => {
    const value = !checked[id];
    pending.current[id] = value;
    setChecked((prev) => ({ ...prev, [id]: value }));
    flush();
  };
  const buying = list.sections.filter((s) => s.name !== PANTRY_SECTIONS.HAVE_IT);
  // Text the list (what's still to get) to someone, or print it.
  const shareList = async () => {
    const text = groceryText(list, { title: `Grocery list, week of ${new Date(`${plan.weekOf}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, isChecked: (s, i, item) => !!checked[`${s}-${i}-${item}`] });
    try {
      if (navigator.share) await navigator.share({ title: "Grocery list", text });
      else { await navigator.clipboard.writeText(text); setShared(true); setTimeout(() => setShared(false), 2500); }
    } catch { /* closed the share sheet */ }
  };
  const printList = () => {
    document.documentElement.classList.add("printing-grocery");
    const done = () => { document.documentElement.classList.remove("printing-grocery"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  };
  const total = buying.reduce((n, s) => n + s.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  return (
    <section id="grocery-print" className="card p-5" aria-labelledby="grocery-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id="grocery-title" className="flex items-center gap-2 text-2xl font-semibold"><span aria-hidden="true">🛒</span> Grocery list</h2>
        <span className="tag bg-olive-soft text-olive-dark">{done} of {total} got</span>
      </div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary min-h-10 px-4 text-sm" onClick={shareList}>{shared ? "✓ Copied" : "📤 Text the list"}</button>
        <button type="button" className="btn-quiet min-h-10 px-4 text-sm" onClick={printList}>🖨️ Print</button>
      </div>
      <p className="no-print -mt-2 mb-4 text-xs text-muted">Ticks show up on every phone in your household, so you can split up the store.</p>
      <form
        className="no-print mb-4 flex gap-2"
        action={(form) => startAdding(async () => {
          setAddError(null);
          const r = await addGroceryItem(plan.id, String(form.get("item") ?? ""));
          if (r?.error) setAddError(r.error);
        })}
      >
        <input name="item" aria-label="Add to the list" placeholder="Add something: paper towels, 2 lemons…" maxLength={80} className="field" disabled={adding} />
        <button className="btn-secondary shrink-0" disabled={adding}>{adding ? "Adding…" : "+ Add"}</button>
      </form>
      {addError && <p role="alert" className="-mt-2 mb-4 text-sm font-bold text-terracotta-dark">{addError}</p>}
      {plan.status === "approved" && (
        <Link href={`/cart?plan=${plan.id}`} className="no-print btn-warm mb-4 w-full sm:w-auto">
          <span aria-hidden="true">🛒</span> {plan.cart?.sentAt ? `${store} cart sent · review` : `Send to my ${store} cart`}
        </Link>
      )}
      {list.notes && list.notes.length > 0 && (
        <ul className="mb-4 space-y-1.5 rounded-2xl bg-ochre-soft p-3 text-sm">
          {list.notes.map((n) => <li key={n} className="flex gap-2"><span aria-hidden="true">🍲</span><span>{n}</span></li>)}
        </ul>
      )}
      <div className="space-y-5">
        {list.sections.map((s) => s.name === PANTRY_SECTIONS.PANTRY_CHECK ? (
          <PantryCheck key={s.name} planId={plan.id} items={s.items} />
        ) : s.name === PANTRY_SECTIONS.HAVE_IT ? (
          <details key={s.name} className="rounded-2xl bg-cream/70 p-3">
            <summary className="cursor-pointer font-bold text-olive-dark">✅ {s.items.length} item{s.items.length === 1 ? "" : "s"} already in your pantry</summary>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {s.items.map((it) => <li key={it.item}>{it.item}{it.quantity ? ` · ${it.quantity}` : ""}</li>)}
            </ul>
            <p className="mt-2 text-xs text-muted">Out of something? Mark it in your <Link href="/pantry" className="underline">pantry</Link> and it comes back next week.</p>
          </details>
        ) : (
          <div key={s.name}>
            <h3 className="mb-2 flex items-center gap-2 font-bold text-terracotta-dark"><span aria-hidden="true">{sectionIcon(s.name)}</span>{s.name}</h3>
            <ul className="space-y-1">
              {s.items.map((it, i) => {
                const id = `${s.name}-${i}-${it.item}`;
                const on = !!checked[id];
                return (
                  <li key={id} className="flex items-start gap-1">
                    <label className={`flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-2xl p-2 transition-colors hover:bg-cream ${on ? "opacity-55" : ""}`}>
                      <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(id)} />
                      <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold peer-focus-visible:ring-2 peer-focus-visible:ring-olive ${on ? "border-olive bg-olive text-cream" : "border-line bg-card"}`}>
                        {on ? "✓" : ""}
                      </span>
                      <span>
                        <span className={`font-semibold ${on ? "line-through" : ""}`}>{it.item}</span>
                        {it.quantity && <span> · {it.quantity}</span>}
                        {it.note && <span className="text-muted"> · {it.note}</span>}
                        {it.forRecipes.length > 0 && (
                          <>
                            <br />
                            <span className="text-sm text-muted">For {it.forRecipes.join(", ")}</span>
                          </>
                        )}
                      </span>
                    </label>
                    {it.added && (
                      <button type="button" className="no-print btn-quiet min-h-9 shrink-0 px-2.5 text-sm" aria-label={`Remove ${it.item}`} disabled={adding} onClick={() => startAdding(async () => { await removeGroceryItem(plan.id, it.item); })}>✕</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

/** "Do you have these?" for long-lasting items: each answer updates the pantry and the list. */
function PantryCheck({ planId, items }: { planId: string; items: { item: string; quantity: string; note?: string; forRecipes: string[] }[] }) {
  const [pending, start] = useTransition();
  return (
    <div className="rounded-2xl border-2 border-dashed border-ochre/60 p-3">
      <h3 className="flex items-center gap-2 font-bold text-ochre-dark"><span aria-hidden="true">❓</span> Pantry check: do you have these?</h3>
      <p className="mb-2 text-sm text-muted">They last a while, so you may already have them. We&apos;ll remember your answers, so this list gets shorter every week.</p>
      {items.length > 2 && (
        <button className="no-print btn-secondary mb-2 min-h-9 px-3 text-sm" disabled={pending} onClick={() => start(() => answerPantryCheck(planId, null, true))}>
          ✓ I have all {items.length}
        </button>
      )}
      <ul className={`space-y-2 ${pending ? "opacity-60" : ""}`}>
        {items.map((it) => (
          <li key={it.item} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1"><span className="font-semibold">{it.item}</span>{it.quantity && <span className="text-muted"> · {it.quantity}</span>}</span>
            <span className="no-print flex shrink-0 gap-1.5">
              <button className="btn-primary min-h-9 px-3 text-sm" disabled={pending} onClick={() => start(() => answerPantryCheck(planId, it.item, true))}>Have it</button>
              <button className="btn-secondary min-h-9 px-3 text-sm" disabled={pending} onClick={() => start(() => answerPantryCheck(planId, it.item, false))}>Need it</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StartOverButton({ planId, approved }: { planId: string; approved: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="btn-quiet text-sm"
      disabled={pending}
      onClick={() => {
        if (approved && !confirm("Unlock this week and plan it again? The current plan stays in your records.")) return;
        if (!approved && !confirm("Start this week over with new picks?")) return;
        start(() => startOver(planId));
      }}
    >
      {approved ? "Re-plan this week" : "Start over with new picks"}
    </button>
  );
}

export function RatePrompt({ planId, dayIndex, label, recipeName, kids = [] }: { planId: string; dayIndex: number; label: string; recipeName: string; kids?: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [votes, setVotes] = useState<Record<string, number>>({});
  const vote = (id: string, v: number) => setVotes((x) => ({ ...x, [id]: x[id] === v ? 0 : v }));
  const picked = () => Object.fromEntries(Object.entries(votes).filter(([, v]) => v !== 0));
  return (
    <div className={`card flex flex-wrap items-center gap-4 p-4 ${pending ? "opacity-60" : ""}`}>
      <FoodArt name={recipeName} className="h-16 w-16" rounded="rounded-full" />
      <div className="min-w-0 flex-1">
        <p className="font-bold">{label}</p>
        {kids.length > 0 && (
          <div className="my-2 space-y-1">
            {kids.map((k) => (
              <div key={k.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1">Did <b>{k.name || "your picky eater"}</b> eat it?</span>
                <button type="button" aria-pressed={votes[k.id] === 1} aria-label={`${k.name} ate it`} onClick={() => vote(k.id, 1)} className={`h-9 w-11 rounded-full border-2 text-lg ${votes[k.id] === 1 ? "border-olive bg-olive-soft" : "border-line"}`}>👍</button>
                <button type="button" aria-pressed={votes[k.id] === -1} aria-label={`${k.name} didn't eat it`} onClick={() => vote(k.id, -1)} className={`h-9 w-11 rounded-full border-2 text-lg ${votes[k.id] === -1 ? "border-terracotta bg-blush" : "border-line"}`}>👎</button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <StarPicker value={null} label={label} onPick={(n) => start(() => rateCookedDinner(planId, dayIndex, n, picked()))} />
          <button className="btn-quiet mb-5 min-h-10 px-3 text-sm" onClick={() => start(() => rateCookedDinner(planId, dayIndex, null, picked()))}>{Object.keys(picked()).length ? "Save" : "Skip"}</button>
        </div>
      </div>
    </div>
  );
}
