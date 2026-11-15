import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { activePlans, getSettings, myRecipes } from "@/lib/data";
import { addDays, currentWeekStart, dayName, greeting, money, shortDate, today, upcomingWeekStart } from "@/lib/week";
import { PlanButton, DayCard, ApproveBar, RatePrompt, StartOverButton, GroceryChecklist, Celebrate } from "./HomeClient";
import { FoodArt } from "@/components/FoodArt";
import { Highlight } from "@/components/Highlight";
import type { Plan } from "@/db/schema";
import type { SaleItem } from "@/lib/types";
import { krogerEnabled } from "@/lib/kroger";
import { ruleProblems } from "@/lib/diet";

export default async function HomePage() {
  const userId = await requireUserId();
  const { data: settings, complete } = await getSettings(userId);
  if (!complete) redirect("/setup");

  const [plans, recipes] = await Promise.all([activePlans(userId), myRecipes(userId)]);
  const upcoming = upcomingWeekStart(settings.shoppingDay);
  const inProgress = currentWeekStart(settings.shoppingDay);
  const plan = plans.find((p) => p.weekOf === upcoming) ?? plans.find((p) => p.weekOf === inProgress) ?? null;
  const todayStr = today();

  // Rating prompt after each cook: past dinners from approved plans that haven't been rated.
  const toRate = plans
    .filter((p) => p.status === "approved")
    .flatMap((p) => p.days.map((d, i) => ({ plan: p, d, i })))
    .filter(({ d }) => d.recipeId && d.date < todayStr && !d.ratedAt && d.date >= addDays(todayStr, -14))
    .slice(0, 2);

  // Prep-ahead reminder for tomorrow's dinner.
  const tomorrow = addDays(todayStr, 1);
  const prepTomorrow =
    settings.prepReminders && plan
      ? plan.days
          .filter((d) => d.date === tomorrow && d.recipeId)
          .map((d) => ({ d, r: recipes.find((r) => r.id === d.recipeId) }))
          .filter((x) => x.r?.prepAhead)
      : [];

  // Swap choices only offer recipes that fit the household's food rules.
  const recipeInfo = recipes
    .filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes).length)
    .map((r) => ({ id: r.id, name: r.name, protein: r.protein, totalMinutes: r.totalMinutes }));
  const store = settings.storeName ? settings.storeName.split(" · ")[0] : "your Fry's";
  const approved = plan?.status === "approved";
  const dinners = plan?.days.filter((d) => d.recipeId).length ?? 0;

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">{greeting()}!</p>
        <h1 className="text-4xl font-semibold leading-tight">
          {plan ? <>Week of {shortDate(plan.weekOf)}</> : "Let's plan dinner"}
        </h1>
        <p className="mt-1 text-muted">
          {plan
            ? `${dinners} dinner${dinners === 1 ? "" : "s"} · ${approved ? "your list is ready" : "take a look, swap anything"} · ${settings.fulfillment === "pickup" ? "pickup" : "delivery"} from ${store}`
            : `${settings.fulfillment === "pickup" ? "Pickup" : "Delivery"} from ${store}`}
        </p>
      </header>

      {prepTomorrow.map(({ d, r }) => (
        <div key={d.date} className="flex items-start gap-3 rounded-3xl bg-ochre-soft p-4 shadow-soft">
          <span className="animate-wiggle text-3xl" aria-hidden="true">⏰</span>
          <p className="text-lg">
            <span className="font-bold">Tonight, for tomorrow&apos;s {r!.name}:</span> {r!.prepAhead}
          </p>
        </div>
      ))}

      {toRate.map(({ plan: p, d, i }) => (
        <RatePrompt key={`${p.id}-${i}`} planId={p.id} dayIndex={i} recipeName={d.recipeName ?? ""} label={`How did everyone like ${dayName(d.date)}'s ${d.recipeName}?`} />
      ))}

      {plan?.summary && plan.plannerSource !== "basic" && <WhyThisWeek summary={plan.summary} />}
      <SaleBanner plan={plan} saleThreshold={settings.saleThresholdPct} />
      {!plan && krogerEnabled() && !settings.storeLocationId && (
        <Link href="/setup" className="flex items-center gap-3 rounded-3xl bg-ochre-soft p-4 shadow-soft hover:shadow-lift">
          <span className="text-3xl" aria-hidden="true">🏷️</span>
          <span><span className="font-bold">Want sale prices?</span> Pick your Fry&apos;s in Settings first, and we&apos;ll plan around what&apos;s on sale. →</span>
        </Link>
      )}

      {!plan ? (
        <EmptyState weekOf={upcoming} recipeCount={recipes.length} needed={settings.dinnersPerWeek} checksSales={krogerEnabled() && !!settings.storeLocationId} />
      ) : (
        <>
          <ul className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {plan.days.map((d, i) => (
              <li key={d.date}>
                <DayCard
                  planId={plan.id}
                  index={i}
                  day={d}
                  isToday={d.date === todayStr}
                  locked={approved}
                  recipes={recipeInfo}
                />
              </li>
            ))}
          </ul>
          <BudgetMeter plan={plan} budget={settings.weeklyBudget} mode={settings.budgetMode} />
          {approved ? (
            <>
              <Celebrate />
              <GroceryChecklist plan={plan} />
            </>
          ) : (
            <ApproveBar planId={plan.id} />
          )}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {plan.weekOf !== upcoming && approved && <PlanButton label={`Plan the week of ${shortDate(upcoming)}`} />}
            <StartOverButton planId={plan.id} approved={approved} />
          </div>
        </>
      )}
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The planner's explanation for the week, front and center. */
function WhyThisWeek({ summary }: { summary: string }) {
  return (
    <section aria-labelledby="why-title" className="relative overflow-hidden rounded-3xl bg-blush p-5 pl-6 shadow-lift ring-1 ring-terracotta/20">
      <div aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-terracotta" />
      <h2 id="why-title" className="flex items-center gap-2.5 text-xl font-semibold">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-lg shadow-soft">💡</span>
        Why these dinners?
      </h2>
      <p className="mt-2.5 text-[1.05rem] leading-relaxed text-ink sm:text-lg">
        <Highlight text={summary} />
      </p>
    </section>
  );
}

function SaleRow({ s }: { s: SaleItem }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5">
      <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full bg-terracotta text-cream leading-none">
        <span className="text-sm font-extrabold">{s.pctOff}%</span>
        <span className="text-[0.6rem] font-bold uppercase">off</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{cap(s.item)}</span>
        <span className="block truncate text-sm text-muted">{s.product}{s.size ? ` · ${s.size}` : ""}</span>
      </span>
      <span className="shrink-0 text-right">
        <span className="block font-extrabold text-terracotta-dark">${s.salePrice.toFixed(2)}</span>
        <span className="block text-sm text-muted line-through">${s.regularPrice.toFixed(2)}</span>
      </span>
    </li>
  );
}

function SaleBanner({ plan, saleThreshold }: { plan: Plan | null; saleThreshold: number }) {
  if (!plan) return null;
  const check = plan.saleCheck;
  // Recipes word things differently ("chicken thighs", "boneless skinless chicken thighs"), so one deal can cover
  // several ingredients. Show each deal once, under its shortest name.
  const byDeal = new Map<string, SaleItem>();
  for (const s of plan.saleItems.filter((x): x is SaleItem => typeof x !== "string")) {
    const key = `${s.product}|${s.salePrice}`;
    const seen = byDeal.get(key);
    if (!seen || s.item.length < seen.item.length) byDeal.set(key, s);
  }
  const sales = [...byDeal.values()].sort((a, b) => b.pctOff - a.pctOff);
  const oldNames = plan.saleItems.filter((x): x is string => typeof x === "string");

  if (check?.status === "off" && check.reason === "no-store") {
    return (
      <Link href="/setup" className="flex items-center gap-3 rounded-3xl bg-ochre-soft p-4 shadow-soft hover:shadow-lift">
        <span className="text-3xl" aria-hidden="true">🏷️</span>
        <span><span className="font-bold">See what&apos;s on sale.</span> Pick your Fry&apos;s in Settings and we&apos;ll check prices each week. →</span>
      </Link>
    );
  }
  if (check?.status === "failed") {
    return (
      <p className="rounded-3xl bg-oat p-4">
        <span className="font-bold">We couldn&apos;t get prices from Fry&apos;s this time,</span> so this week was planned without sales. Tap &quot;Start over&quot; later to try again.
      </p>
    );
  }
  if (check?.status === "ok" && !sales.length) {
    return (
      <p className="rounded-3xl bg-oat p-4">
        <span className="font-bold">No big sales on your ingredients this week.</span> We checked {check.checked} items at your Fry&apos;s; none were {saleThreshold}% off or more.
      </p>
    );
  }
  if (!sales.length && !oldNames.length) return null;

  const first = sales.slice(0, 3);
  const more = sales.slice(3);
  return (
    <section aria-labelledby="sale-title" className="rounded-3xl bg-ochre-soft p-4 shadow-soft">
      <h2 id="sale-title" className="flex items-center gap-2 text-xl font-semibold">
        <span aria-hidden="true">🏷️</span> On sale at your Fry&apos;s
      </h2>
      {sales.length > 0 ? (
        <>
          <p className="mb-3 text-sm text-ochre-dark">
            {sales.length} deal{sales.length === 1 ? "" : "s"} on your ingredients this week. Dinners that use them are tagged below.
          </p>
          <ul className="space-y-2">{first.map((s) => <SaleRow key={s.item} s={s} />)}</ul>
          {more.length > 0 && (
            <details className="mt-2">
              <summary className="cursor-pointer px-1 py-1 font-bold text-ochre-dark">Show {more.length} more</summary>
              <ul className="mt-2 space-y-2">{more.map((s) => <SaleRow key={s.item} s={s} />)}</ul>
            </details>
          )}
          {check?.status === "ok" && <p className="mt-2 px-1 text-xs text-muted">Checked {check.checked} ingredients. Prices can change before you shop.</p>}
        </>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">{oldNames.map((s) => <span key={s} className="tag-sale bg-card">{s}</span>)}</div>
      )}
    </section>
  );
}

function EmptyState({ weekOf, recipeCount, needed, checksSales }: { weekOf: string; recipeCount: number; needed: number; checksSales: boolean }) {
  if (recipeCount < needed) {
    return (
      <div className="card flex flex-col items-center gap-4 p-8 text-center">
        <FoodArt kind="pot" className="h-28 w-28" rounded="rounded-full" />
        <div>
          <h2 className="text-2xl font-semibold">Let&apos;s fill your recipe box</h2>
          <p className="mt-1 text-lg text-muted">
            You have {recipeCount} dinner{recipeCount === 1 ? "" : "s"} saved. Add at least {needed} and we&apos;ll plan your whole week.
          </p>
        </div>
        <Link href="/recipes?tab=browse" className="btn-primary min-h-12 px-6">Browse our favorites</Link>
      </div>
    );
  }
  return (
    <div className="card flex flex-col items-center gap-4 p-8 text-center">
      <div className="flex -space-x-4">
        <FoodArt kind="taco" className="h-20 w-20 -rotate-6 ring-4 ring-card" rounded="rounded-full" />
        <FoodArt kind="soup" className="z-10 h-24 w-24 ring-4 ring-card" rounded="rounded-full" />
        <FoodArt kind="pasta" className="h-20 w-20 rotate-6 ring-4 ring-card" rounded="rounded-full" />
      </div>
      <div>
        <h2 className="text-2xl font-semibold">What&apos;s for dinner this week?</h2>
        <p className="mt-1 text-lg text-muted">We&apos;ll pick dinners for the week of {shortDate(weekOf)} from the recipes your family likes{checksSales ? ", built around what's on sale at your Fry's" : ""}. You can swap anything.</p>
      </div>
      <PlanButton label="Plan my week" big />
    </div>
  );
}

function BudgetMeter({ plan, budget, mode }: { plan: Plan; budget: number; mode: "target" | "hard" }) {
  const total = plan.estimatedTotal;
  if (total == null) {
    return (
      <div className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft">
        <span className="text-3xl" aria-hidden="true">🫙</span>
        <p>
          <span className="font-bold">Your budget: {money(budget)} a week.</span>{" "}
          <span className="text-muted">Prices show up once your store is connected.</span>
        </p>
      </div>
    );
  }
  const over = total > budget;
  const pct = Math.min(100, Math.round((total / budget) * 100));
  return (
    <section aria-label="Budget" className={`rounded-3xl p-5 shadow-soft ${over ? "bg-terracotta-soft" : "bg-olive-soft"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg">
          <span className="font-bold">About {money(total)}</span> <span className="text-muted">of your {money(budget)} budget</span>
        </p>
        <p className={`text-lg font-bold ${over ? "text-terracotta-dark" : "text-olive-dark"}`}>
          {over ? `${money(total - budget)} over ${mode === "hard" ? "your limit" : "budget"}` : `${money(budget - total)} left 🎉`}
        </p>
      </div>
      <div className="mt-3 h-4 overflow-hidden rounded-full bg-card" role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={total} aria-label="Estimated cart compared with budget">
        <div className={`h-full rounded-full transition-all ${over ? "bg-terracotta" : "bg-olive"}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-sm text-muted">Estimate. Your receipt may be a little different.</p>
    </section>
  );
}
