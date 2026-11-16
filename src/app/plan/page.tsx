import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUserId } from "@/auth";
import { activePlans, getPlan, getSettings, myCooks } from "@/lib/data";
import { addDays, currentWeekStart, dayName, shortDate, today, upcomingWeekStart, weekDates, weekday } from "@/lib/week";
import { PlanWeekCheckIn, type WeekChoice } from "./PlanWeekCheckIn";

export const metadata = { title: "Plan my week · Ladle" };
// Planning checks prices and asks the AI: give it a minute.
export const maxDuration = 60;

/** "Plan my week": pick the week, then a quick check-in about it, then the plan. */
export default async function PlanPage({ searchParams }: { searchParams: Promise<{ now?: string; from?: string }> }) {
  const userId = await requireUserId();
  const { data: settings, complete } = await getSettings(userId);
  if (!complete) redirect("/setup");
  const sp = await searchParams;
  const todayStr = today();
  const [plans, cooks] = await Promise.all([activePlans(userId), myCooks(userId)]);
  const creators = cooks.map((c) => c.name);
  const statusOf = (weekOf: string) => {
    const mine = plans.filter((p) => p.weekOf === weekOf);
    return mine.some((p) => p.status === "approved") ? ("approved" as const) : mine.length ? ("draft" as const) : ("none" as const);
  };

  // Re-planning starts from the plan that was on screen (its nights and who's eating), not the usual settings.
  // ?from= names the plan "Start over" or "Re-plan" just set aside; otherwise it's the draft waiting for an OK.
  const replaced = sp.from && /^[0-9a-f-]{36}$/i.test(sp.from) ? await getPlan(userId, sp.from) : null;
  const currentFor = (weekOf: string, dates: string[]) => {
    const p = replaced?.weekOf === weekOf ? replaced : plans.find((x) => x.weekOf === weekOf && x.status === "draft");
    if (!p) return undefined;
    return dates.flatMap((date) => {
      const d = p.days.find((x) => x.date === date);
      return d ? [{ weekday: weekday(date), cook: !!(d.recipeId || d.feast || d.leftoverOf), eating: d.eating ?? null }] : [];
    });
  };
  // The two weeks someone can plan: the rest of the week in progress, and the next one (from the next shopping day).
  const inProgress = currentWeekStart(settings.shoppingDay);
  const upcoming = upcomingWeekStart(settings.shoppingDay);
  const restDates = weekDates(inProgress).filter((d) => d >= todayStr);
  const weeks: WeekChoice[] = [];
  // On shopping day itself the two are the same week. With only a day left, there's nothing to plan this week.
  if (upcoming !== inProgress && restDates.length >= 2) {
    weeks.push({
      key: "now",
      weekOf: inProgress,
      title: "The rest of this week",
      range: `${dayName(restDates[0]).slice(0, 3)} ${shortDate(restDates[0])} to ${dayName(restDates[restDates.length - 1]).slice(0, 3)} ${shortDate(restDates[restDates.length - 1])}`,
      days: restDates.map((d) => ({ date: d, weekday: weekday(d) })),
      status: statusOf(inProgress),
      current: currentFor(inProgress, restDates),
    });
  }
  const nextDates = weekDates(upcoming);
  weeks.push({
    key: "next",
    weekOf: upcoming,
    title: upcoming === inProgress ? "This week" : "Next week",
    range: `${dayName(upcoming).slice(0, 3)} ${shortDate(upcoming)} to ${dayName(addDays(upcoming, 6)).slice(0, 3)} ${shortDate(addDays(upcoming, 6))}`,
    days: nextDates.map((d) => ({ date: d, weekday: weekday(d) })),
    status: statusOf(upcoming),
    current: currentFor(upcoming, nextDates),
  });
  const open = weeks.filter((w) => w.status !== "approved");
  const wanted = sp.now === "1" ? "now" : "next";
  const initial = (open.find((w) => w.key === wanted) ?? open[0])?.key ?? null;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <h1 className="mt-3 text-4xl font-semibold">Plan my week</h1>
        <p className="mt-1 text-lg text-muted">A few quick questions first, so the dinners fit this week.</p>
      </div>
      {initial == null ? (
        // Every week that can be planned is already approved.
        <section className="card space-y-3 p-5">
          <h2 className="text-2xl font-semibold">You&apos;re all planned</h2>
          <p className="text-lg text-muted">{weeks.map((w) => `${w.title} (${w.range})`).join(" and ")} {weeks.length === 1 ? "is" : "are"} already approved. To change a week, open it on Home and tap &ldquo;Re-plan this week&rdquo; at the bottom.</p>
          <Link href="/" className="btn-primary">Go to Home</Link>
        </section>
      ) : (
        <PlanWeekCheckIn
          weeks={weeks}
          initialWeek={initial}
          fresh={!!replaced}
          defaults={{
            cookDays: settings.cookDays,
            busyDays: settings.busyDays,
            budget: settings.weeklyBudget,
            tryNew: settings.newRecipesPerWeek > 0,
            desserts: settings.dessertNights,
            adults: settings.adults,
            kids: settings.kids,
          }}
          foodRules={{ rules: settings.foodRules, dislikes: settings.dislikes, allow: settings.allowAnyway ?? [] }}
          mode={settings.mode}
          alsoPlanned={[settings.breakfastDays.length ? `breakfast ${settings.breakfastDays.length} day${settings.breakfastDays.length === 1 ? "" : "s"}` : "", settings.lunchDays.length ? `lunch at home ${settings.lunchDays.length} day${settings.lunchDays.length === 1 ? "" : "s"}` : ""].filter(Boolean)}
          athletes={settings.athletes.length}
          creators={creators}
        />
      )}
    </div>
  );
}
