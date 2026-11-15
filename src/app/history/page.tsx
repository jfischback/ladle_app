import { requireUserId } from "@/auth";
import { activePlans } from "@/lib/data";
import { setActualSpend } from "@/app/actions/plans";
import { dayName, money, shortDate } from "@/lib/week";
import { ReuseButton } from "./ReuseButton";

export default async function HistoryPage() {
  const userId = await requireUserId();
  const weeks = (await activePlans(userId)).filter((p) => p.status === "approved");
  const spent = weeks.filter((w) => w.actualSpend != null).map((w) => w.actualSpend!);
  const avg = spent.length ? spent.reduce((a, b) => a + b, 0) / spent.length : null;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">History</h1>
      <div className="rounded-2xl bg-olive-soft p-5">
        <p className="text-sm font-semibold uppercase tracking-wide text-olive-dark">Average weekly spend</p>
        <p className="text-4xl font-bold">{money(avg)}</p>
        <p className="text-muted">
          {spent.length ? `Across ${spent.length} week${spent.length === 1 ? "" : "s"} with a receipt total entered.` : "Enter what you actually spent each week to see this."}
        </p>
      </div>

      {weeks.length === 0 ? (
        <p className="card p-6 text-center text-lg text-muted">Approved weeks show up here.</p>
      ) : (
        <ul className="space-y-4">
          {weeks.map((w) => (
            <li key={w.id} className="card space-y-3 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold">Week of {shortDate(w.weekOf)}</h2>
                <span className="text-muted">Estimated {money(w.estimatedTotal)}</span>
              </div>
              <ul className="grid gap-1 sm:grid-cols-2">
                {w.days.filter((d) => d.recipeId).map((d) => (
                  <li key={d.date}><span className="font-semibold">{dayName(d.date).slice(0, 3)}</span> · {d.recipeName}</li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3">
                <form action={setActualSpend.bind(null, w.id)} className="flex items-end gap-2">
                  <div>
                    <label htmlFor={`spend-${w.id}`} className="label text-sm">Actually spent</label>
                    <input id={`spend-${w.id}`} name="actualSpend" inputMode="decimal" className="field w-32" defaultValue={w.actualSpend ?? ""} placeholder="$" />
                  </div>
                  <button className="btn-secondary min-h-11 text-sm">Save</button>
                </form>
                <ReuseButton planId={w.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
