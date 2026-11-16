import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { getSettings, myCooks } from "@/lib/data";
import { currentWeekStart, shortDate, today, upcomingWeekStart, weekDates, weekday } from "@/lib/week";
import { PlanWeekCheckIn } from "./PlanWeekCheckIn";

export const metadata = { title: "Plan my week · Ladle" };
// Planning checks prices and asks the AI: give it a minute.
export const maxDuration = 60;

/** "Plan my week": a quick check-in about this particular week, then the plan. */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ now?: string }> }) {
  const userId = await requireUserId();
  const { data: settings, complete } = await getSettings(userId);
  if (!complete) redirect("/setup");
  const sp = await searchParams;
  const todayStr = today();
  const now = sp.now === "1";
  const start = now ? currentWeekStart(settings.shoppingDay) : upcomingWeekStart(settings.shoppingDay);
  const dates = weekDates(start).filter((d) => !now || d >= todayStr);
  const creators = (await myCooks(userId)).map((c) => c.name);
  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <p className="eyebrow mt-3">{now ? `The rest of this week, ${shortDate(dates[0])} to ${shortDate(dates[dates.length - 1])}` : `Week of ${shortDate(start)}`}</p>
        <h1 className="text-4xl font-semibold">Plan my week</h1>
        <p className="mt-1 text-lg text-muted">A few quick questions about this week. Your answers only change this plan; your Settings stay as they are.</p>
      </div>
      <PlanWeekCheckIn
        thisWeek={now}
        days={dates.map((d) => ({ date: d, weekday: weekday(d) }))}
        defaults={{
          cookDays: settings.cookDays,
          busyDays: settings.busyDays,
          budget: settings.weeklyBudget,
          tryNew: settings.newRecipesPerWeek > 0,
          desserts: settings.dessertNights,
          adults: settings.adults,
          kids: settings.kids,
        }}
        athletes={settings.athletes.length}
        creators={creators}
      />
    </div>
  );
}
