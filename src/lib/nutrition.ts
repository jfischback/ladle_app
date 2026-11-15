import type { Ingredient } from "./types";

/** Calories and macros. Per serving unless said otherwise. */
export type Nutrition = { kcal: number; protein: number; carbs: number; fat: number };
export type NutritionEstimate = Nutrition & { coverage: number }; // coverage: share of the main ingredients we recognized (0-1)

// Per 100 g: kcal, protein, carbs, fat. Gram weights: one cup, one piece ("each"), one slice, one can or package.
type Food = { re: RegExp; n: [number, number, number, number]; cup?: number; each?: number; slice?: number; can?: number; pack?: number };

const F = (re: RegExp, n: Food["n"], w: Omit<Food, "re" | "n"> = {}): Food => ({ re, n, ...w });

// Order matters: the first match wins, so specific foods come before general ones (peanut butter before butter,
// chicken broth before chicken).
const FOODS: Food[] = [
  F(/broth|stock|bouillon/, [5, 0.5, 0.4, 0.2], { cup: 240, can: 400, pack: 950 }),
  F(/protein powder|whey/, [380, 75, 12, 4], { cup: 128, each: 32 }),
  F(/jerky/, [410, 33, 11, 26], { pack: 85 }),
  F(/peanut butter|almond butter/, [588, 25, 20, 50], { cup: 258 }),
  F(/cream cheese/, [342, 6, 4, 34], { cup: 232, pack: 227 }),
  F(/sour cream/, [198, 2.4, 4.6, 19], { cup: 230 }),
  F(/heavy cream|whipping cream|heavy whipping/, [340, 2.8, 2.7, 36], { cup: 238 }),
  F(/half[- ]and[- ]half/, [130, 3, 4.3, 11.5], { cup: 242 }),
  F(/ice cream/, [207, 3.5, 24, 11], { cup: 132 }),
  F(/cottage cheese/, [98, 11, 3.4, 4.3], { cup: 226, pack: 680 }),
  F(/greek yogh?urt/, [73, 10, 4, 2], { cup: 245, each: 150 }),
  F(/yogh?urt/, [61, 3.5, 4.7, 3.3], { cup: 245, each: 150 }),
  F(/parmesan|parmigiano|pecorino|romano cheese/, [420, 38, 4, 28], { cup: 100 }),
  F(/cheese|cheddar|mozzarella|monterey|pepper jack|provolone|swiss|colby|queso|cotija|feta|gouda/, [390, 24, 2.5, 31], { cup: 113, slice: 21, pack: 227 }),
  F(/egg whites?/, [52, 11, 0.7, 0.2], { cup: 243 }),
  F(/egg noodles/, [384, 14, 71, 4.4], { cup: 38, pack: 340 }),
  F(/\beggs?\b/, [143, 12.6, 0.7, 9.5], { each: 50, cup: 243 }),
  F(/chocolate milk/, [83, 3.2, 12, 2.3], { cup: 250 }),
  F(/\bmilk\b|buttermilk/, [61, 3.2, 4.8, 3.3], { cup: 244 }),
  F(/butter\b(?! ?beans)/, [717, 0.9, 0.1, 81], { cup: 227, each: 113 }),
  F(/\boils?\b|lard|shortening|ghee/, [884, 0, 0, 100], { cup: 218 }),
  F(/mayo/, [680, 1, 0.6, 75], { cup: 220 }),
  // Meat and fish (raw weights)
  F(/chicken breast|chicken tender|chicken cutlet/, [120, 22.5, 0, 2.6], { each: 225 }),
  F(/chicken thigh|chicken leg|drumstick/, [150, 19, 0, 8], { each: 115 }),
  F(/chicken wing/, [200, 18, 0, 14], { each: 35 }),
  F(/rotisserie|shredded chicken|cooked chicken|chicken salad/, [190, 27, 0, 8], { cup: 140 }),
  F(/chicken|pollo/, [150, 20, 0, 7.5], { each: 200 }),
  F(/ground turkey|turkey breast|turkey/, [150, 19, 0, 8], { slice: 28 }),
  F(/ground beef|hamburger|beef patt|burger patt|ground chuck/, [254, 17, 0, 20], { each: 113 }),
  F(/meatball/, [250, 15, 8, 17], { each: 30 }),
  F(/hot dog|frank/, [290, 10, 4, 26], { each: 45 }),
  F(/bacon/, [417, 13, 1.4, 40], { slice: 23 }),
  F(/sausage|chorizo|kielbasa|bratwurst|pepperoni|salami/, [300, 14, 2, 26], { each: 85, cup: 135 }),
  F(/\bham\b|prosciutto|deli meat|lunch meat|cold cuts/, [120, 18, 2, 4], { slice: 28, cup: 140 }),
  F(/\bribs?\b|pork belly|pork shoulder|pork butt|carnitas/, [260, 17, 0, 21], {}),
  F(/pork/, [143, 21, 0, 6], { each: 170 }),
  F(/steak|beef|chuck|brisket|sirloin|ribeye|flank|skirt|tri-tip|roast/, [200, 21, 0, 13], { each: 225 }),
  F(/lamb/, [280, 17, 0, 23], {}),
  F(/shrimp|prawn/, [85, 20, 0, 0.5], { each: 15 }),
  F(/salmon/, [208, 20, 0, 13], { each: 170 }),
  F(/tuna/, [116, 26, 0, 1], { can: 142, pack: 74 }),
  F(/tilapia|\bcod\b|halibut|white fish|fish/, [96, 20, 0, 1.7], { each: 150 }),
  F(/tofu/, [76, 8, 1.9, 4.8], { pack: 400 }),
  F(/sushi/, [150, 6, 30, 1], { each: 30, pack: 300 }),
  // Grains and bread
  F(/cooked rice|leftover rice/, [130, 2.7, 28, 0.3], { cup: 158 }),
  F(/\brice\b|arroz/, [360, 7, 79, 0.6], { cup: 185 }),
  F(/spaghetti|penne|fettuccine|linguine|macaroni|rigatoni|pasta|noodle|orzo|ziti|lasagna/, [371, 13, 75, 1.5], { cup: 100, pack: 454 }),
  F(/oats|oatmeal/, [389, 17, 66, 7], { cup: 80 }),
  F(/granola/, [470, 10, 64, 20], { cup: 120 }),
  F(/cereal/, [380, 7, 84, 3], { cup: 30 }),
  F(/flour(?! tortilla)/, [364, 10, 76, 1], { cup: 125 }),
  F(/cornmeal|masa/, [370, 7, 79, 3.6], { cup: 157 }),
  F(/flour tortilla|tortillas?\b(?! chip)/, [300, 8, 50, 8], { each: 45, pack: 450 }),
  F(/corn tortilla/, [218, 5.7, 45, 2.9], { each: 26 }),
  F(/tostada/, [480, 6, 62, 23], { each: 13 }),
  F(/tortilla chips|chips/, [500, 7, 63, 25], { cup: 28, pack: 280 }),
  F(/crackers|saltines/, [430, 9, 70, 12], { each: 3, cup: 60, pack: 200 }),
  F(/bagel/, [250, 10, 49, 1.5], { each: 100 }),
  F(/english muffin/, [227, 8.9, 44, 1.7], { each: 57 }),
  F(/waffle|pancake mix|biscuit/, [290, 7, 45, 9], { each: 38, cup: 120 }),
  F(/buns?\b|rolls?\b|hoagie|sub roll|brioche|croissant|bread|toast|texas toast|panko|breadcrumbs/, [265, 9, 49, 3.2], { slice: 30, each: 60, cup: 110, pack: 570 }),
  // Sweet and sauces
  F(/brown sugar/, [380, 0, 98, 0], { cup: 220 }),
  F(/sugar/, [387, 0, 100, 0], { cup: 200 }),
  F(/honey|maple syrup|syrup|molasses|agave/, [300, 0.3, 80, 0], { cup: 330 }),
  F(/chocolate chips|chocolate/, [480, 5, 63, 26], { cup: 170 }),
  F(/jam|jelly|preserves/, [250, 0.4, 60, 0.1], { cup: 320 }),
  F(/bbq sauce|barbecue sauce|ketchup|teriyaki|hoisin|sweet chili/, [170, 1, 40, 0.5], { cup: 280 }),
  F(/marinara|pasta sauce|pizza sauce|tomato sauce|enchilada sauce/, [50, 1.5, 8, 1.5], { cup: 250, can: 425, pack: 680 }),
  F(/alfredo/, [180, 3, 5, 16], { cup: 250, pack: 425 }),
  F(/tahini/, [595, 17, 21, 54], { cup: 240 }),
  F(/almonds|cashews|walnuts|pecans|peanuts|nuts|pistachio/, [600, 20, 20, 52], { cup: 140 }),
  F(/raisins|dried fruit|craisins/, [300, 3, 79, 0.5], { cup: 145 }),
  // Beans and produce
  F(/beans|chickpeas|garbanzo|lentils|gandules|pigeon peas|refried/, [91, 6, 16, 0.5], { cup: 172, can: 260 }),
  F(/\bcorn\b|hominy/, [86, 3.3, 19, 1.4], { cup: 150, each: 100, can: 300 }),
  F(/tater tots|hash browns|french fries|fries/, [160, 2, 22, 7], { cup: 85, pack: 900 }),
  F(/sweet potato|yam/, [86, 1.6, 20, 0.1], { each: 130, cup: 133 }),
  F(/potato/, [77, 2, 17, 0.1], { each: 213, cup: 150, pack: 2270 }),
  F(/avocado|guacamole/, [160, 2, 8.5, 14.7], { each: 150, cup: 230 }),
  F(/banana/, [89, 1.1, 23, 0.3], { each: 118 }),
  F(/peas\b/, [81, 5, 14, 0.4], { cup: 145 }),
  F(/tomato(es)?\b/, [25, 1.2, 5, 0.2], { each: 120, cup: 240, can: 400 }),
  F(/apple|pear|orange|mango|pineapple|peach|grapes|berr|melon|fruit|cherr|kiwi/, [55, 0.8, 14, 0.2], { each: 150, cup: 150 }),
  F(/onion|pepper|broccoli|spinach|carrot|celery|zucchini|squash|mushroom|cabbage|lettuce|cucumber|green beans|cauliflower|kale|asparagus|slaw|vegetable|veggie|jalapeno|chiles?|chilies|cilantro|scallion/, [30, 1.5, 6, 0.3], { each: 120, cup: 90, can: 113, pack: 340 }),
];

// Small amounts that don't change a dinner's numbers (seasoning, garnish).
const SKIP = /\b(salt|pepper flakes|black pepper|ground pepper|garlic|ginger|spice|seasoning|powder|cumin|paprika|oregano|thyme|basil|parsley|rosemary|cinnamon|nutmeg|bay lea|vanilla|extract|baking soda|baking powder|yeast|vinegar|soy sauce|worcestershire|hot sauce|sriracha|mustard|lemon|lime|zest|water|ice|cooking spray|cornstarch)\b/;

const FRACTIONS: Record<string, string> = { "½": " 1/2", "⅓": " 1/3", "⅔": " 2/3", "¼": " 1/4", "¾": " 3/4", "⅛": " 1/8" };

/** "1 1/2" -> 1.5, "2-3" -> 2.5, "1/4" -> 0.25. */
export function parseAmount(text: string): number | null {
  const s = text.replace(/[½⅓⅔¼¾⅛]/g, (c) => FRACTIONS[c]).trim().toLowerCase();
  const range = s.match(/^(\d+(?:\.\d+)?)\s*(?:-|to|–)\s*(\d+(?:\.\d+)?)/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const frac = s.match(/^(?:(\d+(?:\.\d+)?)\s+)?(\d+)\/(\d+)/);
  if (frac) return (frac[1] ? Number(frac[1]) : 0) + Number(frac[2]) / Number(frac[3]);
  const whole = s.match(/^(\d+(?:\.\d+)?)/);
  return whole ? Number(whole[1]) : null;
}

const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function findFood(item: string): Food | null {
  const s = plain(item).replace(/\([^)]*\)/g, " ");
  const head = s.split(/,|;| for | or /)[0];
  for (const text of [head, s]) {
    const words = text.trim().split(/\s+/);
    // The last word is the thing itself: "garlic powder", "lemon juice" are seasonings; "garlic butter" is butter.
    if (SKIP.test(words[words.length - 1] ?? "") || /juice|zest|flakes|extract|seasoning|powder$/.test(text.trim())) return null;
    const food = FOODS.find((f) => f.re.test(text));
    if (!food) continue;
    // "black pepper" is a seasoning even though "pepper" is a vegetable.
    const fm = text.match(food.re)!;
    const covered = [...text.matchAll(new RegExp(SKIP.source, "g"))].some((m) => m.index! <= fm.index! && m.index! + m[0].length >= fm.index! + fm[0].length);
    return covered ? null : food;
  }
  return null;
}

/** Grams for one unit of this food. */
function gramsPer(unitText: string, food: Food): number | null {
  const u = plain(unitText).replace(/\([^)]*\)/g, (m) => (/\d/.test(m) ? m : " ")).trim();
  // "(15 oz) can", "can (15 oz)", "package (12 to 14 oz)": the size in parentheses wins.
  const first = u.split(/\s+/)[0] ?? "";
  const weight = (w: string) => (/^(lb|lbs|pounds?)$/.test(w) ? 453.6 : /^(oz|ounces?)$/.test(w) ? 28.35 : /^(g|grams?)$/.test(w) ? 1 : /^(kg|kilograms?)$/.test(w) ? 1000 : null);
  if (weight(first) != null) return weight(first);
  const sized = u.match(/(\d+(?:\.\d+)?)(?:\s*(?:to|-)\s*(\d+(?:\.\d+)?))?\s*(oz|ounces?|g|grams?|lb|pounds?)\b/);
  if (sized && /can|package|pack|jar|bag|box|container|carton|tub|bottle|\(/.test(u)) {
    const n = sized[2] ? (Number(sized[1]) + Number(sized[2])) / 2 : Number(sized[1]);
    return n * (/^(oz|ounce)/.test(sized[3]) ? 28.35 : /^(lb|pound)/.test(sized[3]) ? 453.6 : 1);
  }
  const w = u.split(/\s+/)[0] ?? "";
  if (/^(lb|lbs|pounds?)$/.test(w)) return 453.6;
  if (/^(oz|ounces?)$/.test(w)) return 28.35;
  if (/^(g|grams?)$/.test(w)) return 1;
  if (/^(kg|kilograms?)$/.test(w)) return 1000;
  const cup = food.cup ?? 240;
  if (/^cups?$/.test(w)) return cup;
  if (/^(tbsp|tablespoons?|tbs)$/.test(w)) return cup / 16;
  if (/^(tsp|teaspoons?)$/.test(w)) return cup / 48;
  if (/^(quarts?|qt)$/.test(w)) return cup * 4;
  if (/^(pints?|pt)$/.test(w)) return cup * 2;
  if (/^slices?$/.test(w)) return food.slice ?? 28;
  if (/^(cans?|jars?)$/.test(w)) return food.can ?? 400;
  if (/^(packages?|packs?|pkgs?|bags?|boxes|box|containers?|tubs?|cartons?|bottles?)$/.test(w)) return food.pack ?? 454;
  if (/^sticks?$/.test(w)) return 113;
  if (/^(heads?)$/.test(w)) return (food.each ?? 300) * 3;
  if (/^(handfuls?|large)$/.test(w)) return 30;
  if (/^(bunch|bunches)$/.test(w)) return 100;
  if (/^scoops?$/.test(w)) return 32;
  if (/^(cloves?|pinch|pinches|dash|dashes|sprigs?)$/.test(w)) return 0;
  if (!w || /^(pieces?|each|whole|small|medium|links?|fillets?|breasts?|thighs?|steaks?|ears?|patt(y|ies)|strips?)$/.test(w)) {
    const each = food.each ?? null;
    if (each == null) return null;
    return /^small$/.test(w) ? each * 0.7 : each;
  }
  return null;
}

/** Nutrition of one ingredient line, or null if we can't tell (seasoning, garnish, unknown food). */
export function ingredientNutrition(ing: Ingredient): Nutrition | null | "skip" {
  const item = ing.item.trim();
  if (!ing.amount.trim() || /^(for (garnish|serving)|optional|to serve)/i.test(item)) return "skip";
  const food = findFood(item);
  if (!food) return SKIP.test(plain(item)) ? "skip" : null;
  // "1 tablespoon plus 1 teaspoon", "1/4 cup plus 2 tablespoons": add the parts.
  const [firstUnit, ...more] = ing.unit.split(/\s+plus\s+/i);
  let unit = firstUnit;
  // "1/2 heaping cup frozen corn": the unit is sometimes in the item.
  if (!unit.trim()) {
    const lead = plain(item).match(/^(heaping |level )?(cups?|tablespoons?|tbsp|teaspoons?|tsp|lbs?|pounds?|oz|ounces?|slices?|cans?)\b/);
    if (lead) unit = lead[2];
  }
  const amount = parseAmount(ing.amount);
  if (amount == null) return "skip";
  let grams = 0;
  const g1 = gramsPer(unit, food);
  if (g1 == null) return null;
  grams += amount * g1;
  for (const part of more) {
    const m = part.trim().match(/^([\d\s/.½⅓⅔¼¾⅛-]+)\s+(.*)$/);
    const a = m ? parseAmount(m[1]) : null;
    const g = m ? gramsPer(m[2], food) : null;
    if (a != null && g != null) grams += a * g;
  }
  const k = grams / 100;
  return { kcal: food.n[0] * k, protein: food.n[1] * k, carbs: food.n[2] * k, fat: food.n[3] * k };
}

const r0 = (n: number) => Math.round(n);

/** Per-serving estimate for a recipe, from its ingredients. */
export function estimateNutrition(recipe: { ingredients: Ingredient[]; servings: number | null }): NutritionEstimate {
  const total: Nutrition = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  let known = 0, unknown = 0;
  for (const ing of recipe.ingredients) {
    const n = ingredientNutrition(ing);
    if (n === "skip") continue;
    if (!n) { unknown++; continue; }
    known++;
    total.kcal += n.kcal; total.protein += n.protein; total.carbs += n.carbs; total.fat += n.fat;
  }
  const s = recipe.servings && recipe.servings > 0 ? recipe.servings : 4;
  return { kcal: r0(total.kcal / s), protein: r0(total.protein / s), carbs: r0(total.carbs / s), fat: r0(total.fat / s), coverage: known + unknown ? known / (known + unknown) : 0 };
}

/** Is the estimate good enough to show? */
export const trustworthy = (n: NutritionEstimate) => n.coverage >= 0.6 && n.kcal >= 120;
