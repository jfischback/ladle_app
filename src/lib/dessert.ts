import type { Recipe } from "@/db/schema";
import type { Settings } from "./settings";
import type { PlanDay, SaleItem } from "./types";
import { weekday } from "./week";
import { ruleProblems } from "./diet";
import { canCook } from "./prep";
import { recipeSales } from "./sales";
import { dinnerServings } from "./scaling";

// Friday, Saturday and Sunday nights first: dessert feels like a treat at the end of the week.
const NIGHT_ORDER = [5, 6, 0, 3, 4, 2, 1];

/**
 * The week's dessert nights: the household's dessert recipes that fit their food rules and kitchen, ones with
 * sale ingredients and ones not served lately first, no repeats, on cooking nights (weekends first). Quick
 * desserts go on busy nights; nights with a holiday feast or a night off get none.
 */
export function planDesserts(days: PlanDay[], settings: Settings, pool: Recipe[], sales: SaleItem[], recentIds: Set<string> = new Set(), count = settings.dessertNights): PlanDay[] {
  const cleared: PlanDay[] = days.map((d) => ({ ...d, dessert: null }));
  if (count <= 0) return cleared;
  const fits = pool.filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length && canCook(r, settings.equipment) && !(r.rating != null && r.rating <= 2));
  if (!fits.length) return cleared;
  const score = (r: Recipe) => recipeSales(r, sales).length * 2 + (recentIds.has(r.id) ? -3 : 0) + (r.rating ?? 3) / 2 + Math.random();
  const ranked = [...fits].sort((a, b) => score(b) - score(a));
  const nights = cleared
    .map((d, i) => ({ d, i }))
    .filter(({ d }) => d.recipeId && !d.feast)
    .sort((a, b) => NIGHT_ORDER.indexOf(weekday(a.d.date)) - NIGHT_ORDER.indexOf(weekday(b.d.date)))
    .slice(0, count)
    .sort((a, b) => a.i - b.i);
  const used = new Set<string>();
  for (const { d, i } of nights) {
    const busy = settings.busyDays.includes(weekday(d.date));
    const pick = ranked.find((r) => !used.has(r.id) && (!busy || (r.totalMinutes ?? 30) <= 20)) ?? ranked.find((r) => !used.has(r.id));
    if (!pick) break;
    used.add(pick.id);
    const onSale = recipeSales(pick, sales);
    cleared[i] = {
      ...d,
      dessert: {
        recipeId: pick.id,
        name: pick.name,
        servings: d.eating ? dinnerServings(d.eating) : dinnerServings(settings),
        reason: onSale.length ? `On sale this week: ${onSale.slice(0, 2).join(" and ")}` : busy ? "Quick, for a busy night" : "A treat to end the week",
      },
    };
  }
  return cleared;
}
