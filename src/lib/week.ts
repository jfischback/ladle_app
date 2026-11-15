import { DAY_NAMES } from "./settings";

const TZ = process.env.APP_TIMEZONE ?? "America/Phoenix";

/** Today's date (YYYY-MM-DD) in the app's timezone. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

function parse(d: string): Date {
  return new Date(`${d}T12:00:00Z`);
}

export function addDays(d: string, n: number): string {
  const x = parse(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function weekday(d: string): number {
  return parse(d).getUTCDay();
}

export function dayName(d: string): string {
  return DAY_NAMES[weekday(d)];
}

export function shortDate(d: string): string {
  return parse(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** The next shopping day on or after today: the start of the week we plan for. */
export function upcomingWeekStart(shoppingDay: number, from = today()): string {
  const diff = (shoppingDay - weekday(from) + 7) % 7;
  return addDays(from, diff);
}

/** The most recent shopping day on or before today: the week in progress. */
export function currentWeekStart(shoppingDay: number, from = today()): string {
  const diff = (weekday(from) - shoppingDay + 7) % 7;
  return addDays(from, -diff);
}

export function weekDates(start: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function money(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
