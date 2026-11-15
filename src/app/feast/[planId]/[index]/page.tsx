import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { getPlan } from "@/lib/data";
import { feastDishes, feastTimeline, turkeyFor } from "@/lib/feast";
import { dayName, shortDate, today } from "@/lib/week";
import { CookMode } from "@/app/recipes/[id]/CookMode";

/** The holiday dinner: the countdown, then every dish with amounts for the guest count and cooking mode. */
export default async function FeastPage({ params }: { params: Promise<{ planId: string; index: string }> }) {
  const userId = await requireUserId();
  const { planId, index } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(planId) || !/^\d{1,2}$/.test(index)) notFound();
  const plan = await getPlan(userId, planId);
  const day = plan?.days[Number(index)];
  if (!day?.feast) notFound();
  const feast = day.feast;
  const dishes = feastDishes(feast);
  const steps = feastTimeline(feast, day.date, { boughtOn: plan!.weekOf, today: today() });
  const t = turkeyFor(feast.guests);

  return (
    <article className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
      <div>
        <p className="eyebrow">{dayName(day.date)}, {shortDate(day.date)}</p>
        <h1 className="text-4xl font-semibold">🦃 {feast.holiday} for {feast.guests}</h1>
        {feast.dishes.includes("turkey") && (
          <p className="mt-1 text-lg text-muted">
            {t.two ? `Two ${t.lb} lb turkeys` : `A ${t.lb} lb ${t.kind}`}: about 1¼ lb a person, so there are leftovers for sandwiches.
          </p>
        )}
      </div>

      {steps.length > 0 && (
        <section className="card p-5" aria-labelledby="countdown">
          <h2 id="countdown" className="mb-3 text-2xl font-semibold">The countdown</h2>
          <ol className="space-y-3">
            {steps.map((s) => (
              <li key={s.date + s.what} className="flex gap-3">
                <span className="w-24 shrink-0 font-bold text-terracotta-dark">{s.date === day.date ? "The day of" : `${dayName(s.date)} ${shortDate(s.date)}`}</span>
                <span>{s.what}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {dishes.map((d) => (
        <section key={d.key} className="card space-y-3 p-5" aria-labelledby={`dish-${d.key}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id={`dish-${d.key}`} className="text-2xl font-semibold">{d.name}</h2>
            <CookMode recipeId={`feast-${planId}-${d.key}`} name={d.name} steps={d.steps} ingredients={d.scaled} />
          </div>
          {!d.main && d.times !== 1 && <p className="text-sm text-muted">{d.times}× the recipe, for {feast.guests} people.</p>}
          {d.ahead && <p className="rounded-2xl bg-ochre-soft px-3 py-2 text-sm"><b>The day before:</b> {d.ahead}</p>}
          <ul className="space-y-1">
            {d.scaled.map((ing, n) => (
              <li key={n}><b>{[ing.amount, ing.unit].filter(Boolean).join(" ")}</b> {ing.item}</li>
            ))}
          </ul>
          <ol className="list-decimal space-y-2 pl-5">
            {d.steps.map((s, n) => <li key={n}>{s}</li>)}
          </ol>
        </section>
      ))}
    </article>
  );
}
