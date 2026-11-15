import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { activePlans, getSettings, myRecipes } from "@/lib/data";
import { addDays, currentWeekStart, dayName, greeting, money, shortDate, today, upcomingWeekStart } from "@/lib/week";
import { PlanButton, DayCard, ApproveBar, RatePrompt, StartOverButton, GroceryChecklist, Celebrate } from "./HomeClient";
import { FoodArt } from "@/components/FoodArt";
import type { Plan } from "@/db/schema";

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

  const recipeInfo = recipes.map((r) => ({ id: r.id, name: r.name, protein: r.protein, totalMinutes: r.totalMinutes }));
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

      <SaleBanner plan={plan} />

      {!plan ? (
        <EmptyState weekOf={upcoming} recipeCount={recipes.length} needed={settings.dinnersPerWeek} />
      ) : (
        <>
          {plan.summary && plan.plannerSource !== "basic" && <p className="text-lg text-muted">{plan.summary}</p>}
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

function SaleBanner({ plan }: { plan: Plan | null }) {
  const items = plan?.saleItems ?? [];
  if (!items.length) return null;
  return (
    <section aria-label="On sale this week" className="rounded-3xl bg-ochre-soft p-4 shadow-soft">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span aria-hidden="true">🏷️</span> On sale this week
      </h2>
      <div className="mt-2 flex flex-wrap gap-2">{items.map((s) => <span key={s} className="tag-sale bg-card">{s}</span>)}</div>
    </section>
  );
}

function EmptyState({ weekOf, recipeCount, needed }: { weekOf: string; recipeCount: number; needed: number }) {
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
        <p className="mt-1 text-lg text-muted">We&apos;ll pick dinners for the week of {shortDate(weekOf)} from the recipes your family likes. You can swap anything.</p>
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
