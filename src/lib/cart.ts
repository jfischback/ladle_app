import type { CartProduct, GroceryList } from "./types";
import type { KrogerProduct } from "./kroger";
import { ruleProblems, type FoodRule } from "./diet";
import { ingredientTerm, productMatches } from "./sales";
import { pantrySearchTerm, PANTRY_SECTIONS } from "./pantry";
import { extraSearchTerm } from "./extras";

// Sections that aren't bought: things already on hand, and pantry questions not answered yet.
const NOT_BOUGHT = new Set([PANTRY_SECTIONS.HAVE_IT, PANTRY_SECTIONS.PANTRY_CHECK]);
const EXTRA_SECTIONS = /^(snacks|sweets|drinks|baby|pets)$/i;

// Things sold in packs: how many come in one (12 eggs to a carton, 10 tortillas to a pack...).
const PACK_OF: [RegExp, number][] = [
  [/\beggs?\b/, 12], [/tortillas?/, 10], [/taco shells?|tostadas?/, 12], [/hot dog buns?|hamburger buns?|\bbuns?\b|\brolls?\b/, 8],
  [/hot dogs?|franks?/, 8], [/bagels?|english muffins?/, 6], [/pitas?|naan|flatbreads?/, 5], [/slices?.*(bread|toast)|bread|toast/, 20],
  [/bacon/, 12], [/string cheese|cheese sticks?/, 12], [/yogurt cups?/, 4], [/juice boxes?/, 8],
];
const COUNT_WORD = /^(ct|count|each|whole|large|medium|small|bunch(es)?|heads?|slices?|stalks?|ears?|fillets?|breasts?|thighs?|links?)$/;
const PACKAGE_WORD = /^(cans?|jars?|box(es)?|bags?|bottles?|packs?|packages?|pkgs?|loaf|loaves|cartons?|containers?|tubs?|pints?|pouch(es)?|half-gallon|gallons?)$/;

/** A leading amount: "3", "1 1/2", "1/2", "2.5" (null if the line doesn't start with one). */
function leadingAmount(t: string): { n: number; rest: string } | null {
  const m = t.match(/^(\d+(?:\.\d+)?)(?:\s+(\d+)\/(\d+))?|^(\d+)\/(\d+)/);
  if (!m) return null;
  const n = m[4] ? Number(m[4]) / Number(m[5]) : Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0);
  return { n, rest: t.slice(m[0].length).trim() };
}

/**
 * How many to put in the cart, from a grocery line's quantity (and item, for things sold in packs):
 * "3" onions -> 3; "3 1/2 (10 oz) cans" -> 4; "8 + 4" tortillas -> 2 packs; "18" eggs -> 2 cartons; "2 dozen" eggs -> 2;
 * weights and cups ("1 1/2 lb", "2 cups") -> 1 package (adjust on review).
 */
export function cartQuantity(quantity: string, item = ""): number {
  const name = item.toLowerCase();
  const pack = PACK_OF.find(([re]) => re.test(name))?.[1] ?? null;
  let pieces = 0; // single things: 3 onions, 8 tortillas, 18 eggs
  let packages = 0; // already counted in store packages: 4 cans, 2 jars, 1 loaf
  for (const part of quantity.toLowerCase().split(/\s*\+\s*/)) {
    const a = leadingAmount(part.trim());
    if (!a) continue;
    const unit = a.rest.replace(/\([^)]*\)/g, " ").trim().split(/\s+/)[0] ?? "";
    if (unit === "dozen") pieces += a.n * 12;
    else if (PACKAGE_WORD.test(unit)) packages += a.n;
    else if (!unit || COUNT_WORD.test(unit)) pieces += a.n;
    // lb, oz, cups...: weighed or measured, bought as one package (adjust on review)
  }
  // Pieces of something sold in packs become packs (18 eggs -> 2 cartons); other pieces are bought one by one.
  const fromPieces = pieces > 0 ? (pack ? Math.ceil(pieces / pack) : Math.ceil(pieces)) : 0;
  const n = fromPieces + Math.ceil(packages);
  return Math.min(Math.max(n, 1), 12);
}

/** What to search Fry's for. */
export function cartSearchTerm(section: string, item: string): string {
  if (EXTRA_SECTIONS.test(section)) return extraSearchTerm(item);
  return ingredientTerm(item) ?? pantrySearchTerm(item);
}

/** The grocery list items that go in the cart. */
export function cartItems(list: GroceryList): { key: string; section: string; item: string; quantity: number; raw: string; term: string }[] {
  const out: { key: string; section: string; item: string; quantity: number; raw: string; term: string }[] = [];
  const seen = new Set<string>();
  for (const sec of list.sections) {
    if (NOT_BOUGHT.has(sec.name)) continue;
    for (const it of sec.items) {
      const key = `${sec.name}::${it.item}`;
      const term = cartSearchTerm(sec.name, it.item);
      if (seen.has(key) || term.length < 2) continue;
      seen.add(key);
      out.push({ key, section: sec.name, item: it.item, quantity: cartQuantity(it.quantity, it.item), raw: it.quantity, term });
    }
  }
  return out;
}

/** Price per ounce (or per item), from a package size like "16 oz", "2 lb", "1 gal", "12 ct". Null if unknown. */
export function unitPrice(size: string, price: number): { per: number; unit: "oz" | "ct" } | null {
  const s = size.toLowerCase();
  const m = s.match(/(\d+(?:\.\d+)?)\s*(fl\.? ?oz|oz|ounces?|lbs?|pounds?|gal(?:lon)?s?|qt|quarts?|pt|pints?|ml|l\b|liters?|g\b|grams?|kg|ct|count|pk|pack|each|ea)\b/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!n) return null;
  const u = m[2];
  const oz = /^fl|^oz|^ounce/.test(u) ? n : /^lb|^pound/.test(u) ? n * 16 : /^gal/.test(u) ? n * 128 : /^qt|^quart/.test(u) ? n * 32 : /^pt|^pint/.test(u) ? n * 16
    : u === "ml" ? n / 29.57 : /^l$|^liter/.test(u) ? n * 33.8 : /^g$|^gram/.test(u) ? n / 28.35 : u === "kg" ? n * 35.27 : null;
  if (oz) return { per: price / oz, unit: "oz" };
  return { per: price / n, unit: "ct" };
}

/** Ounces in a weight like "1 1/2 lb", "12 oz" (summed over "a + b"), or null if none of it is a weight. */
export function ouncesNeeded(quantity: string): number | null {
  let oz = 0;
  for (const part of quantity.toLowerCase().split(/\s*\+\s*/)) {
    const a = leadingAmount(part.trim());
    if (!a) continue;
    const unit = a.rest.replace(/\([^)]*\)/g, " ").trim().split(/\s+/)[0] ?? "";
    if (/^(lbs?|pounds?)$/.test(unit)) oz += a.n * 16;
    else if (/^(oz|ounces?)$/.test(unit)) oz += a.n;
  }
  return oz > 0 ? oz : null;
}

/** How many of a product cover a weighed amount: 4 lb of beef in 1 lb packs -> 4 (a little short is fine). */
export function packagesForWeight(quantity: string, productSize: string): number | null {
  const need = ouncesNeeded(quantity);
  const size = unitPrice(productSize, 1);
  if (!need || !size || size.unit !== "oz") return null;
  const perPack = 1 / size.per; // ounces in one package
  return Math.min(12, Math.max(1, Math.ceil(need / perPack - 0.15)));
}

const toCart = (p: KrogerProduct): CartProduct => ({ upc: p.upc, description: p.description, size: p.size, price: p.promo ?? p.regular, regular: p.regular, onSale: p.promo != null, aisle: p.aisle ?? null });

/**
 * Up to three products for one line. Products that really match come first, and among those a sale comes first
 * (the store's own order is kept otherwise: its top hit is usually the everyday pick). If nothing truly matches,
 * the store's top results are offered but none is chosen, so the family picks.
 */
/**
 * The products to offer for a grocery line, best first, and which one to pick. A product whose name breaks one of the
 * family's food rules (an allergy, a diet) is never picked for them and is marked, so it can't slip into the cart
 * unnoticed. (Names don't list every allergen: the label is still the last word.)
 */
export function pickOptions(term: string, products: KrogerProduct[], preferProduct?: string | null, cheapest = false, rules: FoodRule[] = []): { options: CartProduct[]; chosen: number | null } {
  const warnOf = (p: KrogerProduct) => (rules.length ? ruleProblems({ name: `${p.brand} ${p.description}`, ingredients: [] }, rules)[0] ?? null : null);
  const withWarn = (p: KrogerProduct): CartProduct => ({ ...toCart(p), warn: warnOf(p) });
  const matching = products.filter((p) => productMatches(term, p));
  if (!matching.length) return { options: products.slice(0, 3).map(withWarn), chosen: null };
  // "Every dollar counts": the lowest price per ounce wins (store brands usually), whatever the brand.
  const per = (p: KrogerProduct) => unitPrice(p.size, p.promo ?? p.regular)?.per ?? (p.promo ?? p.regular);
  const ranked = cheapest
    ? [...matching].sort((a, b) => per(a) - per(b))
    : matching
        .map((p, i) => ({ p, i, score: (preferProduct && p.description === preferProduct ? -100 : 0) + (p.promo != null ? -10 : 0) + i }))
        .sort((a, b) => a.score - b.score)
        .map((x) => x.p);
  // Safe products first; offer up to three.
  const options = [...ranked.filter((p) => !warnOf(p)), ...ranked.filter((p) => warnOf(p))].slice(0, 3).map(withWarn);
  const safe = options.findIndex((o) => !o.warn);
  return { options, chosen: safe >= 0 ? safe : null };
}

export { cartTotal } from "./cart-total";
