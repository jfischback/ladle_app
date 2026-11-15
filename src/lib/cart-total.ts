import type { CartLine } from "./types";

/** The cart's cost, item count and sale savings (safe to use in the browser). */
export function cartTotal(lines: CartLine[]): { total: number; count: number; saved: number } {
  let total = 0, count = 0, saved = 0;
  for (const l of lines) {
    const p = l.chosen != null ? l.options[l.chosen] : null;
    if (!p || l.quantity < 1) continue;
    total += p.price * l.quantity;
    saved += (p.regular - p.price) * l.quantity;
    count++;
  }
  return { total: Math.round(total * 100) / 100, count, saved: Math.round(saved * 100) / 100 };
}
