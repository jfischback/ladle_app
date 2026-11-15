/** Keep only sensible grocery ticks: short string keys, true/false values, a bounded number of them. */
export function cleanChecks(changes: unknown): Record<string, boolean> {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(changes as Record<string, unknown>).slice(0, 400)) {
    if (typeof v === "boolean" && k.length > 0 && k.length <= 300) out[k] = v;
  }
  return out;
}
