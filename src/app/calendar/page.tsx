import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { parties } from "@/db/schema";
import { activePlans } from "@/lib/data";
import { calendarDays, monthGrid, monthOf, shiftMonth, weekOfDate, type CalDay } from "@/lib/calendar-view";
import { partyKind } from "@/lib/party";
import { addDays, today } from "@/lib/week";

export const metadata = { title: "Calendar · Ladle" };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const longDate = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const dayNum = (d: string) => Number(d.slice(8));
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const icon = (c: CalDay) => (c.kind === "feast" ? "🦃" : c.kind === "leftovers" ? "🥡" : c.kind === "off" ? "🍕" : c.kind === "dinner" ? "🍲" : "");

/** Meals at a glance, like a wall calendar: a month of dinners (and parties), or one week with every meal. */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string; view?: string }> }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const now = today();
  const view = sp.view === "week" ? "week" : "month";
  const selected = isDate(sp.d) ? sp.d : now;
  const month = typeof sp.m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.m) ? sp.m : monthOf(selected);
  const db = await getDb();
  const [plans, myParties] = await Promise.all([
    activePlans(userId),
    db.select().from(parties).where(and(eq(parties.userId, userId), isNull(parties.archivedAt))),
  ]);
  const days = calendarDays(plans, myParties.map((p) => ({ id: p.id, title: p.title, date: p.date, icon: partyKind(p.kind).icon })));
  const href = (q: Record<string, string>) => `/calendar?${new URLSearchParams({ view, ...q }).toString()}`;

  const week = weekOfDate(selected);
  const pick = days.get(selected);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">At a glance</p>
          <h1 className="text-3xl font-semibold">📅 Calendar</h1>
        </div>
        <nav aria-label="Calendar view" className="flex rounded-full bg-oat p-1">
          <Link href={`/calendar?view=month&d=${selected}`} aria-current={view === "month" ? "page" : undefined} className={`rounded-full px-4 py-1.5 font-bold ${view === "month" ? "bg-card text-terracotta-dark shadow-soft" : "text-olive-dark"}`}>Month</Link>
          <Link href={`/calendar?view=week&d=${selected}`} aria-current={view === "week" ? "page" : undefined} className={`rounded-full px-4 py-1.5 font-bold ${view === "week" ? "bg-card text-terracotta-dark shadow-soft" : "text-olive-dark"}`}>Week</Link>
        </nav>
      </div>

      {view === "month" ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <Link href={href({ m: shiftMonth(month, -1), d: `${shiftMonth(month, -1)}-01` })} className="btn-quiet min-h-10 px-3" aria-label={`Previous month, ${monthName(shiftMonth(month, -1))}`}>‹</Link>
            <h2 className="text-xl font-semibold">{monthName(month)}</h2>
            <Link href={href({ m: shiftMonth(month, 1), d: `${shiftMonth(month, 1)}-01` })} className="btn-quiet min-h-10 px-3" aria-label={`Next month, ${monthName(shiftMonth(month, 1))}`}>›</Link>
          </div>
          <div className="card overflow-hidden p-0">
            <div className="grid grid-cols-7 border-b border-line bg-oat text-center text-xs font-bold text-muted" aria-hidden="true">
              {DAYS.map((d) => <div key={d} className="py-1.5">{d}</div>)}
            </div>
            <ol className="grid grid-cols-7">
              {monthGrid(month).flat().map((date) => {
                const c = days.get(date);
                const inMonth = monthOf(date) === month;
                const label = [longDate(date), c?.dinner ? `dinner: ${c.dinner}` : "", c?.dessert ? `dessert: ${c.dessert}` : "", ...(c?.parties.map((p) => `party: ${p.title}`) ?? []), c?.holiday ?? ""].filter(Boolean).join(", ");
                return (
                  <li key={date} className="min-w-0 border-b border-r border-line [&:nth-child(7n)]:border-r-0">
                    <Link href={href({ m: month, d: date })} aria-label={label} aria-current={date === selected ? "date" : undefined}
                      className={`flex h-24 flex-col gap-0.5 p-1 text-left sm:h-24 sm:p-1.5 ${date === selected ? "bg-ochre-soft" : "hover:bg-cream"} ${inMonth ? "" : "text-muted"}`}>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${date === now ? "bg-terracotta text-cream" : ""}`}>{dayNum(date)}</span>
                      {c?.parties.map((p) => <span key={p.id} className="truncate rounded bg-olive px-1 text-[0.65rem] font-bold text-cream">{p.icon} {p.title}</span>)}
                      {c?.dinner && (
                        <span lang="en" className={`line-clamp-3 overflow-hidden hyphens-auto text-[0.66rem] leading-tight sm:line-clamp-2 ${c.approved ? "" : "italic text-muted"}`}>
                          <span aria-hidden="true">{icon(c)} </span>{c.dinner}
                        </span>
                      )}
                      {c?.dessert && <span className="text-[0.65rem]" aria-hidden="true">🍰</span>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
          <p className="text-sm text-muted">Tap a day for everything planned. <span className="italic">Slanted names</span> are waiting for your OK.</p>
          <DayDetails date={selected} c={pick} />
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <Link href={href({ d: addDays(selected, -7) })} className="btn-quiet min-h-10 px-3" aria-label="Previous week">‹</Link>
            <h2 className="text-xl font-semibold">Week of {new Date(`${week[0]}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</h2>
            <Link href={href({ d: addDays(selected, 7) })} className="btn-quiet min-h-10 px-3" aria-label="Next week">›</Link>
          </div>
          <ol className="space-y-2">
            {week.map((date) => <li key={date}><DayDetails date={date} c={days.get(date)} compact today={date === now} /></li>)}
          </ol>
        </>
      )}
      <p className="text-center">
        <Link href={href({ d: now, m: monthOf(now) })} className="font-bold text-olive-dark underline">Back to today</Link>
      </p>
    </div>
  );
}

function DayDetails({ date, c, compact = false, today: isToday = false }: { date: string; c: CalDay | undefined; compact?: boolean; today?: boolean }) {
  const rows: { icon: string; label: string; text: string; href?: string }[] = [];
  if (c?.breakfast) rows.push({ icon: "☕", label: "Breakfast", text: c.breakfast });
  if (c?.lunch) rows.push({ icon: "🥪", label: "Lunch", text: c.lunch });
  if (c?.dinner) rows.push({ icon: icon(c), label: "Dinner", text: c.dinner, href: c.dinnerId ? `/recipes/${c.dinnerId}` : undefined });
  if (c?.dessert) rows.push({ icon: "🍰", label: "Dessert", text: c.dessert });
  for (const p of c?.parties ?? []) rows.push({ icon: p.icon, label: "Party", text: p.title, href: `/party/${p.id}` });
  return (
    <section aria-label={longDate(date)} className={`card p-4 ${isToday ? "border-2 border-terracotta/50" : ""}`}>
      <h3 className={`${compact ? "text-base" : "text-lg"} font-bold`}>
        {longDate(date)}{isToday && <span className="ml-2 rounded-full bg-terracotta px-2 py-0.5 text-xs text-cream">Today</span>}
        {c?.holiday && <span className="ml-2 text-sm font-semibold text-olive-dark">🎉 {c.holiday}</span>}
      </h3>
      {rows.length ? (
        <ul className="mt-1 space-y-1">
          {rows.map((r, n) => (
            <li key={n} className="flex gap-2">
              <span aria-hidden="true">{r.icon}</span>
              <span><span className="font-semibold">{r.label}: </span>{r.href ? <Link href={r.href} className="underline">{r.text}</Link> : r.text}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-muted">Nothing planned yet.</p>
      )}
      {c && !c.approved && c.dinner && <p className="mt-1 text-sm italic text-muted">This week is waiting for your OK on Home.</p>}
    </section>
  );
}
