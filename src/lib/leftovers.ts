import type { Ingredient } from "./types";

/**
 * Does a dinner make good leftovers for tomorrow's lunch?
 * - "none": one night only. Steakhouse steaks, cream or milk-based sauces, burgers, hot dogs, sandwiches, sushi,
 *   fried and crispy things (they don't reheat well).
 * - "ok": reheats fine.
 * A recipe's tags can override: "leftovers" or "no-leftovers".
 */
export type LeftoverKind = "ok" | "none";

const ONE_NIGHT_TITLE = /\b(t-?bone|new york strip|ny strip|strip steak|ribeye|rib-eye|porterhouse|filet mignon|tomahawk|steakhouse)\b|^grilled steak|^steak$|burgers?\b|hot dogs?|sandwich|\bblt\b|\bsubs?\b|sushi|\bclub\b|\bsalads?\b|panzanella/i;
// Eggs, griddle food and crispy things are soggy or rubbery the next day.
const BEST_FRESH = /\bomelets?\b|scrambl|fried eggs?|eggs benedict|pancakes?|waffles?|french toast|nachos|quesadillas?|tostadas?|\bin a mug\b|\bmug\b|tenders\b|\bfries\b|instant ramen/i;
const NOT_A_STEAK_NIGHT = /fajita|stir[- ]?fry|kabob|kebab|tacos?|bowl|salad|sandwich|philly|stew|chili|pasta|skillet/i;
// A cream or milk-based sauce: named in the title, or heavy cream / half-and-half in the ingredients (a splash of milk in mashed potatoes doesn't count).
const CREAMY_TITLE = /alfredo|creamy|cream sauce|creamed|white sauce|bechamel|carbonara|vodka|rosa\b|sausage gravy|country gravy|white gravy|marry me/i;
const CREAMY_INGREDIENT = /heavy cream|whipping cream|heavy whipping|half[- ]and[- ]half|half & half/i;

export function leftoverKind(r: { name?: string | null; title?: string | null; tags?: string[]; ingredients: Ingredient[] }): LeftoverKind {
  const tags = r.tags ?? [];
  if (tags.includes("no-leftovers")) return "none";
  if (tags.includes("leftovers")) return "ok";
  const title = (r.name ?? r.title ?? "").toLowerCase();
  if (ONE_NIGHT_TITLE.test(title) && !(/steak/.test(title) && NOT_A_STEAK_NIGHT.test(title) && !/burger|hot dog|sandwich|blt|sub|sushi/.test(title))) return "none";
  if (CREAMY_TITLE.test(title) || r.ingredients.some((i) => CREAMY_INGREDIENT.test(i.item))) return "none";
  if (BEST_FRESH.test(title)) return "none";
  return "ok";
}

/** Short reason for the recipe page and plan, e.g. "One night only: cream sauce". */
export function leftoverWhy(r: { name?: string | null; title?: string | null; tags?: string[]; ingredients: Ingredient[] }): string | null {
  if (leftoverKind(r) === "ok") return null;
  const tags = r.tags ?? [];
  if (tags.includes("no-leftovers")) return "You marked it one night only";
  const title = (r.name ?? r.title ?? "").toLowerCase();
  if (/burger|hot dog/.test(title)) return "Burgers and hot dogs are best fresh";
  if (/sandwich|\bblt\b|\bsubs?\b|club/.test(title)) return "Sandwiches don't keep";
  if (/sushi/.test(title)) return "Sushi doesn't keep";
  if (/salad|panzanella/.test(title)) return "Salads don't keep";
  if (CREAMY_TITLE.test(title) || r.ingredients.some((i) => CREAMY_INGREDIENT.test(i.item))) return "Cream sauces don't reheat well";
  if (BEST_FRESH.test(title)) return "Eggs, pancakes and crispy things are best fresh";
  if (/steak/.test(title)) return "Steakhouse steaks are best fresh";
  return "Best eaten fresh";
}
