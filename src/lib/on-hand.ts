import type { Ingredient } from "./types";
import { coreWords, sameThing } from "./pantry";

// Things every kitchen has, so they never count as "need to buy".
const ALWAYS = /^(salt|kosher salt|sea salt|pepper|black pepper|salt and pepper|water|ice|cooking spray)\b/i;

/** Split "chicken, rice and broccoli" into what someone typed they have. */
export function parseOnHand(text: string): string[] {
  return text
    .split(/,|\band\b|\n|;/i)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 2)
    .slice(0, 30);
}

// Words that turn an ingredient into a different thing from what was typed: "chicken" isn't chicken broth,
// "butter" isn't peanut butter, "potatoes" aren't sweet potatoes, "rice" isn't cauliflower rice.
const OTHER_THING = new Set("peanut almond cashew apple coconut sesame cream cottage chicken beef pork turkey bone powder powdered garlic onion broth stock bouillon sauce paste extract juice soup seasoning salt cauliflower vinegar noodle wine sweet".split(" "));
// Cuts and shapes come after the thing itself ("chicken thighs", "broccoli florets").
// (Words as coreWords leaves them: "halves" -> "halve", "leaves" -> "leave".)
const CUTS = new Set("thigh breast tender tenderloin wing drumstick leg fillet filet cutlet strip floret chunk cube slice piece half halve quarter wedge stalk clove sprig leaf leave head bunch chop link".split(" "));

const GENERIC = new Set(["cheese"]);

/** The thing an ingredient is: its last word that isn't a cut ("corn tortillas" -> tortilla, "chicken thighs" -> chicken). */
function thingOf(words: string[]): string | null {
  for (let i = words.length - 1; i >= 0; i--) if (!CUTS.has(words[i])) return words[i];
  return words[words.length - 1] ?? null;
}

/** Does a recipe ingredient match something on hand? */
function covered(item: string, onHand: string[]): boolean {
  const itemWords = coreWords(shortName(item));
  const set = new Set(itemWords);
  const thing = thingOf(itemWords);
  return onHand.some((h) => {
    const typed = coreWords(h);
    if (itemWords.some((w) => OTHER_THING.has(w) && !typed.includes(w))) return false;
    // The thing itself has to be what's on hand: "corn" isn't corn tortillas, "tortillas" are.
    // ("cheddar" covers "cheddar cheese": the kind of cheese is the thing.)
    if (thing && !typed.includes(thing) && !(GENERIC.has(thing) && typed.length > 0 && !OTHER_THING.has(typed[typed.length - 1]) && itemWords.includes(typed[typed.length - 1]))) return false;
    return sameThing(item, h) || (typed.length > 0 && typed.every((w) => set.has(w)));
  });
}

// "boneless, skinless chicken thighs, cut in strips" -> "boneless skinless chicken thighs": drop how it's prepped, keep what it is.
const PREP = /^(chopped|diced|minced|sliced|thinly|finely|roughly|grated|cut|peeled|divided|to taste|softened|melted|drained|rinsed|cubed|optional|plus|for|at room|halved|quartered|trimmed|crushed|torn|beaten|cooked|warmed|about|or)\b/i;
function shortName(item: string): string {
  const parts = item.replace(/\([^)]*\)/g, "").split(",").map((x) => x.trim()).filter(Boolean);
  const keep: string[] = [];
  for (const part of parts) {
    if (keep.length && PREP.test(part)) break;
    keep.push(part);
  }
  return keep.join(" ").replace(/\s+/g, " ");
}

export type OnHandMatch = { have: number; total: number; need: string[] };

/** How much of a recipe can be made from what's on hand, and what's still needed (staples like salt don't count). */
export function onHandMatch(r: { ingredients: Ingredient[] }, onHand: string[]): OnHandMatch {
  const need: string[] = [];
  let have = 0;
  let total = 0;
  for (const i of r.ingredients) {
    const item = i.item.trim();
    if (!item || ALWAYS.test(item)) continue;
    total++;
    if (covered(item, onHand)) have++;
    else need.push(shortName(item));
  }
  return { have, total, need };
}

/**
 * Recipes that use what's on hand, best first: using more of the things they typed in (what they want to use up)
 * counts most, then fewer things to buy. Pantry items count toward "have" but aren't the point.
 */
export function rankByOnHand<T extends { ingredients: Ingredient[] }>(recipes: T[], typed: string[], pantry: string[] = []): { r: T; m: OnHandMatch; usesUp: number }[] {
  const onHand = [...typed, ...pantry];
  // Using up what they typed counts most; then how much of the recipe is covered; each thing to buy costs a little.
  const score = (x: { m: OnHandMatch; usesUp: number }) => x.usesUp * 2 + (3 * x.m.have) / Math.max(1, x.m.total) - x.m.need.length * 0.75;
  return recipes
    .map((r) => ({ r, m: onHandMatch(r, onHand), usesUp: typed.filter((t) => r.ingredients.some((i) => covered(i.item.trim(), [t]))).length }))
    .filter((x) => (typed.length ? x.usesUp > 0 : x.m.have > 0))
    .sort((a, b) => score(b) - score(a) || a.m.need.length - b.m.need.length);
}
