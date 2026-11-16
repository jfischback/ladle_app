import type { PlanDay } from "./types";
import { addDays } from "./week";

/** One day on the calendar: what's planned, from the newest plan that covers it. */
export type CalDay = {
  date: string;
  dinner: string | null;
  dinnerId: string | null;
  kind: "dinner" | "leftovers" | "off" | "feast" | null;
  breakfast: string | null;
  lunch: string | null;
  dessert: string | null;
  holiday: string | null;
  parties: { id: string; title: string; icon: string }[];
  approved: boolean;
};

/** "2026-11" for a date, and the month before or after. */
export const monthOf = (date: string) => date.slice(0, 7);
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

const dow = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();

/** The weeks shown for a month: Sunday to Saturday, from the week with the 1st to the week with the last day. */
export function monthGrid(month: string): string[][] {
  const first = `${month}-01`;
  const last = addDays(`${shiftMonth(month, 1)}-01`, -1);
  let start = addDays(first, -dow(first));
  const weeks: string[][] = [];
  while (start <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, i)));
    start = addDays(start, 7);
  }
  return weeks;
}

/** The Sunday-to-Saturday week holding a date. */
export const weekOfDate = (date: string): string[] => Array.from({ length: 7 }, (_, i) => addDays(date, i - dow(date)));

type PlanLike = { weekOf: string; status: string; createdAt?: Date | null; days: PlanDay[] };
type PartyLike = { id: string; title: string; date: string; icon: string };

/**
 * What's on each date. When two plans cover a day (a week replanned), an approved plan wins over a draft,
 * then the newer one.
 */
export function calendarDays(plans: PlanLike[], parties: PartyLike[] = []): Map<string, CalDay> {
  const out = new Map<string, CalDay>();
  const rank = (p: PlanLike) => (p.status === "approved" ? 2 : 1) * 1e13 + (p.createdAt?.getTime() ?? 0);
  for (const p of [...plans].sort((a, b) => rank(a) - rank(b))) {
    for (const d of p.days) {
      const kind: CalDay["kind"] = d.feast ? "feast" : d.leftoverOf ? "leftovers" : d.recipeId || d.recipeName ? "dinner" : "off";
      out.set(d.date, {
        date: d.date,
        dinner: d.recipeName ?? (kind === "off" ? "Night off" : null),
        dinnerId: d.recipeId,
        kind,
        breakfast: d.breakfast?.name ?? null,
        lunch: d.lunch ? d.lunch.name.replace(/^Lunch: your pick$/, "Your pick") : null,
        dessert: d.dessert?.name ?? null,
        holiday: d.holiday ?? null,
        parties: [],
        approved: p.status === "approved",
      });
    }
  }
  for (const party of parties) {
    const day = out.get(party.date) ?? { date: party.date, dinner: null, dinnerId: null, kind: null, breakfast: null, lunch: null, dessert: null, holiday: null, parties: [], approved: false };
    day.parties.push({ id: party.id, title: party.title, icon: party.icon });
    out.set(party.date, day);
  }
  return out;
}
