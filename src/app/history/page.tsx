import { requireUserId } from "@/auth";
import { activePlans, getSettings } from "@/lib/data";
import { setActualSpend } from "@/app/actions/plans";
import { dayName, money, shortDate } from "@/lib/week";
import { FoodArt } from "@/components/FoodArt";
import { ReuseButton } from "./ReuseButton";

// Planning, approving and importing can take a while (the AI, store prices): give them a minute.
export const maxDuration = 60;

export default async function HistoryPage() {
  const userId = await requireUserId();
  const [plans, { data: settings }] = await Promise.all([activePlans(userId), getSettings(userId)]);
  const weeks = plans.filter((p) => p.status === "approved");
  const spent = weeks.filter((w) => w.actualSpend != null).map((w) => w.actualSpend!);
  const avg = spent.length ? spent.reduce((a, b) => a + b, 0) / spent.length : null;
  const budget = settings.weeklyBudget;
  const saved = spent.reduce((a, s) => a + (budget - s), 0);
  // Oldest to newest, last 8 weeks with a receipt total, for the little chart.
  const chart = weeks.filter((w) => w.actualSpend != null).slice(0, 8).reverse();
  const chartMax = Math.max(budget, ...chart.map((w) => w.actualSpend!));

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Look how far you&apos;ve come</p>
        <h1 className="text-4xl font-semibold">History</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-3xl bg-olive p-5 text-cream shadow-soft">
          <p className="font-bold opacity-90">Average week</p>
          <p className="font-display text-5xl font-semibold">{money(avg)}</p>
          <p className="opacity-90">{spent.length ? `Budget is ${money(budget)}` : "Add your receipt totals below to see this."}</p>
        </div>
        <div className={`rounded-3xl p-5 shadow-soft ${saved >= 0 ? "bg-ochre-soft" : "bg-terracotta-soft"}`}>
          <p className="font-bold text-ochre-dark">{saved >= 0 ? "Saved under budget" : "Over budget so far"}</p>
          <p className="font-display text-5xl font-semibold">{spent.length ? `${money(Math.abs(saved))}${saved > 0 ? " 🎉" : ""}` : "—"}</p>
          <p className="text-muted">{spent.length ? `Across ${spent.length} week${spent.length === 1 ? "" : "s"}` : "We'll add it up for you."}</p>
        </div>
      </div>

      {chart.length >= 2 && (
        <section className="card p-5" aria-labelledby="spend-chart">
          <h2 id="spend-chart" className="mb-4 text-xl font-semibold">What you spent each week</h2>
          <div className="relative flex h-40 items-end gap-2 sm:gap-3">
            <div className="absolute inset-x-0 border-t-2 border-dashed border-terracotta/50" style={{ bottom: `${(budget / chartMax) * 100}%` }}>
              <span className="absolute -top-6 right-0 rounded-full bg-card px-2 text-xs font-bold text-terracotta-dark">Budget {money(budget)}</span>
            </div>
            {chart.map((w) => {
              const over = w.actualSpend! > budget;
              return (
                <div key={w.id} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-xs font-bold text-muted">{money(w.actualSpend)}</span>
                  <div
                    className={`w-full max-w-12 rounded-t-xl ${over ? "bg-terracotta" : "bg-olive"}`}
                    style={{ height: `${(w.actualSpend! / chartMax) * 100}%` }}
                    title={`Week of ${shortDate(w.weekOf)}: ${money(w.actualSpend)}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex gap-2 sm:gap-3">
            {chart.map((w) => <span key={w.id} className="flex-1 text-center text-xs text-muted">{shortDate(w.weekOf)}</span>)}
          </div>
        </section>
      )}

      {weeks.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 p-8 text-center">
          <FoodArt kind="rice" className="h-24 w-24" rounded="rounded-full" />
          <p className="font-display text-2xl font-semibold">Your weeks will live here</p>
          <p className="text-lg text-muted">Once you approve a week, you&apos;ll see it here, and you can reuse the good ones.</p>
        </div>
      ) : (
        <ul className="space-y-4">
          {weeks.map((w) => {
            const dinners = w.days.filter((d) => d.recipeId);
            return (
              <li key={w.id} className="card space-y-4 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-2xl font-semibold">Week of {shortDate(w.weekOf)}</h2>
                  {w.estimatedTotal != null && <span className="text-muted">Estimated {money(w.estimatedTotal)}</span>}
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {dinners.map((d) => (
                    <li key={d.date} className="flex items-center gap-3">
                      <FoodArt name={d.recipeName} className="h-10 w-10" rounded="rounded-xl" />
                      <span className="min-w-0"><span className="font-bold text-terracotta-dark">{dayName(d.date).slice(0, 3)}</span> · {d.recipeName}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-4">
                  <form action={setActualSpend.bind(null, w.id)} className="flex items-end gap-2">
                    <div>
                      <label htmlFor={`spend-${w.id}`} className="label text-sm">What did the receipt say?</label>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-bold text-muted">$</span>
                        <input id={`spend-${w.id}`} name="actualSpend" inputMode="decimal" className="field w-32 pl-7" defaultValue={w.actualSpend ?? ""} />
                      </div>
                    </div>
                    <button className="btn-secondary min-h-11 text-sm">Save</button>
                  </form>
                  <ReuseButton planId={w.id} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
