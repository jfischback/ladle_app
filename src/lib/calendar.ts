import { feastTimeline, turkeyFor } from "./feast";
import type { PlanDay } from "./types";

/** A calendar event: a date, a start time (minutes after midnight, local), and how long. */
export type CalEvent = { uid: string; date: string; startMinutes: number; minutes: number; title: string; notes?: string; url?: string };

// iCalendar text: escape \ ; , and new lines.
const esc = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

// Long lines are folded at 75 octets (continuation lines start with a space).
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
}

const stamp = (date: string, minutes: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(minutes);
  // Floating local time (no time zone): the event shows at that clock time wherever the phone is.
  return d.toISOString().replace(/[-:]/g, "").slice(0, 15);
};

/** An .ics file the phone's calendar (iPhone, Google, Outlook) can import. */
export function toIcs(events: CalEvent[], name = "Ladle dinners"): string {
  const now = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ladle//Dinner plan//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(name)}`];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.date, e.startMinutes)}`,
      `DTEND:${stamp(e.date, e.startMinutes + e.minutes)}`,
      `SUMMARY:${esc(e.title)}`,
      ...(e.notes ? [`DESCRIPTION:${esc(e.notes)}`] : []),
      ...(e.url ? [`URL:${e.url}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

const addDays = (date: string, n: number) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * The week as calendar events: each dinner starts when it's time to start cooking for a 6 PM dinner,
 * leftovers nights are a short reheat, "the day before" prep is a reminder the evening before,
 * and the meal prep session gets its own block.
 */
export function weekEvents(
  planId: string,
  days: PlanDay[],
  recipes: Map<string, { totalMinutes: number | null; prepAhead: string | null }>,
  origin: string,
  opts: { dinnerAt?: number; prep?: { date: string; minutes: number } | null } = {},
): CalEvent[] {
  const dinnerAt = opts.dinnerAt ?? 18 * 60;
  const out: CalEvent[] = [];
  for (const d of days) {
    if (d.feast) {
      out.push(...feastEvents(planId, d, origin, days.indexOf(d)));
      continue;
    }
    if (!d.recipeId && d.leftoverOf && d.recipeName) {
      out.push({ uid: `${planId}-${d.date}-dinner@ladle`, date: d.date, startMinutes: dinnerAt - 15, minutes: 15, title: `♻️ ${d.recipeName}`, notes: d.reason, url: `${origin}/` });
      continue;
    }
    if (!d.recipeId || !d.recipeName) continue;
    const r = recipes.get(d.recipeId);
    const url = `${origin}/recipes/${d.recipeId}`;
    if (d.leftoverOf) {
      out.push({ uid: `${planId}-${d.date}-dinner@ladle`, date: d.date, startMinutes: dinnerAt - 15, minutes: 15, title: `♻️ Leftovers: ${d.recipeName}`, notes: "Cook once, eat twice: just reheat.", url });
      continue;
    }
    const cook = Math.min(240, Math.max(15, r?.totalMinutes ?? 45));
    out.push({ uid: `${planId}-${d.date}-dinner@ladle`, date: d.date, startMinutes: dinnerAt - cook, minutes: cook, title: `🍲 Cook: ${d.recipeName}`, notes: [d.reason, `Recipe: ${url}`].filter(Boolean).join("\n"), url });
    if (r?.prepAhead) {
      out.push({ uid: `${planId}-${d.date}-prep@ladle`, date: addDays(d.date, -1), startMinutes: 19 * 60, minutes: 15, title: `⏰ Prep for tomorrow: ${d.recipeName}`, notes: r.prepAhead, url });
    }
  }
  if (opts.prep) out.push({ uid: `${planId}-${opts.prep.date}-mealprep@ladle`, date: opts.prep.date, startMinutes: 14 * 60, minutes: opts.prep.minutes, title: "🥡 Meal prep for the week", notes: "Your prep checklist is on Ladle's This Week page.", url: `${origin}/` });
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes);
}

/** A holiday dinner's countdown: thaw in the morning, the day-before cooking in the evening, the turkey, then dinner (at 3 PM). */
function feastEvents(planId: string, d: PlanDay, origin: string, index: number): CalEvent[] {
  const feast = d.feast!;
  const url = `${origin}/feast/${planId}/${index}`;
  const dinnerAt = 15 * 60;
  const t = turkeyFor(feast.guests);
  const out: CalEvent[] = [];
  for (const step of feastTimeline(feast, d.date)) {
    if (step.date === d.date) continue;
    const thaw = /freezer/.test(step.what);
    out.push({ uid: `${planId}-${step.date}-${thaw ? "thaw" : "ahead"}@ladle`, date: step.date, startMinutes: thaw ? 9 * 60 : 19 * 60, minutes: thaw ? 15 : 90, title: thaw ? "🦃 Move the turkey to the fridge" : `🦃 Get ahead for ${feast.holiday}`, notes: step.what, url });
  }
  if (feast.dishes.includes("turkey")) {
    const minutes = Math.round((t.roastHours + 1) * 60);
    out.push({ uid: `${planId}-${d.date}-turkey@ladle`, date: d.date, startMinutes: dinnerAt - minutes, minutes, title: "🦃 Turkey in the oven", notes: `Roast about ${t.roastHours} hours to 165°F in the thigh, then rest 30 minutes.`, url });
  }
  out.push({ uid: `${planId}-${d.date}-dinner@ladle`, date: d.date, startMinutes: dinnerAt, minutes: 120, title: `🦃 ${feast.holiday} dinner for ${feast.guests}`, notes: `Recipes and countdown: ${url}`, url });
  return out;
}
