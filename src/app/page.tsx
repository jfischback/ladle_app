import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { activePlans, getSettings, myRecipes } from "@/lib/data";
import { claudeEnabled } from "@/lib/claude";
import { addDays, currentWeekStart, dayName, money, shortDate, today, upcomingWeekStart } from "@/lib/week";
import { PlanButton, DayCard, ApproveBar, RatePrompt, StartOverButton } from "./HomeClient";
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

  return (
    <div className="space-y-6">
      <header>
        <p className="font-semibold uppercase tracking-wide text-muted">
          {settings.storeName ? settings.storeName.split(" · ")[0] : "Your Fry's"} · {settings.fulfillment === "pickup" ? "Curbside pickup" : "Delivery"}
        </p>
        <h1 className="text-3xl font-bold">
          {plan ? `Week of ${shortDate(plan.weekOf)}` : "This Week"}
        </h1>
      </header>

      {prepTomorrow.map(({ d, r }) => (
        <p key={d.date} className="rounded-2xl bg-ochre-soft p-4 text-lg">
          <span className="font-bold">Tonight, for tomorrow&apos;s {r!.name}:</span> {r!.prepAhead}
        </p>
      ))}

      {toRate.map(({ plan: p, d, i }) => (
        <RatePrompt key={`${p.id}-${i}`} planId={p.id} dayIndex={i} label={`How was ${dayName(d.date)}'s ${d.recipeName}?`} />
      ))}

      <SaleBanner plan={plan} />

      {!plan ? (
        <EmptyState weekOf={upcoming} recipeCount={recipes.length} needed={settings.dinnersPerWeek} />
      ) : (
        <>
          {plan.summary && <p className="text-lg text-muted">{plan.summary}</p>}
          <ul className="grid gap-3">
            {plan.days.map((d, i) => (
              <li key={d.date}>
                <DayCard
                  planId={plan.id}
                  index={i}
                  day={d}
                  isToday={d.date === todayStr}
                  locked={plan.status === "approved"}
                  recipes={recipes.map((r) => ({ id: r.id, name: r.name }))}
                />
              </li>
            ))}
          </ul>
          <TotalBar plan={plan} budget={settings.weeklyBudget} mode={settings.budgetMode} />
          {plan.status === "draft" ? (
            <ApproveBar planId={plan.id} />
          ) : (
            <GroceryList plan={plan} />
          )}
          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            {plan.weekOf !== upcoming && plan.status === "approved" && (
              <PlanButton label={`Plan week of ${shortDate(upcoming)}`} />
            )}
            <StartOverButton planId={plan.id} approved={plan.status === "approved"} />
          </div>
        </>
      )}
      {!claudeEnabled() && (
        <p className="text-sm text-muted">Claude isn&apos;t connected yet (no API key), so plans use the basic picker and have no cost estimates.</p>
      )}
    </div>
  );
}

function SaleBanner({ plan }: { plan: Plan | null }) {
  const items = plan?.saleItems ?? [];
  return (
    <section aria-label="On sale this week" className="rounded-2xl bg-oat p-4">
      <h2 className="font-bold">On sale this week</h2>
      {items.length ? (
        <div className="mt-2 flex flex-wrap gap-2">{items.map((s) => <span key={s} className="tag-sale">{s}</span>)}</div>
      ) : (
        <p className="text-muted">Sale prices show up here once your Fry&apos;s is connected. Until then, costs are estimates.</p>
      )}
    </section>
  );
}

function EmptyState({ weekOf, recipeCount, needed }: { weekOf: string; recipeCount: number; needed: number }) {
  if (recipeCount < needed) {
    return (
      <div className="card space-y-3 p-6 text-center">
        <p className="text-lg">You have {recipeCount} dinner{recipeCount === 1 ? "" : "s"} in rotation. Add at least {needed} to plan a week.</p>
        <Link href="/recipes?tab=browse" className="btn-primary">Browse our recipes</Link>
      </div>
    );
  }
  return (
    <div className="card space-y-4 p-6 text-center">
      <p className="text-lg">Ready to plan the week of {shortDate(weekOf)}?</p>
      <PlanButton label="Plan my week" big />
    </div>
  );
}

function TotalBar({ plan, budget, mode }: { plan: Plan; budget: number; mode: "target" | "hard" }) {
  const total = plan.estimatedTotal;
  const over = total != null && total > budget;
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 rounded-2xl p-4 text-lg ${total == null ? "bg-oat" : over ? "bg-terracotta-soft" : "bg-olive-soft"}`}>
      <span>
        <span className="font-bold">Estimated cart: {money(total)}</span>{" "}
        <span className="text-muted">(estimate)</span>
      </span>
      <span className={`font-semibold ${over ? "text-terracotta-dark" : "text-olive-dark"}`}>
        {total == null ? `Budget ${money(budget)}` : over ? `${money(total - budget)} over ${mode === "hard" ? "your limit" : "budget"}` : `${money(budget - total)} under budget`}
      </span>
    </div>
  );
}

function GroceryList({ plan }: { plan: Plan }) {
  const list = plan.groceryList;
  if (!list) return null;
  return (
    <section className="card p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-bold">Grocery list</h2>
        <span className="text-sm text-muted">Plan approved. Cart fill comes once Fry&apos;s is connected.</span>
      </div>
      <div className="space-y-5">
        {list.sections.map((s) => (
          <div key={s.name}>
            <h3 className="mb-2 font-bold text-olive-dark">{s.name}</h3>
            <ul className="space-y-2">
              {s.items.map((it, i) => (
                <li key={i}>
                  <label className="flex cursor-pointer gap-3">
                    <input type="checkbox" className="mt-1.5 h-5 w-5 shrink-0 accent-olive" />
                    <span>
                      <span className="font-semibold">{it.item}</span>
                      {it.quantity && <span> · {it.quantity}</span>}
                      {it.note && <span className="text-muted"> · {it.note}</span>}
                      <br />
                      <span className="text-sm text-muted">{it.forRecipes.join(", ")}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
