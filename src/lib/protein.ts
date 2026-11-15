import type { Ingredient } from "./types";

/** Main protein groups the planner balances across the week. */
export type ProteinGroup = "Chicken" | "Beef" | "Pork" | "Sausage" | "Turkey" | "Fish" | "Seafood" | "Vegetarian";

const GROUPS: [RegExp, ProteinGroup][] = [
  [/turkey/, "Turkey"],
  [/sausage|chorizo|kielbasa|bratwurst/, "Sausage"],
  [/chicken|pollo/, "Chicken"],
  [/ground beef|steak|beef|brisket|chuck|oxtail|meatball|salisbury|birria|carne/, "Beef"],
  [/pork|bacon|\bham\b|carnitas|pancetta|prosciutto|puerco|ribs\b/, "Pork"],
  [/shrimp|prawn|crab|lobster|scallop|clam|mussel|oyster/, "Seafood"],
  [/salmon|\bcod\b|tilapia|fish|tuna|halibut|mahi|trout/, "Fish"],
];

/**
 * A recipe's main protein. The title decides first; broth and stock don't count.
 * The stored `protein` field wins when it names one protein ("Beef"); otherwise the title, then the ingredients.
 */
export function proteinGroup(r: { name?: string | null; title?: string | null; protein?: string | null; ingredients: Ingredient[] }): ProteinGroup {
  const stored = (r.protein ?? "").toLowerCase();
  if (/no meat|vegetarian|vegan|beans/.test(stored)) return "Vegetarian";
  // A single stored protein ("Beef") is the most reliable; "Chicken and Beef" falls through to the title.
  const storedHits = GROUPS.filter(([re]) => re.test(stored));
  if (storedHits.length === 1) return storedHits[0][1];
  const title = (r.name ?? r.title ?? "").toLowerCase();
  const fromTitle = GROUPS.find(([re]) => re.test(title))?.[1];
  if (fromTitle) return fromTitle;
  if (storedHits.length) return storedHits[0][1];
  const hay = r.ingredients.map((i) => i.item.toLowerCase()).filter((i) => !/broth|stock|bouillon|base\b/.test(i)).join(" ");
  return GROUPS.find(([re]) => re.test(hay))?.[1] ?? "Vegetarian";
}

/** Fish and seafood are best cooked in the first days after shopping. */
export const isPerishable = (g: ProteinGroup) => g === "Fish" || g === "Seafood";
