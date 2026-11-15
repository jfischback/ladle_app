/**
 * US federal holidays, with the observed day (a Saturday holiday is observed Friday, a Sunday one Monday).
 * Used so that on a weekday holiday everyone is home for lunch (and breakfast), and the night before plans for it.
 */
type Holiday = { date: string; name: string };

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d, 12)).toISOString().slice(0, 10);

/** The nth weekday (0 = Sunday) of a month; n = -1 means the last one. */
function nthWeekday(y: number, m: number, weekday: number, n: number): string {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1, 12)).getUTCDay();
    return iso(y, m, 1 + ((weekday - first + 7) % 7) + (n - 1) * 7);
  }
  const lastDay = new Date(Date.UTC(y, m, 0, 12));
  const back = (lastDay.getUTCDay() - weekday + 7) % 7;
  return iso(y, m, lastDay.getUTCDate() - back);
}

function observed(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  const wd = d.getUTCDay();
  if (wd === 6) d.setUTCDate(d.getUTCDate() - 1);
  if (wd === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function federalHolidays(year: number): Holiday[] {
  return [
    { date: observed(iso(year, 1, 1)), name: "New Year's Day" },
    { date: nthWeekday(year, 1, 1, 3), name: "Martin Luther King Jr. Day" },
    { date: nthWeekday(year, 2, 1, 3), name: "Presidents' Day" },
    { date: nthWeekday(year, 5, 1, -1), name: "Memorial Day" },
    { date: observed(iso(year, 6, 19)), name: "Juneteenth" },
    { date: observed(iso(year, 7, 4)), name: "Independence Day" },
    { date: nthWeekday(year, 9, 1, 1), name: "Labor Day" },
    { date: nthWeekday(year, 10, 1, 2), name: "Columbus Day" },
    { date: observed(iso(year, 11, 11)), name: "Veterans Day" },
    { date: nthWeekday(year, 11, 4, 4), name: "Thanksgiving" },
    { date: observed(iso(year, 12, 25)), name: "Christmas Day" },
  ];
}

/** The holiday on this date (YYYY-MM-DD), if any. */
export function holidayOn(date: string): string | null {
  const y = Number(date.slice(0, 4));
  return [...federalHolidays(y), ...federalHolidays(y + 1)].find((h) => h.date === date)?.name ?? null;
}
