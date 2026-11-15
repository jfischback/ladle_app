import "server-only";
import type { Recipe } from "@/db/schema";
import type { Ingredient, SaleItem } from "./types";
import type { Settings } from "./settings";
import { krogerEnabled, searchProducts, type KrogerProduct } from "./kroger";
import { stapleTerm } from "./staples";

export type { SaleItem };

/** A regular shelf price, so cost estimates can use real numbers. */
export type StorePrice = { item: string; product: string; size: string; price: number; onSale: boolean };

export type SaleScan =
  | { status: "ok"; sales: SaleItem[]; prices: StorePrice[]; checked: number; staplePrices: Map<string, { price: number; product: string }> }
  | { status: "off"; reason: "not-connected" | "no-store" }
  | { status: "failed"; message: string };

// Words that describe how an ingredient is cut or cooked, not what to buy.
const PREP_WORDS = new Set(
  "fresh freshly large small medium chopped minced diced sliced thinly thick thickly finely roughly grated shredded crushed cubed halved quartered peeled trimmed divided softened melted room temperature packed optional to taste for serving beaten cooked uncooked dry dried warm cold whole about plus more extra regular".split(" "),
);

// Pantry staples most kitchens already have. Not worth a price lookup each week.
const STAPLES = [
  /\bsalt\b/, /^(ground |cracked )?(black |white )?pepper(corns)?$/, /^water$/, /oil$/, /cooking spray/, /^(all-purpose |self-rising )?flour$/,
  /sugar$/, /^honey$/, /baking (soda|powder)/, /vanilla/, /cornstarch/, /vinegar$/, /^soy sauce$/,
  /powder$/, /cumin|paprika|oregano|thyme|cinnamon|nutmeg|bay lea|chili flakes|red pepper flakes|italian seasoning|seasoning$|allspice|^(whole |ground )?cloves$|coriander|cayenne|turmeric/,
  /skewers$|toothpicks|foil|parchment/,
  /^ice$/, /broth|stock|bouillon/,
];

const FILLER = /^(of|a|an|the|and|or|some|pinch|dash|handful|good-quality|quality|lbs?|pounds?|oz|ounces?|cups?|tbsp|tsp|cans?|jars?|packages?|pkg|bunch(es)?|heads?)$/;
// Words that only describe a cut; "boneless, skinless chicken thighs" keeps going past the comma.
const CUT_WORDS = new Set(["boneless", "skinless", "bone-in", "skin-on", "lean", "extra-lean"]);
// Ingredients that drive the price of a dinner: checked first.
const PROTEIN = /chicken|beef|steak|pork|\bribs\b|sausage|bacon|\bham\b|turkey|shrimp|salmon|fish|chuck|brisket|\broast\b|meatball|chorizo|lamb|tilapia|\bcod\b|tuna/;

/** Turn a recipe line like "boneless skinless chicken thighs (about 2 lb), trimmed" into "boneless skinless chicken thighs". */
export function ingredientTerm(i: Ingredient | string): string | null {
  // Drop accents first so "piquín" stays one word.
  let s = (typeof i === "string" ? i : i.item).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/\([^)]*\)/g, " ").replace(/[^a-z\s,;'-]/g, " ");
  const parts = s.split(/[,;]| for | or /);
  const clean = (part: string) => part.split(/\s+/).filter((w) => w && !PREP_WORDS.has(w) && !FILLER.test(w));
  let words = clean(parts[0]);
  // "boneless, skinless chicken thighs": the first piece is only cut words, so keep reading.
  for (let i = 1; i < parts.length && words.length && words.every((w) => CUT_WORDS.has(w)); i++) words = [...words, ...clean(parts[i])];
  let term = words.join(" ").trim();
  // Buy the whole thing: "garlic cloves" -> garlic, "lemon zest" -> lemon.
  term = term.replace(/^(garlic) cloves?$/, "$1").replace(/^(lemon|lime|orange)s? (zest|juice)$/, "$1");
  if (term.length < 3) return null;
  if (STAPLES.some((re) => re.test(term))) return null;
  return term;
}

// Rough singular: berries -> berry, tomatoes -> tomato, sausages -> sausage, thighs -> thigh.
const stem = (w: string) => (/ies$/.test(w) ? w.replace(/ies$/, "y") : /oes$/.test(w) ? w.replace(/oes$/, "o") : w.replace(/s$/, ""));

// Same thing, different spelling on the package.
const SPELLINGS: [RegExp, string][] = [[/\bgummi(e?s)?\b/g, "gummy"], [/\bgummies\b/g, "gummy"], [/\byoghurt/g, "yogurt"], [/\bdoughnut/g, "donut"], [/\bcheez\b/g, "cheese"]];
const spellings = (t: string) => SPELLINGS.reduce((acc, [re, to]) => acc.replace(re, to), t);

/** Does this store product really match the ingredient? Every main word of the term must appear in the name. */
export function productMatches(term: string, p: KrogerProduct): boolean {
  const name = spellings(p.description.toLowerCase()).replace(/[^a-z\s]/g, " ").split(/\s+/).map(stem);
  const nameSet = new Set(name);
  // Cut words ("boneless", "bone-in") don't change what's on sale, so they're optional here.
  const optional = new Set(["boneless", "skinless", "bone", "in", "skin", "on", "lean", "extra", "regular", "thin", "streaky", "precooked"]);
  return term.split(/[\s-]+/).every((w) => {
    const t = stem(spellings(w.replace(/'s?$/, ""))); // "rao's" -> "rao", "gummi" -> "gummy"
    // Whole word; or a 5+ letter prefix (short words must be whole: "egg" isn't "Eggo", "ham" isn't "Hamburger");
    // or the end of a compound word with a real word in front ("goldbears" has "bears", but "popcorn" isn't "corn").
    return t.length < 3 || optional.has(w) || nameSet.has(t) || (t.length >= 5 && name.some((n) => n.startsWith(t))) || (t.length >= 4 && name.some((n) => n.length >= t.length + 4 && n.endsWith(t)));
  });
}

/** The ingredients worth checking, most-used first (so the meat and produce that drive the week come first). */
export function termsForRecipes(recipes: Recipe[], max = 70): string[] {
  const count = new Map<string, number>();
  for (const r of recipes) {
    const seen = new Set<string>();
    for (const ing of r.ingredients) {
      const t = ingredientTerm(ing);
      if (t && !seen.has(t)) {
        seen.add(t);
        count.set(t, (count.get(t) ?? 0) + 1);
      }
    }
  }
  const score = ([t, n]: [string, number]) => n + (PROTEIN.test(t) ? 1000 : 0);
  return [...count.entries()].sort((a, b) => score(b) - score(a) || a[0].localeCompare(b[0])).slice(0, max).map(([t]) => t);
}

/** Which of this week's sales does a recipe use? */
export function recipeSales(recipe: Pick<Recipe, "ingredients">, sales: SaleItem[]): string[] {
  const terms = new Set(recipe.ingredients.map((i) => ingredientTerm(i)).filter(Boolean));
  return sales.filter((s) => terms.has(s.item)).map((s) => s.item);
}

/** Run lookups a few at a time. Stops starting new ones after `budgetMs`, so a slow Kroger never stalls planning. */
async function inBatches<T, R>(items: T[], size: number, fn: (t: T) => Promise<R>, budgetMs = 20000): Promise<PromiseSettledResult<R>[]> {
  const out: PromiseSettledResult<R>[] = [];
  const stopAt = Date.now() + budgetMs;
  for (let i = 0; i < items.length && Date.now() < stopAt; i += size) {
    out.push(...(await Promise.allSettled(items.slice(i, i + size).map(fn))));
  }
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Check this week's prices at the household's Fry's for the ingredients in their recipes.
 * An item counts as on sale only when it's at least saleThresholdPct off its regular price.
 */
export async function scanSales(recipes: Recipe[], settings: Settings, extraTerms: string[] = [], exclude: Map<string, RegExp> = new Map()): Promise<SaleScan> {
  if (!krogerEnabled()) return { status: "off", reason: "not-connected" };
  if (!settings.storeLocationId) return { status: "off", reason: "no-store" };
  const locationId = settings.storeLocationId;
  // Weekly staples are bought every week, so they're always checked (first).
  // Weekly staples and "buy on sale" pantry items are always checked (first).
  const stapleTerms = [...new Set([...settings.staples.filter((x) => x.active).map((x) => stapleTerm(x.item)), ...extraTerms].filter(Boolean))];
  const terms = [...new Set([...stapleTerms, ...termsForRecipes(recipes, Math.max(20, 70 - stapleTerms.length))])];
  const staplePrices = new Map<string, { price: number; product: string }>();

  const results = await inBatches(terms, 6, async (term) => ({ term, products: await searchProducts(term, locationId) }));
  const ok = results.filter((r): r is PromiseFulfilledResult<{ term: string; products: KrogerProduct[] }> => r.status === "fulfilled");
  if (!ok.length && results.length) {
    const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    return { status: "failed", message: first ? String((first.reason as Error)?.message ?? first.reason) : "No prices came back." };
  }

  const sales: SaleItem[] = [];
  const prices: StorePrice[] = [];
  for (const { value: { term, products } } of ok) {
    // "Any brand" items skip products with a never-buy word (e.g. cola gummies, dark chocolate, anything with honey for a baby).
    const never = exclude.get(term);
    const matches = products.filter((p) => productMatches(term, p) && !(never && never.test(p.description)));
    if (!matches.length) continue;
    // For a staple, the store's top match is the usual pick (cheapest could be a tiny size).
    if (stapleTerms.includes(term)) staplePrices.set(term, { price: round2(matches[0].promo ?? matches[0].regular), product: matches[0].description });

    const deals = matches
      .filter((p) => p.promo != null)
      .map((p) => ({ p, pct: ((p.regular - p.promo!) / p.regular) * 100 }))
      .filter((d) => d.pct >= settings.saleThresholdPct);
    if (deals.length) {
      // Deepest discount wins. With "prefer premium on sale", a name brand wins unless the store brand is clearly deeper.
      deals.sort((a, b) => b.pct - a.pct);
      let best = deals[0];
      if (settings.preferPremiumOnSale && !settings.tightBudget) {
        const premium = deals.find((d) => !/^(kroger|simple truth|private selection|heritage farm)/i.test(d.p.brand));
        if (premium && best.pct - premium.pct < settings.premiumDeeperPoints) best = premium;
      }
      sales.push({
        item: term,
        product: best.p.description,
        size: best.p.size,
        regularPrice: round2(best.p.regular),
        salePrice: round2(best.p.promo!),
        pctOff: Math.round(best.pct),
      });
    }

    // The cheapest matching shelf price, for realistic cost estimates.
    const cheapest = matches.reduce((a, b) => ((b.promo ?? b.regular) < (a.promo ?? a.regular) ? b : a));
    prices.push({ item: term, product: cheapest.description, size: cheapest.size, price: round2(cheapest.promo ?? cheapest.regular), onSale: cheapest.promo != null });
  }

  sales.sort((a, b) => b.pctOff - a.pctOff);
  return { status: "ok", sales, prices, checked: ok.length, staplePrices };
}
