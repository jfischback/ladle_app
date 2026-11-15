import type { GroceryList, GroceryItem, SaleItem } from "./types";

export type Place = "pantry" | "fridge" | "freezer";
export type PantryLike = { name: string; place: Place; status: "have" | "low" | "out"; onSaleOnly: boolean };

const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
// Words that describe quality or brand, not what the thing is ("Good olive oil" is olive oil).
const FLUFF = new Set("good real quality premium high-quality nice fancy favorite fresh large small medium jar jarred bottle bottled can canned box bag package pack of the a an extra virgin".split(" "));
const stem = (w: string) => (/ies$/.test(w) ? w.replace(/ies$/, "y") : /oes$/.test(w) ? w.replace(/oes$/, "o") : w.replace(/s$/, ""));

/** The core words of a pantry or grocery name: "Good olive oil, like California Olive Ranch (buy on sale)" -> ["olive", "oil"]. */
export function coreWords(name: string): string[] {
  const head = plain(name).replace(/\([^)]*\)/g, " ").split(/,|\blike\b| - |;/)[0];
  return head.replace(/[^a-z\s'-]/g, " ").split(/\s+/).filter((w) => w && !FLUFF.has(w)).map(stem);
}

// Brand and style words on a pantry item ("Rao's", "La La's Traditional Style") don't decide what it is.
const BRANDISH = /'$|^.{1,2}$|^(traditional|style|homestyle|homemade|original|classic|organic|brand|kirkland|kroger|simple|truth|private|selection)$/;
// Words that make it a different thing: peanut butter isn't butter, beef stock isn't chicken stock.
const DIFFERENT = new Set("peanut almond cashew apple coconut sesame vegetable canola avocado chili hot sweet sour cream cottage chicken beef pork bone brown powdered garlic onion red white green black corn flour rice whole wheat".split(" "));

/** Does a grocery item match a pantry item? The pantry item's words (minus brand words) must all be in the grocery
 * item, and the grocery item can't add a word that makes it a different thing. */
export function sameThing(groceryName: string, pantryName: string): boolean {
  const p = coreWords(pantryName).filter((w) => !BRANDISH.test(w));
  if (!p.length) return false;
  const gWords = coreWords(groceryName.split(",")[0]);
  const g = new Set(gWords);
  if (!p.every((w) => g.has(w))) return false;
  return !gWords.some((w) => DIFFERENT.has(w) && !p.includes(w));
}

// Things that last more than a week, so it's worth asking whether they're already on hand.
const LONG_LASTING = /salt|pepper\b|peppercorn|spice|seasoning|powder|cumin|paprika|oregano|thyme|basil, dried|dried|cinnamon|nutmeg|chili flakes|bay lea|\boil\b|vinegar|soy sauce|tamari|worcestershire|hot sauce|sriracha|ketchup|mustard|mayo|bbq sauce|barbecue sauce|teriyaki|hoisin|honey|syrup|molasses|\bsugar\b|flour|cornstarch|baking (soda|powder)|yeast|vanilla|\brice\b|pasta|noodles|spaghetti|penne|macaroni|canned|\bcans?\b|beans, |broth|stock|bouillon|tortillas?|breadcrumbs|panko|peanut butter|jam|jelly|salsa|marinara|pasta sauce|tomato (paste|sauce)|diced tomatoes|parmesan|sour cream|cream cheese|butter|guacamole|frozen|sorbet|ice cream|oats|cereal|crackers|coffee|tea\b/i;

/** What to search the store for: "Good olive oil, like California Olive Ranch" -> "olive oil" (brand names kept when that's all there is). */
export function pantrySearchTerm(name: string): string {
  const head = plain(name).replace(/\([^)]*\)/g, " ").split(/,|\blike\b| - |;/)[0];
  const words = head.replace(/[^a-z\s'-]/g, " ").split(/\s+/).filter((w) => w && !FLUFF.has(w));
  return words.join(" ").trim();
}

const NAME_FLUFF = new Set("a an of pinch pinches dash dashes freshly fresh chopped minced diced sliced divided to taste plus more for serving about large small medium whole optional packed softened melted room temperature cold warm".split(" "));

/** A tidy pantry name from a grocery line: "A pinch of freshly ground black pepper" -> "Ground black pepper". */
export function pantryName(item: string): string {
  const head = plain(item).replace(/\([^)]*\)/g, " ").split(/,|;/)[0];
  const words = head.replace(/[^a-z\s'-]/g, " ").split(/\s+/).filter((w) => w && !NAME_FLUFF.has(w));
  const name = words.join(" ").trim() || item.trim();
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export const isLongLasting = (name: string) => LONG_LASTING.test(name);

export function guessPlace(name: string): Place {
  if (/frozen|sorbet|ice cream|popsicle/i.test(name)) return "freezer";
  if (/sour cream|butter(?! beans)|cheese|guacamole|yogurt|bacon|eggs?\b|milk|cream\b|salsa, fresh|hummus|tofu|deli/i.test(name) && !/peanut butter/i.test(name)) return "fridge";
  return "pantry";
}

export const PLACE_LABEL: Record<Place, string> = { pantry: "Pantry", fridge: "Fridge", freezer: "Freezer" };

/** One-tap ideas. The ⭐ ones are "buy only on sale" stock-up items. */
export const PANTRY_IDEAS: { name: string; place: Place; onSaleOnly: boolean }[] = [
  { name: "Real maple syrup", place: "pantry", onSaleOnly: true },
  { name: "Good olive oil", place: "pantry", onSaleOnly: true },
  { name: "Premium pasta", place: "pantry", onSaleOnly: true },
  { name: "Jarred pasta sauce", place: "pantry", onSaleOnly: true },
  { name: "San Marzano tomatoes", place: "pantry", onSaleOnly: true },
  { name: "Good butter", place: "fridge", onSaleOnly: true },
  { name: "Basmati or jasmine rice", place: "pantry", onSaleOnly: true },
  { name: "Chicken stock", place: "pantry", onSaleOnly: true },
  { name: "Flour tortillas", place: "pantry", onSaleOnly: false },
  { name: "Corn tortillas", place: "pantry", onSaleOnly: false },
  { name: "Salt", place: "pantry", onSaleOnly: false },
  { name: "Black pepper", place: "pantry", onSaleOnly: false },
  { name: "Garlic powder", place: "pantry", onSaleOnly: false },
  { name: "Soy sauce", place: "pantry", onSaleOnly: false },
  { name: "Ketchup", place: "fridge", onSaleOnly: false },
  { name: "Mayonnaise", place: "fridge", onSaleOnly: false },
  { name: "Sour cream", place: "fridge", onSaleOnly: false },
  { name: "Shredded cheese", place: "fridge", onSaleOnly: false },
  { name: "Frozen vegetables", place: "freezer", onSaleOnly: false },
];

const PANTRY_CHECK = "Pantry check";
const HAVE_IT = "Already in your pantry";
const STOCK_UP = "Stock up (on sale)";
export const PANTRY_SECTIONS = { PANTRY_CHECK, HAVE_IT, STOCK_UP };

/**
 * Apply the pantry to a fresh grocery list:
 * - items you have move to "Already in your pantry" (not bought);
 * - items marked low or out stay, noted;
 * - long-lasting items the pantry doesn't know yet move to "Pantry check" (Have it / Need it);
 * - "buy on sale" items that are on sale and running low are added under "Stock up (on sale)".
 * Weekly staples are always bought.
 */
export function applyPantry(list: GroceryList, pantry: PantryLike[], stockUp: SaleItem[], saleNote: (s: SaleItem) => string): GroceryList {
  const have: GroceryItem[] = [];
  const check: GroceryItem[] = [];
  const sections = list.sections.map((sec) => {
    // Staples, snacks/sweets/drinks/baby and deals have their own buying rules; the pantry check leaves them alone.
    if (/weekly staples|^snacks$|^sweets$|^drinks$|^baby$|breakfast meat deal|stock up|athlete fuel|^(thanksgiving|christmas) dinner/i.test(sec.name)) return sec; // the holiday feast's list is kept whole: it changes with the guest count
    const keep: GroceryItem[] = [];
    for (const it of sec.items) {
      const match = pantry.find((p) => sameThing(it.item, p.name));
      if (match?.status === "have") have.push({ ...it, note: "You have this" });
      else if (match) keep.push({ ...it, note: [it.note, match.status === "low" ? "Running low" : "You're out"].filter(Boolean).join(" · ") });
      else if (/pantry/i.test(sec.name) || isLongLasting(it.item)) {
        // Ask once per thing: "salt", "kosher salt" and "a pinch of salt" are one question.
        const n = pantryName(it.item);
        if (!check.some((c) => pantryName(c.item) === n)) check.push({ ...it, note: it.note || "Do you have it?" });
      }
      else keep.push(it);
    }
    return { ...sec, items: keep };
  }).filter((sec) => sec.items.length);

  const stock: GroceryItem[] = stockUp.map((s) => ({ item: s.product, quantity: s.size, note: saleNote(s), forRecipes: [] }));
  const staples = sections.filter((s) => /weekly staples/i.test(s.name));
  const rest = sections.filter((s) => !/weekly staples/i.test(s.name));
  return {
    ...list,
    sections: [
      ...staples,
      ...(stock.length ? [{ name: STOCK_UP, items: stock }] : []),
      ...rest,
      ...(check.length ? [{ name: PANTRY_CHECK, items: check }] : []),
      ...(have.length ? [{ name: HAVE_IT, items: have }] : []),
    ],
  };
}
