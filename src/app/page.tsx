import { ModeBanner } from "@/components/ModeBanner";
import { averageCost, weekSaving } from "@/lib/mode-savings";
import { dinnerCost } from "@/lib/budget";
import { rulesSummary } from "@/lib/diet";
import Link from "next/link";
import { moveTargets } from "@/lib/move-dinner";
import { feastHolidayOn, feastTips } from "@/lib/feast";
import { redirect } from "next/navigation";
import { requireUserId, actingFor } from "@/auth";
import { activePlans, getSettings, myCooks, myRecipes } from "@/lib/data";
import { addDays, currentWeekStart, dayName, greeting, money, shortDate, today, upcomingWeekStart, weekDates, weekday } from "@/lib/week";
import { PlanButton, DayCard, ApproveBar, RatePrompt, StartOverButton, GroceryChecklist, Celebrate } from "./HomeClient";
import { FoodArt } from "@/components/FoodArt";
import { Highlight } from "@/components/Highlight";
import type { Plan } from "@/db/schema";
import type { SaleItem, Staple } from "@/lib/types";
import { staplesTotal } from "@/lib/staples";
import { extrasTotal } from "@/lib/extras";
import { krogerEnabled } from "@/lib/kroger";
import { ruleProblems } from "@/lib/diet";
import { storeBrand } from "@/lib/stores";
import { pickyTips } from "@/lib/picky";
import { healthNeeds, healthTips } from "@/lib/health";
import { prepPlan } from "@/lib/prep";
import { PrepCard } from "@/components/PrepCard";
import { athleteWeeks } from "@/lib/athlete-week";
import { AthleteWeekCard } from "@/components/AthleteWeekCard";
import { GettingStarted, HomeHub } from "@/components/HomeHub";

// Planning, approving and importing can take a while (the AI, store prices): give them a minute.
export const maxDuration = 60;

export default async function HomePage() {
  const userId = await requireUserId();
  const { data: settings, complete } = await getSettings(userId);
  // New families see what Ladle does first, then set up (someone planning for a parent goes straight to setup).
  if (!complete) redirect((await actingFor()) ? "/setup" : "/welcome");

  const [plans, recipes] = await Promise.all([activePlans(userId), myRecipes(userId)]);
  const upcoming = upcomingWeekStart(settings.shoppingDay);
  const inProgress = currentWeekStart(settings.shoppingDay);
  const plan = plans.find((p) => p.weekOf === upcoming) ?? plans.find((p) => p.weekOf === inProgress) ?? null;
  const todayStr = today();
  // Ladle's stand-out features, shown until they're in use.
  const creators = (await myCooks(userId)).map((c) => c.name);
  // Days before the next shopping day: enough to plan the rest of this week now?
  const daysLeft = Math.round((Date.parse(upcomingWeekStart(settings.shoppingDay)) - Date.parse(todayStr)) / 86400_000);
  // The holiday countdown ("move the turkey to the fridge today") on the days it falls on.
  const feastTipsByDate = feastTips(plan?.days ?? [], { boughtOn: plan?.weekOf, today: todayStr });

  // Rating prompt after each cook: past dinners from approved plans that haven't been rated.
  const toRate = plans
    .filter((p) => p.status === "approved")
    .flatMap((p) => p.days.map((d, i) => ({ plan: p, d, i })))
    // A leftovers night is the same dinner: it's rated once, on the night it was cooked.
    .filter(({ d }) => d.recipeId && !d.leftoverOf && d.date < todayStr && !d.ratedAt && d.date >= addDays(todayStr, -14))
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
    .filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length)
    .map((r) => ({ id: r.id, name: r.name, protein: r.protein, totalMinutes: r.totalMinutes }));
  const store = settings.storeName ? settings.storeName.split(" · ")[0] : "your store";
  const brand = storeBrand(settings.storeName);
  const yours = `your ${brand.name ?? "store"}`;
  const approved = plan?.status === "approved";
  const dinners = plan?.days.filter((d) => d.recipeId).length ?? 0;

  // Cost Cutting: what it saved this week and this month, against a typical week of the family's own dinners.
  const averageDinner = averageCost(recipes.filter((r) => r.meal === "dinner").map((r) => dinnerCost(r, settings, []).total));
  const month = todayStr.slice(0, 7);
  const costWeeks = plans.filter((p) => p.mode === "cost" && p.status === "approved" && p.weekOf.slice(0, 7) === month);
  const modeSaved = settings.mode === "cost" && plan?.mode === "cost"
    ? { week: weekSaving(plan.days, averageDinner), month: costWeeks.reduce((a, p) => a + weekSaving(p.days, averageDinner), 0) }
    : null;

  // The home hub: a tile for each place in Ladle.
  const tonight = plan?.days.find((d) => d.date === todayStr);
  const groceryCount = plan?.groceryList?.sections.filter((s) => !/already in your pantry/i.test(s.name)).reduce((n, s) => n + s.items.length, 0) ?? 0;
  const nextPlanned = plans.some((p) => p.weekOf === upcoming);
  const hubTiles = [
    { href: plan ? "#dinners" : "/plan", icon: "🍲", title: "This week", tone: "warm" as const, sub: !plan ? "Nothing planned yet" : tonight?.feast ? "Tonight: the holiday dinner" : tonight?.recipeName ? `Tonight: ${tonight.recipeName}` : `${dinners} dinner${dinners === 1 ? "" : "s"} planned` },
    { href: approved && plan?.groceryList ? "#grocery-print" : plan ? "#dinners" : "/plan", icon: "🛒", title: "Grocery list", tone: "plain" as const, sub: approved && plan?.groceryList ? `${groceryCount} item${groceryCount === 1 ? "" : "s"}, shared` : plan ? "Ready when you approve the week" : "Comes with your plan" },
    { href: "/plan", icon: "🗓", title: "Plan my week", tone: "plain" as const, sub: !plan ? "A few quick questions" : approved && !nextPlanned ? `Next: week of ${shortDate(upcoming)}` : "Re-plan with a check-in" },
    { href: "/recipes", icon: "📖", title: "Recipes", tone: "plain" as const, sub: `${recipes.length} in your box` },
    { href: "/recipes?tab=cooks", icon: "✨", title: "Food creators", tone: "ochre" as const, sub: creators.length ? `Following ${creators.length}` : "Recipes from your favorites" },
    { href: "/athletes", icon: "💪", title: "Athlete mode", tone: "olive" as const, sub: settings.athletes.length ? `${settings.athletes.length} set up` : "For whoever's training" },
    { href: "/recipes?f=have", icon: "🥫", title: "Use what I have", tone: "plain" as const, sub: "Dinners from your fridge" },
    { href: "/party", icon: "🎉", title: "Plan a party", tone: "plain" as const, sub: "Birthdays, grads, holidays" },
    { href: "/history", icon: "📜", title: "History", tone: "plain" as const, sub: "Past weeks and spending" },
    { href: "/household#care", icon: "🤝", title: "Plan for a parent", tone: "plain" as const, sub: "Caregiver mode" },
    { href: "/setup", icon: "⚙️", title: "Settings", tone: "plain" as const, sub: "Family, store, budget" },
  ];
  // Getting started: the extras that weren't in the short first setup.
  const startSteps = [
    { href: "/plan", title: "Plan your first week", why: "A few quick questions, then dinners for the week and a grocery list.", done: plans.length > 0 },
    { href: "/setup?step=5", title: "Pick your cooking nights", why: "Which nights you cook, which are busy, and your kitchen.", done: settings.seen.includes("cooking") },
    { href: "/recipes?tab=cooks", title: "Follow your favorite food creators", why: "Their new dinners come into your week, especially when the ingredients are on sale.", done: creators.length > 0 || settings.seen.includes("creators") },
    { href: "/athletes", title: "Anyone training? Turn on athlete mode", why: "Portions, protein and snacks for whoever's working out.", done: settings.athletes.length > 0 || settings.seen.includes("athletes") },
    { href: "/staples", title: "Add your weekly staples", why: "Milk, eggs, bread: the things you buy every week, on every list.", done: settings.staples.length > 0 || settings.seen.includes("staples") },
    { href: "/pantry", title: "Tell us what's in your pantry", why: "So the list skips what you already have.", done: settings.seen.includes("pantry") },
  ];
  const athletes = plan ? await athleteWeeks(userId, plan, settings) : [];
  // Meal prep day: one session that does the slow parts of the week's dinners.
  const prep = plan && settings.prepDay != null ? prepPlan(plan.days, new Map(recipes.map((r) => [r.id, r])), settings.prepDay, settings.prepMinutes) : null;
  // Picky eaters: a tip for each dinner with something they won't eat.
  const needs = healthNeeds(settings.athletes);
  const pickyFor = (d: { recipeId: string | null; date: string; leftoverOf?: string | null }) => {
    const r = d.recipeId && !d.leftoverOf ? recipes.find((x) => x.id === d.recipeId) : null;
    if (!r) return [];
    return [...healthTips(r, needs).map((t) => `🩺 ${t}`), ...(settings.pickyEaters.length ? pickyTips(r, settings.pickyEaters, Number(d.date.slice(8))).map((t) => `🧒 ${t.tip}`) : [])];
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">{greeting()}!</p>
        <h1 className="text-4xl font-semibold leading-tight">
          {plan ? (plan.days[0] && plan.days[0].date > plan.weekOf ? <>This week, {shortDate(plan.days[0].date)} to {shortDate(plan.days[plan.days.length - 1].date)}</> : <>Week of {shortDate(plan.weekOf)}</>) : "Let's plan dinner"}
        </h1>
        <p className="mt-1 text-muted">
          {plan
            ? `${dinners} dinner${dinners === 1 ? "" : "s"} · ${approved ? "your list is ready" : "take a look, swap anything"} · ${settings.fulfillment === "pickup" ? "pickup" : "delivery"} from ${store}`
            : `${settings.fulfillment === "pickup" ? "Pickup" : "Delivery"} from ${store}`}
        </p>
      </header>

      {/* Everything starts here: one tile for each place in Ladle. */}
      <ModeBanner mode={settings.mode} dietary={rulesSummary(settings.foodRules, settings.dislikes, settings.allowAnyway)} saved={modeSaved} />
      <HomeHub tiles={hubTiles} />
      {!settings.seen.includes("getting-started-hidden") && <GettingStarted steps={startSteps} />}

      {prepTomorrow.map(({ d, r }) => (
        <div key={d.date} className="flex items-start gap-3 rounded-3xl bg-ochre-soft p-4 shadow-soft">
          <span className="animate-wiggle text-3xl" aria-hidden="true">⏰</span>
          <p className="text-lg">
            <span className="font-bold">Tonight, for tomorrow&apos;s {r!.name}:</span> {r!.prepAhead}
          </p>
        </div>
      ))}

      {toRate.map(({ plan: p, d, i }) => (
        <RatePrompt key={`${p.id}-${i}`} planId={p.id} dayIndex={i} recipeName={d.recipeName ?? ""} kids={settings.pickyEaters.map((k) => ({ id: k.id, name: k.name }))} label={`How did everyone like ${dayName(d.date)}'s ${d.recipeName}?`} />
      ))}

      {plan?.summary && plan.plannerSource !== "basic" && <WhyThisWeek summary={plan.summary} />}
      <SaleBanner plan={plan} saleThreshold={settings.saleThresholdPct} yours={yours} />
      {!plan && krogerEnabled() && !settings.storeLocationId && (
        <Link href="/setup" className="flex items-center gap-3 rounded-3xl bg-ochre-soft p-4 shadow-soft hover:shadow-lift">
          <span className="text-3xl" aria-hidden="true">🏷️</span>
          <span><span className="font-bold">Want sale prices?</span> Pick your store in Settings first, and we&apos;ll plan around what&apos;s on sale. →</span>
        </Link>
      )}

      {!plan ? (
        <EmptyState weekOf={upcoming} recipeCount={recipes.length} needed={daysLeft >= 2 ? Math.min(settings.dinnersPerWeek, Math.max(1, weekDates(inProgress).filter((d) => d >= todayStr && settings.cookDays.includes(weekday(d))).length)) : settings.dinnersPerWeek} checksSales={krogerEnabled() && !!settings.storeLocationId} yours={yours} startNow={daysLeft >= 2 ? `the rest of this week (${dayName(todayStr).slice(0, 3)} to ${dayName(addDays(upcoming, -1)).slice(0, 3)})` : null} />
      ) : (
        <>
          <ul id="dinners" className="grid scroll-mt-24 grid-cols-[minmax(0,1fr)] gap-3">
            {plan.days.map((d, i) => (
              <li key={d.date}>
                <DayCard
                  planId={plan.id}
                  index={i}
                  day={d}
                  isToday={d.date === todayStr}
                  locked={approved}
                  recipes={recipeInfo}
                  picky={[...(feastTipsByDate.get(d.date) ?? []), ...(prep?.finish[d.date] ? [`🥡 Prepped ${dayName(prep.date)}: about ${prep.finish[d.date]} minutes to finish tonight.`] : []), ...pickyFor(d)]}
                  plates={settings.tightBudget ? Math.max(1, settings.adults + settings.kids * 0.7) : undefined}
                  moveTargets={moveTargets(plan.days, i, todayStr)}
                  canFeast={!!feastHolidayOn(d.date, d.holiday) && d.date >= todayStr}
                  feastGuests={settings.adults + settings.kids}
                  feastWhen={{ boughtOn: plan.weekOf, today: todayStr }}
                  household={{ adults: settings.adults, kids: settings.kids }}
                />
              </li>
            ))}
          </ul>
          <BudgetMeter plan={plan} budget={settings.weeklyBudget} mode={settings.budgetMode} />
          <StaplesCard plan={plan} staples={settings.staples} />
          <PantryCard plan={plan} />
          <ExtrasCard plan={plan} />
          {prep && <div id="prep" className="scroll-mt-24"><PrepCard plan={prep} /></div>}
          {athletes.map((w) => <AthleteWeekCard key={w.athlete.id} week={w} />)}
          {approved ? (
            <>
              <Celebrate />
              <GroceryChecklist plan={plan} store={brand.name ?? "store"} aiShopper={{ rules: rulesSummary(settings.foodRules, settings.dislikes, settings.allowAnyway), budget: settings.weeklyBudget }} />
            </>
          ) : (
            <ApproveBar planId={plan.id} />
          )}
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {plan.weekOf !== upcoming && approved && <Link href="/plan" className="btn-secondary">Plan the week of {shortDate(upcoming)}</Link>}
            <a href={`/api/plans/${plan.id}/calendar`} className="btn-quiet text-sm" download>📅 Add to my calendar</a>
            <Link href={`/menu/${plan.id}`} className="btn-quiet text-sm">🖨️ Fridge menu</Link>
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

function SaleBanner({ plan, saleThreshold, yours }: { plan: Plan | null; saleThreshold: number; yours: string }) {
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
        <span><span className="font-bold">See what&apos;s on sale.</span> Pick your store in Settings and we&apos;ll check prices each week. →</span>
      </Link>
    );
  }
  if (check?.status === "failed") {
    return (
      <p className="rounded-3xl bg-oat p-4">
        <span className="font-bold">We couldn&apos;t get prices from {yours.replace(/^your /, "")} this time,</span> so this week was planned without sales. Tap &quot;Start over&quot; later to try again.
      </p>
    );
  }
  if (check?.status === "ok" && !sales.length) {
    return (
      <p className="rounded-3xl bg-oat p-4">
        <span className="font-bold">No big sales on your ingredients this week.</span> We checked {check.checked} items at {yours}; none were {saleThreshold}% off or more.
      </p>
    );
  }
  if (!sales.length && !oldNames.length) return null;

  const first = sales.slice(0, 3);
  const more = sales.slice(3);
  return (
    <section aria-labelledby="sale-title" className="rounded-3xl bg-ochre-soft p-4 shadow-soft">
      <h2 id="sale-title" className="flex items-center gap-2 text-xl font-semibold">
        <span aria-hidden="true">🏷️</span> On sale at {yours}
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

function EmptyState({ weekOf, recipeCount, needed, checksSales, yours, startNow }: { weekOf: string; recipeCount: number; needed: number; checksSales: boolean; yours: string; startNow?: string | null }) {
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
        <p className="mt-1 text-lg text-muted">We&apos;ll pick dinners for the week of {shortDate(weekOf)} from the recipes your family likes{checksSales ? `, built around what's on sale at ${yours}` : ""}. You can swap anything.</p>
      </div>
      <Link href="/plan" className="btn-warm min-h-14 px-8 text-lg">Plan my week</Link>
      <p className="-mt-1 text-sm text-muted">A few quick questions about this week first: busy nights, company, what to use up.</p>
      <PlanButton label="Or plan with my usual settings" quiet />
      {startNow && (
        // Starting mid-week: no need to wait for the next shopping day.
        <Link href="/plan?now=1" className="btn-quiet">Or start now: plan {startNow}</Link>
      )}

    </div>
  );
}

function BudgetMeter({ plan, budget, mode }: { plan: Plan; budget: number; mode: "target" | "hard" }) {
  const dinners = plan.estimatedTotal;
  const staples = staplesTotal(plan.staples);
  if (dinners == null && !staples.priced && !extrasTotal(plan.extras)) {
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
  const extras = extrasTotal(plan.extras);
  const total = (dinners ?? 0) + staples.total + extras;
  const over = total > budget;
  const pct = (n: number) => Math.min(100, (n / Math.max(budget, total)) * 100);
  return (
    <section aria-label="Budget" className={`rounded-3xl p-5 shadow-soft ${over ? "bg-terracotta-soft" : "bg-olive-soft"}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg">
          <span className="font-bold">About {money(total)}</span> <span className="text-muted">{dinners == null ? "so far " : ""}of your {money(budget)} budget</span>
        </p>
        <p className={`text-lg font-bold ${over ? "text-terracotta-dark" : "text-olive-dark"}`}>
          {over ? `${money(total - budget)} over ${mode === "hard" ? "your limit" : "budget"}` : `${money(budget - total)} left 🎉`}
        </p>
      </div>
      <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-card" role="meter" aria-valuemin={0} aria-valuemax={budget} aria-valuenow={total} aria-label="Estimated cart compared with budget">
        <div className={`h-full transition-all ${over ? "bg-terracotta" : "bg-olive"}`} style={{ width: `${pct(dinners ?? 0)}%` }} />
        {staples.total > 0 && <div className="h-full bg-ochre transition-all" style={{ width: `${pct(staples.total)}%` }} />}
        {extras > 0 && <div className="h-full bg-terracotta/50 transition-all" style={{ width: `${pct(extras)}%` }} />}
      </div>
      {(staples.total > 0 || extras > 0) && (
        <p className="mt-2 flex flex-wrap gap-x-4 text-sm font-semibold">
          <span><span aria-hidden="true" className={`mr-1 inline-block h-2.5 w-2.5 rounded-full ${over ? "bg-terracotta" : "bg-olive"}`} />Dinners {dinners == null ? "(no prices yet)" : money(dinners)}</span>
          {staples.total > 0 && <span><span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-ochre" />Staples {money(staples.total)}</span>}
          {extras > 0 && <span><span aria-hidden="true" className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-terracotta/50" />Snacks &amp; more {money(extras)}</span>}
        </p>
      )}
      <p className="mt-1 text-sm text-muted">Estimate. Your receipt may be a little different.</p>
    </section>
  );
}

/** Snacks, sweets, drinks and baby items on this week's list. */
function ExtrasCard({ plan }: { plan: Plan }) {
  const lines = plan.extras ?? [];
  const deals = lines.filter((l) => l.sale);
  return (
    <Link href="/extras" className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft hover:shadow-lift">
      <span className="text-3xl" aria-hidden="true">🍿</span>
      <span className="min-w-0 flex-1">
        <span className="font-bold">Snacks &amp; more</span>{" "}
        <span className="text-muted">{lines.length ? `· ${lines.length} on your list` : "· snacks, sweets, drinks, baby, pets"}</span>
        <span className="block truncate text-sm text-muted">
          {deals.length ? <span className="font-bold text-terracotta-dark">🏷️ {deals.map((l) => `${l.item} ${l.sale!.pctOff}% off`).join(", ")}</span> : lines.length ? lines.map((l) => l.item).join(", ") : "Add favorites and how to buy them: every trip, on sale, rotate."}
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-olive-dark">Open ›</span>
    </Link>
  );
}

/** Pantry: what's running low and any "buy on sale" items on sale this week. */
function PantryCard({ plan }: { plan: Plan }) {
  const deals = plan.stockUp ?? [];
  return (
    <Link href="/pantry" className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft hover:shadow-lift">
      <span className="text-3xl" aria-hidden="true">🥫</span>
      <span className="min-w-0 flex-1">
        <span className="font-bold">Pantry</span>{" "}
        <span className="text-muted">{deals.length ? `· ${deals.length} stock-up deal${deals.length === 1 ? "" : "s"}` : "· skip what you have"}</span>
        <span className="block truncate text-sm text-muted">
          {deals.length ? <span className="font-bold text-terracotta-dark">⭐ {deals.map((d) => `${d.item.replace(/(^|\s)([a-z])/g, (_, sp, c) => sp + c.toUpperCase())} ${d.pctOff}% off`).join(", ")}</span> : "Mark what's low or out, and set items to buy only on sale."}
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-olive-dark">Open ›</span>
    </Link>
  );
}

/** A small card for the weekly staples, with any that are on sale this week. */
function StaplesCard({ plan, staples }: { plan: Plan | null; staples: Staple[] }) {
  const active = staples.filter((s) => s.active);
  const onSale = (plan?.staples ?? []).filter((l) => l.sale);
  if (!active.length) {
    return (
      <Link href="/staples" className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft hover:shadow-lift">
        <span className="text-3xl" aria-hidden="true">🧺</span>
        <span className="flex-1"><span className="font-bold">Add your weekly staples</span><br /><span className="text-sm text-muted">Milk, eggs, bread… added to every grocery list.</span></span>
        <span aria-hidden="true" className="font-bold text-olive-dark">›</span>
      </Link>
    );
  }
  return (
    <Link href="/staples" className="flex items-center gap-3 rounded-3xl bg-card p-4 shadow-soft hover:shadow-lift">
      <span className="text-3xl" aria-hidden="true">🧺</span>
      <span className="min-w-0 flex-1">
        <span className="font-bold">{active.length} weekly staple{active.length === 1 ? "" : "s"}</span> <span className="text-muted">go on your list</span>
        <span className="block truncate text-sm text-muted">
          {onSale.length ? <><span className="font-bold text-terracotta-dark">🏷️ {onSale.map((l) => `${l.item} ${l.sale!.pctOff}% off`).join(", ")}</span></> : active.map((s) => s.item).join(", ")}
        </span>
      </span>
      <span className="shrink-0 text-sm font-bold text-olive-dark">Edit ›</span>
    </Link>
  );
}
