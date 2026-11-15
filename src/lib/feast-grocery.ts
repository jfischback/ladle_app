import "server-only";
import type { Recipe } from "@/db/schema";
import type { GroceryList, PlanDay, SaleItem } from "./types";
import { basicGroceryList } from "./grocery";
import { addQuantities } from "./grocery-merge";
import { parseAmount } from "./nutrition";
import { FEAST_SECTION, feastDishes, isFeastSection, type Feast } from "./feast";

// Things bought whole: cans, bags, crusts, stalks, a bunch, or a count with no unit.
const WHOLE = /^(\(.*\)\s*\w+|stalks?|bunch(es)?|heads?|cans?|bags?|boxes?|jars?|loaf|loaves)?$/;

/** "1 1/2 (6 oz) can" -> "2 (6 oz) cans": you can't buy half a can. Measured amounts (cups, lb) stay as they are. */
export function wholePackages(quantity: string): string {
  return quantity
    .split(/\s*\+\s*/)
    .map((part) => {
      const m = part.match(/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)\s*(.*)$/);
      const n = m ? parseAmount(m[1]) : null;
      if (!m || n == null || Number.isInteger(n) || !WHOLE.test(m[2].trim())) return part;
      const whole = Math.ceil(n);
      const unit = m[2].trim();
      return [String(whole), whole > 1 && unit && !/s$/.test(unit) ? `${unit}s` : unit].filter(Boolean).join(" ");
    })
    .join(" + ");
}

/** The feast's groceries as one section, in store order, with this week's sale prices where we found them. */
export function feastSection(feast: Feast, sales: SaleItem[] = []): GroceryList["sections"][number] {
  const pseudo = feastDishes(feast).map((d) => ({ id: `feast-${d.key}`, name: d.name, ingredients: d.scaled }) as unknown as Recipe);
  const list = basicGroceryList(pseudo, sales);
  // "butter", "butter, softened" and "butter, melted" are one thing to buy.
  const byThing = new Map<string, GroceryList["sections"][number]["items"][number] & { parts: string[] }>();
  for (const it of list.sections.flatMap((s) => s.items)) {
    if (/drippings/i.test(it.item)) continue;
    const thing = it.item.split(",")[0].trim();
    const key = thing.toLowerCase();
    const had = byThing.get(key);
    if (had) {
      had.parts.push(it.quantity);
      had.forRecipes = [...new Set([...had.forRecipes, ...it.forRecipes])];
      had.note = had.note || it.note;
    } else byThing.set(key, { ...it, item: thing, parts: [it.quantity] });
  }
  const items = [...byThing.values()].map(({ parts, ...it }) => ({ ...it, quantity: wholePackages(parts.length > 1 ? addQuantities(parts.filter(Boolean)) : parts[0]) }));
  return { name: FEAST_SECTION(feast), items };
}

/** The week's list with its feast section(s) brought up to date (added, changed or taken off). */
export function withFeastSections(list: GroceryList, days: PlanDay[], sales: SaleItem[] = []): GroceryList {
  const kept = list.sections.filter((s) => !isFeastSection(s.name));
  const feasts = days.flatMap((d) => (d.feast ? [feastSection(d.feast, sales)] : [])).filter((s) => s.items.length);
  return { ...list, sections: [...feasts, ...kept] };
}
