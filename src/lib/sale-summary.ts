import type { Recipe } from "@/db/schema";
import type { SaleItem } from "./types";
import { ingredientTerm } from "./sales";

export { saleEnds, saleEndDate } from "./sale-dates";

export type RecipeSaleSummary = {
  /** Ingredients worth shopping for (pantry basics like salt and oil don't count). */
  total: number;
  /** The ones on sale this week, most expensive first (the ones that matter most). */
  onSale: SaleItem[];
  /** Rough dollars off if you buy one of each sale item. */
  saved: number;
};

/** How much of a recipe is on sale this week: "3 of 9 ingredients on sale, about $4 off". */
export function recipeSaleSummary(recipe: Pick<Recipe, "ingredients">, sales: (string | SaleItem)[]): RecipeSaleSummary {
  const terms = new Set(recipe.ingredients.map((i) => ingredientTerm(i)).filter((t): t is string => !!t));
  const seen = new Set<string>();
  const onSale = sales
    .filter((s): s is SaleItem => typeof s === "object" && !!s && terms.has(s.item))
    .filter((s) => (seen.has(s.item) ? false : (seen.add(s.item), true)))
    .sort((a, b) => b.regularPrice - a.regularPrice);
  const saved = Math.round(onSale.reduce((sum, s) => sum + Math.max(0, s.regularPrice - s.salePrice), 0) * 100) / 100;
  return { total: terms.size, onSale, saved };
}
