// Sale end dates, kept free of imports so the store code can use them.

/** "ends Tue 11/18", from a sale's last day (YYYY-MM-DD); empty when the store didn't say. */
export function saleEnds(endsOn: string | null | undefined): string {
  if (!endsOn || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return "";
  const d = new Date(`${endsOn}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  return `ends ${day} ${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** The sale's last day from Kroger's price data ({ value: "2026-11-18T23:59:59Z" } or a bare string), or null. */
export function saleEndDate(expiration: unknown): string | null {
  const v = typeof expiration === "string" ? expiration : expiration && typeof expiration === "object" ? (expiration as { value?: unknown }).value : null;
  if (typeof v !== "string") return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}
