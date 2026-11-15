import type { Ingredient, PlanDay } from "./types";
import type { Settings } from "./settings";
import { parseAmount } from "./nutrition";

/** Grown-up-sized portions at a family dinner: kids count a bit more than half, a baby not at all. */
export const dinnerServings = (s: Pick<Settings, "adults" | "kids">) => Math.max(1, s.adults + s.kids * 0.6);

/**
 * How many times to make each recipe this week, from what the plan really needs:
 * the family at dinner, a second night of leftovers (cook once, eat twice), tomorrow's leftover lunch,
 * athletes' extra portions, and every breakfast and lunch that uses it.
 * Never below 1: a small household makes the recipe as written and freezes the rest (or halves it by hand).
 */
export function recipeMultipliers(
  days: PlanDay[],
  servingsOf: (recipeId: string) => number | null,
  settings: Pick<Settings, "adults" | "kids">,
  athleteExtraPortions = 0,
): Map<string, number> {
  const need = new Map<string, number>();
  const add = (id: string | null | undefined, n: number) => { if (id) need.set(id, (need.get(id) ?? 0) + n); };
  const family = dinnerServings(settings);
  for (const d of days) {
    if (d.recipeId) add(d.recipeId, family + athleteExtraPortions); // a leftovers night is a second dinner from the same pot
    if (d.breakfast?.recipeId) add(d.breakfast.recipeId, d.breakfast.servings);
    if (d.lunch?.recipeId) add(d.lunch.recipeId, d.lunch.servings); // leftover lunches come from that dinner's pot too
  }
  const out = new Map<string, number>();
  for (const [id, n] of need) {
    const per = servingsOf(id) || 4;
    out.set(id, Math.max(1, Math.ceil((n / per) * 2) / 2)); // to the nearest half batch, rounded up
  }
  return out;
}

const NICE: [number, string][] = [[0, ""], [0.25, "1/4"], [1 / 3, "1/3"], [0.5, "1/2"], [2 / 3, "2/3"], [0.75, "3/4"], [1, ""]];

/** 1.5 -> "1 1/2", 0.333 -> "1/3", 3 -> "3". */
export function niceAmount(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const frac = n - whole;
  const [v, label] = NICE.reduce((best, cur) => (Math.abs(cur[0] - frac) < Math.abs(best[0] - frac) ? cur : best));
  const w = v === 1 ? whole + 1 : whole;
  return [w ? String(w) : "", label].filter(Boolean).join(" ") || "0";
}

/** An ingredient scaled by a multiplier ("1 1/2 cups" x2 = "3 cups"). Amounts we can't read are left alone. */
export function scaleIngredient(ing: Ingredient, m: number): Ingredient {
  if (m === 1 || !ing.amount.trim()) return ing;
  const range = ing.amount.match(/^\s*([\d\s/.½⅓⅔¼¾⅛]+?)\s*(?:-|to|–)\s*([\d\s/.½⅓⅔¼¾⅛]+)\s*$/);
  if (range) {
    const [a, b] = [parseAmount(range[1]), parseAmount(range[2])];
    if (a != null && b != null) return { ...ing, amount: `${niceAmount(a * m)} to ${niceAmount(b * m)}` };
  }
  const a = parseAmount(ing.amount);
  if (a == null) return ing;
  // Keep any words after the number ("2 large" -> "4 large").
  const rest = ing.amount.replace(/^[\d\s/.½⅓⅔¼¾⅛]+/, "").trim();
  return { ...ing, amount: [niceAmount(a * m), rest].filter(Boolean).join(" ") };
}
