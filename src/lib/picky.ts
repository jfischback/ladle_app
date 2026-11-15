import type { Ingredient } from "./types";

/** A picky eater: what they won't eat, and the "safe foods" they'll always eat. */
export type PickyEater = { id: string; name: string; wontEat: string[]; safeFoods: string[] };

export const WONT_EAT_IDEAS = ["onions", "peppers", "mushrooms", "tomatoes", "spicy", "sauce", "green stuff", "beans", "cheese", "mixed-together food", "seafood", "eggs"];
export const SAFE_FOOD_IDEAS = ["buttered noodles", "plain rice", "cheese quesadilla", "fruit", "bread and butter", "yogurt", "chicken nuggets", "mac and cheese", "baby carrots", "PB&J"];

const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// What each "won't eat" word really means in a recipe.
const MEANS: Record<string, RegExp> = {
  onions: /\b(onions?|shallots?|scallions?|green onions?|leeks?)\b/,
  peppers: /\b(bell peppers?|(red|green|yellow|orange|poblano|jalapeno|serrano|chile|chili) peppers?|jalapenos?|poblanos?)\b/,
  mushrooms: /\bmushrooms?\b/,
  tomatoes: /\b(tomato(es)?|marinara|salsa|pasta sauce|pizza sauce)\b/,
  spicy: /\b(jalapenos?|serranos?|chipotle|cayenne|hot sauce|sriracha|red pepper flakes|chili flakes|habanero|spicy|hot honey)\b/,
  sauce: /\b(sauce|gravy|dressing|glaze)\b/,
  "green stuff": /\b(spinach|kale|cilantro|parsley|basil|broccoli|zucchini|green beans|peas|asparagus|herbs?)\b/,
  beans: /\b(?<!green )(beans|lentils|chickpeas)\b/,
  cheese: /\b(cheese|cheddar|mozzarella|parmesan|queso|cotija|feta)\b/,
  seafood: /\b(shrimp|salmon|tuna|fish|tilapia|cod|crab|seafood)\b/,
  eggs: /\beggs?\b/,
};
const meaning = (w: string) => MEANS[plain(w)] ?? new RegExp(`\\b${esc(plain(w))}s?\\b`);

// Dishes where everything is cooked together, so nothing can be set aside.
const MIXED = /\b(casserole|soup|stew|chili|curry|stir.?fry|fried rice|lasagna|pot pie|hash|skillet|bake|risotto|goulash|jambalaya|pozole|birria)\b/;

const listOf = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export type PickyTip = { name: string; kind: "aside" | "side"; words: string[]; tip: string };

/** Tips for each picky eater for one dinner: set a plain portion aside, or plan a safe side. */
export function pickyTips(recipe: { name: string; protein?: string | null; ingredients: Ingredient[] }, eaters: PickyEater[], seed = 0): PickyTip[] {
  const title = plain(recipe.name);
  // The main dish is the part before "with" ("Meatball Subs with Roasted Broccoli": the broccoli is a side).
  const mainTitle = title.split(/ with | and a side of /)[0];
  // Garnishes and optional extras are easy to leave off, so they don't count.
  const lines = recipe.ingredients.map((i) => plain(i.item)).filter((l) => !/optional|garnish|for serving|to serve|if you like/.test(l));
  const out: PickyTip[] = [];
  for (const e of eaters) {
    const words: string[] = [];
    const found = new Set<string>(); // the actual foods, e.g. "broccoli", "onions"
    let central = false;
    for (const w of e.wontEat) {
      if (plain(w) === "mixed-together food") {
        if (MIXED.test(title)) { words.push("everything mixed together"); central = true; }
        continue;
      }
      const re = meaning(w);
      const inTitle = re.test(mainTitle) || re.test(plain(recipe.protein ?? ""));
      const hits = [title, ...lines].map((l) => l.match(re)?.[0]).filter((x): x is string => !!x);
      if (!inTitle && !hits.length) continue;
      words.push(plain(w));
      // One mention per food: "jalapeno" and "jalapenos" are the same thing.
      hits.forEach((h) => { if (![...found].some((f) => f.replace(/e?s$/, "") === h.replace(/e?s$/, ""))) found.add(h); });
      if (inTitle || MIXED.test(title)) central = true;
    }
    if (!words.length) continue;
    const name = e.name || "your picky eater";
    const safe = e.safeFoods.length ? e.safeFoods[(seed + e.name.length) % e.safeFoods.length] : null;
    out.push(
      central
        ? { name, kind: "side", words, tip: `${name} may not eat this (${words.join(", ")}).${safe ? ` Add a side of ${safe} for them.` : " Plan a simple side they like."}` }
        : { name, kind: "aside", words, tip: words.includes("spicy") && words.length === 1 ? `Scoop out ${name}'s portion before the heat goes in.` : `Set aside a plain portion for ${name}, without the ${listOf([...found].slice(0, 3))}.` },
    );
  }
  return out;
}

/** How the planner should feel about a dinner for the picky eaters: hard conflicts count most; kids' votes count too. */
export function pickyScore(recipe: { name: string; protein?: string | null; ingredients: Ingredient[]; tags?: string[]; kidVotes?: Record<string, number> | null }, eaters: PickyEater[]): number {
  if (!eaters.length) return 0;
  let s = 0;
  for (const t of pickyTips(recipe, eaters)) s -= t.kind === "side" ? 1.2 : 0.2;
  if (recipe.tags?.includes("kid-friendly")) s += 0.5;
  for (const e of eaters) s += (recipe.kidVotes?.[e.id] ?? 0) * 0.8;
  return s;
}
