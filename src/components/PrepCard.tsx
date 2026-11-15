import type { PrepPlan } from "@/lib/prep";

const DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const hm = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}` : `${m} min`);

/** The week's meal prep session: a checklist that does the slow parts of the dinners ahead. */
export function PrepCard({ plan }: { plan: PrepPlan }) {
  const day = DAY[new Date(`${plan.date}T12:00:00Z`).getUTCDay()];
  const nights = Object.keys(plan.finish).length;
  return (
    <section className="card p-5" aria-label="Meal prep">
      <h2 className="flex items-center gap-2 text-2xl font-semibold"><span aria-hidden="true">🥡</span> {day} prep · about {hm(plan.minutes)}</h2>
      <p className="mt-1 text-muted">Do these once and {nights ? `${nights} dinner${nights === 1 ? "" : "s"} only need finishing on the night` : "weeknights get quicker"}.</p>
      <ol className="mt-4 space-y-2">
        {plan.tasks.map((t, i) => (
          <li key={t.title} className="flex gap-3 rounded-2xl bg-cream/70 p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-olive text-sm font-bold text-cream">{i + 1}</span>
            <span className="min-w-0">
              <span className="block font-bold">{t.title} <span className="font-normal text-muted">· {hm(t.minutes)}</span></span>
              <span className="block text-sm">{t.detail}</span>
              <span className="block text-xs text-muted">For {t.forDinners.join(", ")}</span>
            </span>
          </li>
        ))}
      </ol>
      {plan.later.length > 0 && (
        <details className="mt-3 rounded-2xl bg-oat/60 p-3 text-sm">
          <summary className="cursor-pointer font-bold text-olive-dark">If you have more time ({plan.later.length})</summary>
          <ul className="mt-2 space-y-1">{plan.later.map((t) => <li key={t.title}><b>{t.title}</b> · {t.detail}</li>)}</ul>
        </details>
      )}
      <p className="mt-3 text-xs text-muted">Cooked food keeps 3 to 4 days in the fridge; anything for later in the week goes in the freezer.</p>
    </section>
  );
}
