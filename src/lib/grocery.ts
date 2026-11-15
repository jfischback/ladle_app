import "server-only";
import { z } from "zod";
import type { Recipe } from "@/db/schema";
import type { Settings } from "./settings";
import type { GroceryList } from "./types";
import { askClaude, claudeEnabled } from "./claude";

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
- Scale each recipe from its listed servings to the household size (adults count 1, kids 0.5 to 1 by age, a baby 0). If servings is unknown, assume the recipe already feeds the household.
- Only list ingredients from the recipes. Do not add extra items.
- Common pantry staples (salt, pepper, cooking oil, basic dried spices) go in a "Pantry - check first" section, since the household may already have them.
- If preferPremiumOnSale is true, add the note "premium if on sale" to items where brand quality matters (olive oil, cheese, meat). The cheap version only wins when it is at least premiumDeeperPoints percentage points deeper on sale.
- If limitFreezer is true, don't suggest stocking up on frozen items.
- If there is a baby: never include honey for the baby, and skip toddler-labeled products.
- Keep notes short; use an empty string when there is nothing to say.`;

export async function buildGroceryList(recipes: Recipe[], settings: Settings): Promise<GroceryList> {
  if (!claudeEnabled()) return basicGroceryList(recipes);
  const pkg = {
    household: {
      adults: settings.adults,
      kids: settings.kids,
      baby: settings.hasBaby ? { ageMonths: settings.babyAgeMonths } : null,
    },
    preferPremiumOnSale: settings.preferPremiumOnSale,
    premiumDeeperPoints: settings.premiumDeeperPoints,
    limitFreezer: settings.limitFreezer,
    dinners: recipes.map((r) => ({ name: r.name, servings: r.servings, ingredients: r.ingredients })),
  };
  const out = await askClaude({ system: SYSTEM, content: JSON.stringify(pkg), schema: GrocerySchema, effort: "low" });
  return { sections: out.sections, source: "claude" };
}

/** Fallback: merge identical items without unit conversion. */
export function basicGroceryList(recipes: Recipe[]): GroceryList {
  const map = new Map<string, { item: string; quantities: string[]; forRecipes: Set<string> }>();
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      const key = ing.item.toLowerCase().trim();
      if (!key) continue;
      const entry = map.get(key) ?? { item: ing.item, quantities: [], forRecipes: new Set() };
      const q = [ing.amount, ing.unit].filter(Boolean).join(" ");
      if (q) entry.quantities.push(q);
      entry.forRecipes.add(r.name);
      map.set(key, entry);
    }
  }
  const items = [...map.values()]
    .sort((a, b) => a.item.localeCompare(b.item))
    .map((e) => ({ item: e.item, quantity: e.quantities.join(" + "), note: "", forRecipes: [...e.forRecipes] }));
  return { sections: [{ name: "Everything", items }], source: "basic" };
}
