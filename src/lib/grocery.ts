import "server-only";
import { addQuantities } from "./grocery-merge";
import { z } from "zod";
import type { Recipe } from "@/db/schema";
import type { Settings } from "./settings";
import type { GroceryList, SaleItem } from "./types";
import { ingredientTerm } from "./sales";
import { rulesSummary } from "./diet";
import { askClaude, claudeEnabled } from "./claude";
import { scaleIngredient } from "./scaling";
import { AISLES, aisleOf, notBought } from "./aisles";

const GrocerySchema = z.object({
  sections: z.array(
    z.object({
      name: z.string().describe("Store section, e.g. Meat, Produce, Dairy, Pantry, Bakery, Frozen"),
      items: z.array(
        z.object({
          item: z.string(),
          quantity: z.string().describe("Total to buy, e.g. '2 lb' or '1 jar (24 oz)'"),
          note: z.string().describe("Short buying note, or empty string"),
          forRecipes: z.array(z.string()).describe("Names of the dinners that use it"),
        }),
      ),
    }),
  ),
});

const SYSTEM = `You build the grocery list inside Ladle, a meal-planning app. You receive the week's approved dinners with their ingredients and the household's buying rules. Return one consolidated shopping list grouped by store section.

Rules:
- Combine the same ingredient across dinners into one line with a total quantity. Convert to sensible store units (e.g. "2 lb", "1 bunch", "1 can (15 oz)").
- Each recipe has makeTimes: how many times to buy its ingredients as written (0.5 means a half batch). It already covers the household's size, double batches for leftovers nights, leftover lunches and bigger athlete portions. Multiply each recipe's ingredients by its makeTimes; don't scale again.
- Only list ingredients from the recipes. Do not add extra items.
- Common pantry staples (salt, pepper, cooking oil, basic dried spices) go in a "Pantry - check first" section, since the household may already have them.
- If preferPremiumOnSale is true, add the note "premium if on sale" to items where brand quality matters (olive oil, cheese, meat). The cheap version only wins when it is at least premiumDeeperPoints percentage points deeper on sale.
- If limitFreezer is true, don't suggest stocking up on frozen items.
- If there is a baby: never include honey for the baby, and skip toddler-labeled products.
- foodRules are strict (allergies, diets). If a product could hide a problem (e.g. broth with gluten, sauces with soy or dairy), add a short note like "check label: gluten-free".
- If an item matches one of saleItems (same ingredient), make its note "On sale $X.XX (N% off)" using that sale's salePrice and pctOff, plus the product name when it helps pick the right one.
- weeklyStaples are added to the list separately. Don't list them again; if the dinners need more than the staple amount, list only the extra with the note "plus your weekly staple".
- cookExtra holds the cook's notes for the week (double batches, extra for lunch). They're already counted in makeTimes.
- Some recipes are lunches (meal "lunch"); include their ingredients too.
- Keep notes short; use an empty string when there is nothing to say.`;

export async function buildGroceryList(recipes: Recipe[], settings: Settings, sales: SaleItem[] = [], extraNotes: string[] = [], makeTimes: Map<string, number> = new Map()): Promise<GroceryList> {
  if (!claudeEnabled()) return { ...basicGroceryList(recipes, sales, makeTimes), notes: extraNotes };
  const pkg = {
    household: {
      adults: settings.adults,
      kids: settings.kids,
      baby: settings.hasBaby ? { ageMonths: settings.babyAgeMonths } : null,
    },
    preferPremiumOnSale: settings.preferPremiumOnSale,
    premiumDeeperPoints: settings.premiumDeeperPoints,
    limitFreezer: settings.limitFreezer,
    dinners: recipes.map((r) => ({ name: r.name, meal: r.meal, servings: r.servings, makeTimes: makeTimes.get(r.id) ?? 1, ingredients: r.ingredients })),
    saleItems: sales,
    cookExtra: extraNotes,
    foodRules: rulesSummary(settings.foodRules, settings.dislikes, settings.allowAnyway) || "none",
    weeklyStaples: settings.staples.filter((x) => x.active).map((x) => `${x.item} (${x.quantity})`),
  };
  const out = await askClaude({ system: SYSTEM, content: JSON.stringify(pkg), schema: GrocerySchema, effort: "low" });
  return { sections: out.sections, source: "claude", notes: extraNotes };
}

/** Fallback: merge identical items without unit conversion. */
export function saleNote(s: SaleItem): string {
  return `On sale $${s.salePrice.toFixed(2)} (${s.pctOff}% off)`;
}

export function basicGroceryList(recipes: Recipe[], sales: SaleItem[] = [], makeTimes: Map<string, number> = new Map()): GroceryList {
  const saleByTerm = new Map(sales.map((s) => [s.item, s]));
  const map = new Map<string, { item: string; quantities: string[]; forRecipes: Set<string> }>();
  for (const r of recipes) {
    // Scale to the week: the household, double batches, leftover lunches.
    const times = makeTimes.get(r.id) ?? 1;
    for (const raw of r.ingredients) {
      const ing = scaleIngredient(raw, times);
      const key = ing.item.toLowerCase().trim();
      if (!key) continue;
      const entry = map.get(key) ?? { item: ing.item, quantities: [], forRecipes: new Set() };
      const q = [ing.amount, ing.unit].filter(Boolean).join(" ");
      if (q) entry.quantities.push(q);
      entry.forRecipes.add(r.name);
      map.set(key, entry);
    }
  }
  // Sorted into store sections, in the order most stores are walked; water and skewers aren't groceries.
  const bySection = new Map<string, GroceryList["sections"][number]["items"]>();
  for (const e of [...map.values()].sort((a, b) => a.item.localeCompare(b.item))) {
    if (notBought(e.item)) continue;
    const sale = saleByTerm.get(ingredientTerm(e.item) ?? "");
    const aisle = aisleOf(e.item);
    bySection.set(aisle, [...(bySection.get(aisle) ?? []), { item: e.item, quantity: addQuantities(e.quantities), note: sale ? saleNote(sale) : "", forRecipes: [...e.forRecipes] }]);
  }
  return { sections: AISLES.filter((a) => bySection.has(a)).map((a) => ({ name: a, items: bySection.get(a)! })), source: "basic" };
}
