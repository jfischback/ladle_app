import type { CartProduct, GroceryList } from "./types";
import type { KrogerProduct } from "./kroger";
import { ingredientTerm, productMatches } from "./sales";
import { pantrySearchTerm, PANTRY_SECTIONS } from "./pantry";
import { extraSearchTerm } from "./extras";

// Sections that aren't bought: things already on hand, and pantry questions not answered yet.
const NOT_BOUGHT = new Set([PANTRY_SECTIONS.HAVE_IT, PANTRY_SECTIONS.PANTRY_CHECK]);
const EXTRA_SECTIONS = /^(snacks|sweets|drinks|baby)$/i;
const COUNT_UNITS = /^(ct|count|each|whole|cans?|jars?|box(es)?|bags?|bottles?|packs?|packages?|pkgs?|bunch(es)?|heads?|loaf|loaves|dozen|cartons?|containers?|tubs?|pints?|pouches|pouch|cups?\b(?= of yogurt))?$/;

/** How many to put in the cart: "3" or "2 cans" -> 2-3; "1.5 lb" or "1 cup" -> 1 (one package; adjust on review). */
export function cartQuantity(quantity: string): number {
  const m = quantity.trim().toLowerCase().match(/^(\d+)(?:\s+(.*))?$/);
  if (!m) return 1;
  const n = Number(m[1]);
  const unit = (m[2] ?? "").replace(/[().]/g, "").trim().split(/\s+/)[0] ?? "";
  if (unit === "dozen") return Math.min(Math.max(n, 1), 6);
  return COUNT_UNITS.test(unit) ? Math.min(Math.max(n, 1), 12) : 1;
}

/** What to search Fry's for. */
export function cartSearchTerm(section: string, item: string): string {
  if (EXTRA_SECTIONS.test(section)) return extraSearchTerm(item);
  return ingredientTerm(item) ?? pantrySearchTerm(item);
}

/** The grocery list items that go in the cart. */
export function cartItems(list: GroceryList): { key: string; section: string; item: string; quantity: number; term: string }[] {
  const out: { key: string; section: string; item: string; quantity: number; term: string }[] = [];
  const seen = new Set<string>();
  for (const sec of list.sections) {
    if (NOT_BOUGHT.has(sec.name)) continue;
    for (const it of sec.items) {
      const key = `${sec.name}::${it.item}`;
      const term = cartSearchTerm(sec.name, it.item);
      if (seen.has(key) || term.length < 2) continue;
      seen.add(key);
      out.push({ key, section: sec.name, item: it.item, quantity: cartQuantity(it.quantity), term });
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

const toCart = (p: KrogerProduct): CartProduct => ({ upc: p.upc, description: p.description, size: p.size, price: p.promo ?? p.regular, regular: p.regular, onSale: p.promo != null });

/**
 * Up to three products for one line. Products that really match come first, and among those a sale comes first
 * (the store's own order is kept otherwise: its top hit is usually the everyday pick). If nothing truly matches,
 * the store's top results are offered but none is chosen, so the family picks.
 */
export function pickOptions(term: string, products: KrogerProduct[], preferProduct?: string | null, cheapest = false): { options: CartProduct[]; chosen: number | null } {
  const matching = products.filter((p) => productMatches(term, p));
  if (!matching.length) return { options: products.slice(0, 3).map(toCart), chosen: null };
  // "Every dollar counts": the lowest price per ounce wins (store brands usually), whatever the brand.
  const per = (p: KrogerProduct) => unitPrice(p.size, p.promo ?? p.regular)?.per ?? (p.promo ?? p.regular);
  const ranked = cheapest
    ? [...matching].sort((a, b) => per(a) - per(b))
    : matching
        .map((p, i) => ({ p, i, score: (preferProduct && p.description === preferProduct ? -100 : 0) + (p.promo != null ? -10 : 0) + i }))
        .sort((a, b) => a.score - b.score)
        .map((x) => x.p);
  return { options: ranked.slice(0, 3).map(toCart), chosen: 0 };
}

export { cartTotal } from "./cart-total";
