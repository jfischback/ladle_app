import Link from "next/link";
import { CONDITIONS, PHASES, SPORTS, type AthleteWeek } from "@/lib/athletes";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const n = (x: number) => x.toLocaleString("en-US");

/** One athlete's week: protein per day against the goal, and what to eat to get there. */
export function AthleteWeekCard({ week }: { week: AthleteWeek }) {
  const a = week.athlete;
  const hit = week.days.filter((d) => d.short.protein <= 10).length;
  const carbs = a.conditions.includes("keto") || a.conditions.includes("diabetes");
  const salt = a.conditions.includes("lowsodium");
  const athlete = a.sport !== "weightloss" && a.sport !== "active";
  return (
    <section className="card p-5" aria-label={`${a.name || "Athlete"}'s week`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold"><span aria-hidden="true">{SPORTS[a.sport].icon}</span> {a.name || "Athlete"}&apos;s {athlete ? "fuel" : "week"}</h2>
          <p className="text-sm font-bold text-terracotta-dark">{SPORTS[a.sport].label}{a.phase !== "maintain" ? ` · ${PHASES[a.phase].label.toLowerCase()}` : ""}{a.youth ? " · teen" : ""}{a.conditions.map((c) => ` · ${CONDITIONS[c].label.toLowerCase()}`).join("")}</p>
          <p className="text-muted">{n(a.protein)} g protein · {n(a.calories)} cal on training days · protein goal hit {hit} of {week.days.length} days</p>
        </div>
        <Link href="/athletes" className="btn-quiet min-h-9 px-3 text-sm">Edit</Link>
      </div>

      {/* Protein per day: a little bar chart. */}
      <div className="mt-4 grid grid-cols-7 gap-1.5" aria-hidden="true">
        {week.days.map((d) => {
          const pct = Math.min(100, Math.round((d.total.protein / d.target.protein) * 100));
          return (
            <div key={d.date} className="flex flex-col items-center gap-1">
              <div className="flex h-20 w-full items-end overflow-hidden rounded-xl bg-oat">
                <div className={`w-full rounded-xl ${pct >= 95 ? "bg-olive" : pct >= 80 ? "bg-ochre" : "bg-terracotta"}`} style={{ height: `${Math.max(8, pct)}%` }} />
              </div>
              <span className="text-xs font-bold text-muted">{DAY[weekday(d.date)]}</span>
              <span className="text-xs">{d.event?.phase === "day" ? "🏆" : d.event?.phase === "load" ? "🍝" : d.event?.phase === "lighten" ? "⚖️" : d.training ? "🏋️" : "·"}</span>
            </div>
          );
        })}
      </div>

      <ul className="mt-4 space-y-2">
        {week.days.map((d) => (
          <li key={d.date}>
            <details className="rounded-2xl bg-cream/70 p-3">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="font-bold">{DAY[weekday(d.date)]}{d.training ? " · training" : a.trainingDays.length ? " · rest" : ""}{d.event ? ` · ${d.event.label}` : ""}</span>
                <span className={`text-sm font-bold ${d.short.protein > 10 ? "text-terracotta-dark" : "text-olive-dark"}`}>
                  {n(d.total.protein)}/{n(d.target.protein)} g · {n(d.total.kcal)} cal{carbs ? ` · ${n(d.total.carbs)} g carbs` : ""}{salt ? ` · ${n(d.total.sodium)} mg sodium` : ""}
                </span>
              </summary>
              <ul className="mt-2 space-y-1 text-sm">
                {d.meals.map((m) => (
                  <li key={m.meal} className="flex justify-between gap-3">
                    <span><b>{m.meal}:</b> {m.name}{m.portion > 1 ? <span className="font-bold text-terracotta-dark"> ×{m.portion}</span> : null}</span>
                    <span className="shrink-0 text-muted">{m.estimated ? "~" : ""}{m.protein} g{carbs ? ` · ${m.carbs} g carbs` : ""}</span>
                  </li>
                ))}
                {d.fuel.map((f, i) => (
                  <li key={f.id + i} className="flex justify-between gap-3">
                    <span><b>Fuel:</b> {f.name}{f.onSale ? <span className="tag-sale ml-1.5 px-2 py-0 text-xs">Sale</span> : null}</span>
                    <span className="shrink-0 text-muted">{f.protein} g</span>
                  </li>
                ))}
              </ul>
              {d.short.protein > 10 && <p className="mt-2 text-sm font-semibold text-terracotta-dark">Still {d.short.protein} g short: add a shake or a bigger dinner portion.</p>}
              {d.total.kcal - d.target.kcal > 300 && (a.phase === "cut" || d.event?.phase === "lighten") && <p className="mt-2 text-sm font-semibold text-ochre-dark">About {n(Math.round((d.total.kcal - d.target.kcal) / 50) * 50)} cal over: take a smaller portion, or go light on bread, rice and sauces.</p>}
              {d.short.protein <= 10 && d.short.kcal > 500 && <p className="mt-2 text-sm font-semibold text-ochre-dark">About {n(Math.round(d.short.kcal / 50) * 50)} cal short: add extra rice, pasta or potatoes at dinner.</p>}
              {d.tip && <p className="mt-2 rounded-xl bg-ochre-soft p-2 text-sm">{d.tip}</p>}
              {salt && d.total.sodium > a.sodiumPerDay && <p className="mt-2 text-sm font-semibold text-terracotta-dark">About {n(d.total.sodium - a.sodiumPerDay)} mg over your sodium goal: see the dinner tip for easy swaps.</p>}
            </details>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Estimates from your recipes&apos; ingredients. Not medical advice: your doctor or dietitian&apos;s plan comes first. Fuel snacks go on the grocery list under &ldquo;Athlete fuel&rdquo;.</p>
    </section>
  );
}
