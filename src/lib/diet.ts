import type { Ingredient } from "./types";

/**
 * Food rules: things a household never wants in a planned dinner (allergies, diets, "no bones").
 * Each rule is checked against the recipe's name and ingredient lines. Matching is deliberately cautious:
 * when in doubt a recipe is flagged, because a missed allergy is worse than a skipped dinner.
 */
export type FoodRule =
  | "no-bones" | "no-nuts" | "no-peanuts" | "no-dairy" | "no-gluten" | "no-eggs" | "no-shellfish" | "no-fish" | "no-soy"
  | "no-sesame" | "vegetarian" | "pescatarian" | "no-seafood" | "no-pork" | "no-beef" | "not-spicy"
  | "no-alcohol" | "halal" | "kosher" | "pregnancy" | "vegan";

type RuleDef = {
  label: string;
  group: "allergy" | "diet" | "faith" | "texture";
  icon: string;
  hits: RegExp;
  except?: RegExp;
  /** For rules that aren't one ingredient (e.g. meat and dairy together): returns what breaks it, or null. */
  check?: (lines: string[]) => string | null;
  note?: string;
};

const ALCOHOL = /\bwine\b|\bbeer\b|\bale\b|lager|stout|bourbon|whiskey|whisky|vodka|\brum\b|tequila|brandy|cognac|sherry|marsala|\bport\b|vermouth|liqueur|amaretto|kahlua|grand marnier|triple sec|\bsake\b|\bmirin\b|hard cider|champagne|prosecco|guinness|\bgin\b/;
const ALCOHOL_EXCEPT = /(red|white|rice|sherry|champagne) wine vinegar|wine vinegar|non-alcoholic|alcohol-free|root beer|ginger beer|ginger ale|rum extract|aji-mirin \(alcohol-free\)/;
const PORK = /\bpork\b|bacon|\bham\b|hams\b|prosciutto|pancetta|guanciale|lardons?|mortadella|andouille|chorizo|salami|pepperoni|carnitas|\blard\b|kielbasa|bratwurst|italian sausage|breakfast sausage|\bsausages?\b|baby back|spare ribs|\bribs\b|hot dogs?|gelatin|chicharr/;
const PORK_EXCEPT = /turkey (bacon|ham|sausage|pepperoni)|chicken (sausage|chorizo|andouille)|beef (sausage|hot dogs?|bacon|ribs|short ribs)|short ribs|celery ribs?|ribs? of celery|ribs (and|&) seeds|seeds (and|&) ribs|ribs removed|plant-based|veggie sausage|halal|kosher/;

const MEAT = /\b(chicken|beef|steak|pork|bacon|ham|prosciutto|pancetta|sausages?|chorizo|kielbasa|salami|pepperoni|turkey|lamb|veal|venison|duck|bison|brisket|chuck|ribs?|oxtails?|meatballs?|carnitas|lard|gelatin|hot dogs?|bratwurst|ground meat|mince|guanciale|lardons?|mortadella|andouille|pastrami|rabbit|goat|liver|anchovy paste)\b/;
const FISH = /\b(salmon|tuna|cod|tilapia|halibut|fish|fishes|whitefish|anchov(y|ies)|sardines?|mahi|trout|bass|swordfish|snapper|catfish|haddock|pollock|mackerel|branzino|flounder|grouper|sole|lox|herring|dashi|bonito|fish sauce|worcestershire|caesar dressing)\b/;
const SHELLFISH = /\b(shrimps?|prawns?|crabs?|crabmeat|lobsters?|scallops?|clams?|mussels?|oysters?|crawfish|crayfish|langoustines?|calamari|squid|octopus|shellfish|seafood( mix| medley| stock| boil)?|soft-shell)\b/;

export const FOOD_RULES: Record<FoodRule, RuleDef> = {
  "no-bones": {
    label: "No bones", group: "texture", icon: "🦴",
    hits: /bone-in|on the bone|\bbones?\b|drumsticks?|\bwings?\b|chicken legs?|leg quarters?|whole (chicken|turkey|fish|bird)|spatchcock|\bribs?\b|oxtails?|shanks?|osso buco|t-bone|porterhouse|tomahawk|chicken pieces|bone broth|whole (trout|snapper|branzino)/,
    except: /boneless|bone broth|rib-?eyes?|rib eyes?|celery ribs?|ribs? of celery|ribs (and|&) seeds|seeds (and|&) ribs|ribs removed|rib roast, chuck|prime rib roast \(boneless\)/,
  },
  "no-nuts": {
    label: "Tree nut allergy", group: "allergy", icon: "🌰",
    hits: /almonds?|walnuts?|pecans?|cashews?|pistachios?|hazelnuts?|macadamia|pine nuts?|brazil nuts?|nutella|praline|marzipan|\bpesto\b|mixed nuts|\bnuts?\b/,
    except: /nutmeg|coconut|butternut|doughnut|donut|chestnut mushroom|nut-free/,
  },
  "no-peanuts": {
    label: "Peanut allergy", group: "allergy", icon: "🥜",
    hits: /peanuts?|satay|\bpeanut butter\b|groundnut/,
  },
  "no-dairy": {
    label: "No dairy", group: "allergy", icon: "🥛",
    hits: /\bmilk\b|cheese|\bbutter\b|cream\b|creamy sauce|yogurt|yoghurt|\bghee\b|parmesan|parmigiano|pecorino|mozzarella|cheddar|ricotta|half-and-half|half and half|buttermilk|feta|alfredo|queso|mascarpone|gruyere|brie|burrata|paneer|whey|casein|cream cheese|sour cream|creme fraiche|half & half|crema|monterey jack|pepper jack|colby|\bjack cheese|cotija|provolone|swiss|gouda|havarti|muenster|fontina|asiago|romano|manchego|halloumi|labneh|kefir|custard|bechamel|white sauce/,
    except: /coconut (milk|cream)|(almond|oat|soy|rice|cashew|coconut|plant-based|non-dairy|dairy-free) (milk|cheese|butter|yogurt|cream)|peanut butter|nut butter|almond butter|apple butter|butternut|butter beans?|butter lettuce|cocoa butter|swiss chard|romano beans?|cream of tartar|cream of tartar|ice cream maker|dairy-free|vegan (butter|cheese)/,
  },
  "no-gluten": {
    label: "Gluten-free", group: "allergy", icon: "🌾",
    hits: /\bflour\b|\bwheat\b|pasta|spaghetti|noodles?|macaroni|penne|rigatoni|fettuccine|linguine|lasagna|shells|orzo|ziti|tortellini|ravioli|gnocchi|couscous|barley|\bbread\b|breadcrumbs?|panko|croutons?|crackers?|tortillas?|pita|naan|\bbuns?\b|rolls?\b|biscuits?|pie crust|puff pastry|pastry|soy sauce|\bbeer\b|seitan|udon|ramen|dumplings?|pierogi|cream of (chicken|mushroom) soup|stuffing|bulgur|farro|semolina|graham|rotini|farfalle|bucatini|cavatappi|ditalini|pappardelle|tagliatelle|angel hair|vermicelli|sourdough|\brye\b|hoisin|teriyaki|malt|breaded|batter|roux|wonton|matzo|challah|brioche|bagels?|croissants?|english muffins?/,
    except: /gluten-free|gf |corn tortillas?|rice noodles?|rice paper|almond flour|coconut flour|rice flour|tapioca flour|cassava flour|chickpea flour|oat flour \(gf\)|tamari|lettuce wraps?|egg rolls? wrappers? \(gf\)/,
  },
  "no-eggs": {
    label: "No eggs", group: "allergy", icon: "🥚",
    hits: /\beggs?\b|egg yolks?|egg whites?|mayonnaise|\bmayo\b|aioli|meringue|egg noodles/,
    except: /eggplant|vegan mayo|egg-free/,
  },
  "no-shellfish": { label: "Shellfish allergy", group: "allergy", icon: "🦐", hits: SHELLFISH },
  "no-fish": { label: "Fish allergy", group: "allergy", icon: "🐟", hits: FISH, except: /fish-free|vegan worcestershire/ },
  "no-sesame": {
    label: "Sesame allergy", group: "allergy", icon: "🌱",
    hits: /sesame|tahini|benne|gomasio|furikake|za'?atar|\bhummus\b|halva|everything bagel seasoning|hamburger buns? with seeds/,
    except: /sesame-free|tahini-free/,
  },
  "no-soy": {
    label: "No soy", group: "allergy", icon: "🫘",
    hits: /\bsoy\b|soybeans?|tofu|edamame|miso|tamari|tempeh|teriyaki|hoisin|soy sauce|ponzu|shoyu|natto|yuba/,
    except: /coconut aminos/,
  },
  vegetarian: {
    label: "Vegetarian", group: "diet", icon: "🥦",
    hits: new RegExp(`${MEAT.source}|${FISH.source}|${SHELLFISH.source}|\\b(chicken|beef|bone) (broth|stock|bouillon|base)\\b`),
    except: /vegetarian|plant-based|vegan|beyond meat|impossible|meatless|veggie (burger|sausage)|goat cheese|celery ribs?|ribs (and|&) seeds|vegetable (broth|stock)/,
  },
  vegan: {
    label: "Vegan", group: "diet", icon: "🌱",
    hits: new RegExp(`${MEAT.source}|${FISH.source}|${SHELLFISH.source}|\\b(chicken|beef|bone) (broth|stock|bouillon|base)\\b|\\bmilk\\b|cheese|\\bbutter\\b|cream\\b|yogh?urt|\\bghee\\b|parmesan|mozzarella|cheddar|ricotta|half-and-half|buttermilk|feta|alfredo|queso|sour cream|cream cheese|cotija|\\beggs?\\b|egg (yolks?|whites?|noodles)|\\bmayo(nnaise)?\\b|aioli|\\bhoney\\b|gelatin|whey`),
    except: /vegetarian|plant-based|vegan|beyond meat|impossible|meatless|veggie (burger|sausage)|celery ribs?|ribs (and|&) seeds|vegetable (broth|stock)|coconut (milk|cream)|(almond|oat|soy|rice|cashew|coconut|plant-based|non-dairy|dairy-free) (milk|cheese|butter|yogurt|cream)|peanut butter|nut butter|almond butter|apple butter|butternut|butter beans?|butter lettuce|cocoa butter|eggplant|egg-free|cream of tartar/,
    note: "No meat, fish, dairy, eggs or honey.",
  },
  pescatarian: {
    label: "Pescatarian", group: "diet", icon: "🐠",
    hits: new RegExp(`${MEAT.source}|\\b(chicken|beef|bone) (broth|stock|bouillon|base)\\b`),
    except: /vegetarian|plant-based|vegan|meatless|veggie (burger|sausage)/,
  },
  "no-seafood": {
    label: "No seafood", group: "diet", icon: "🦞",
    hits: new RegExp(`${FISH.source}|${SHELLFISH.source}|seafood|clam juice|oyster sauce|fish stock`),
    except: /fish-free|vegan worcestershire|vegetarian oyster sauce/,
  },
  "no-pork": {
    label: "No pork", group: "diet", icon: "🐖",
    hits: PORK,
    except: PORK_EXCEPT,
  },
  "no-beef": {
    label: "No beef", group: "diet", icon: "🐄",
    hits: /\bbeef\b|steak|brisket|\bchuck\b|ground chuck|oxtails?|\bveal\b|short ribs|sirloin|ribeye|flank|skirt steak|roast beef|corned beef|meatballs?|hamburger|cheeseburger|beef (broth|stock|bouillon)/,
    except: /turkey meatballs?|chicken meatballs?|plant-based|impossible|beyond/,
  },
  "no-alcohol": {
    label: "No alcohol", group: "diet", icon: "🚫🍷",
    hits: ALCOHOL, except: ALCOHOL_EXCEPT,
  },
  halal: {
    label: "Halal", group: "faith", icon: "☪️",
    hits: new RegExp(`${PORK.source}|${ALCOHOL.source}`),
    except: new RegExp(`${PORK_EXCEPT.source}|${ALCOHOL_EXCEPT.source}`),
    note: "No pork or alcohol. Buy halal meat (we'll note it on the grocery list).",
  },
  kosher: {
    label: "Kosher-style", group: "faith", icon: "✡️",
    hits: new RegExp(`${PORK.source}|${SHELLFISH.source}|catfish|\\beel\\b`),
    except: PORK_EXCEPT,
    note: "No pork or shellfish, and no meat with dairy in the same dish.",
    check: (lines) => {
      const meat = lines.map((l) => l.match(/\b(chicken|beef|steak|turkey|lamb|veal|brisket|meatballs?|ground beef)\b/)?.[0]).find(Boolean);
      const dairy = lines
        .map((l) => l.replace(/coconut (milk|cream)|(almond|oat|soy|non-dairy|dairy-free) (milk|cheese|butter|cream)|peanut butter|butternut|butter beans?|cream of tartar/g, " "))
        .map((l) => l.match(/\bmilk\b|cheese|\bbutter\b|cream\b|yogurt|parmesan|mozzarella|cheddar|ricotta|sour cream|half-and-half|ghee/)?.[0])
        .find(Boolean);
      return meat && dairy ? `${meat} with ${dairy}` : null;
    },
  },
  pregnancy: {
    label: "Pregnancy-safe", group: "diet", icon: "🤰",
    hits: new RegExp(`${ALCOHOL.source}|deli meat|deli (turkey|ham|chicken|roast beef)|lunch meat|cold cuts|sliced turkey breast|salami|pepperoni|prosciutto|hot dogs?|sushi|sashimi|ceviche|poke\\b|raw (fish|egg|oysters?)|tartare|carpaccio|swordfish|king mackerel|shark|tilefish|bigeye tuna|liver|p[aâ]t[eé]|brie|camembert|blue cheese|gorgonzola|queso fresco|roquefort|runny|soft-boiled|homemade (mayo|aioli|caesar)|unpasteurized|raw milk|sprouts`),
    except: new RegExp(`${ALCOHOL_EXCEPT.source}|pasteurized|cooked until|heated until steaming|turkey pepperoni`),
    note: "Skips alcohol, deli meats, raw fish and eggs, high-mercury fish and soft unpasteurized cheeses.",
  },
  "not-spicy": {
    label: "Not spicy", group: "diet", icon: "🌶️",
    hits: /spicy|jalape|serrano|habanero|chipotle|cayenne|red pepper flakes|crushed red pepper|chili flakes|sriracha|hot sauce|buffalo|gochujang|sambal|chili oil|chile oil|scotch bonnet|ghost pepper|thai chil|bird'?s eye|harissa|nashville hot|hot honey|diablo|arrabbiata|cajun/,
    except: /mild/,
  },
};

export const FOOD_RULE_GROUPS: { title: string; group: RuleDef["group"] }[] = [
  { title: "Allergies", group: "allergy" },
  { title: "How you eat", group: "diet" },
  { title: "Faith", group: "faith" },
  { title: "For little ones", group: "texture" },
];

/** Split "mushrooms, olives; cilantro" into ["mushroom", "olive", "cilantro"]. */
export function parseDislikes(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((w) => plain(w.trim()).replace(/[^a-z\s'-]/g, ""))
    .filter((w) => w.length >= 3)
    .slice(0, 30);
}

/** Lowercase without accents, so "Gruyère", "crème fraîche" and "jalapeños" match plain-letter rules. */
const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

/** The stem of a word plus the plural endings to accept: berries -> berr(y|ies), tomatoes -> tomato(es)?. */
function wordPattern(word: string): string {
  const w = word.replace(/[-\s]+/g, " ").trim();
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "[-\\s]+");
  if (/ies$/.test(w) || /[^aeiou]y$/.test(w)) return `${esc(w.replace(/(ies|y)$/, ""))}(y|ies)`;
  if (/oes$/.test(w)) return `${esc(w.replace(/es$/, ""))}(es)?`;
  if (/(s|x|ch|sh)es$/.test(w)) return `${esc(w.replace(/es$/, ""))}(es)?`;
  return `${esc(w.replace(/s$/, ""))}(e?s)?`;
}

/**
 * What in this recipe breaks the household's food rules. Empty means it's fine.
 * Each problem is short and readable, e.g. "Has dairy (parmesan)" or "Has mushrooms".
 */
export function ruleProblems(
  recipe: { name?: string | null; title?: string | null; ingredients: Ingredient[] },
  rules: FoodRule[] = [],
  dislikes: string[] = [],
  allowAnyway: string[] = [],
): string[] {
  const lines = [recipe.name ?? recipe.title ?? "", ...recipe.ingredients.map((i) => i.item)].map(plain);
  const problems: string[] = [];
  // "Allowed anyway" (e.g. sushi with No seafood) lifts diet rules and dislikes for that dish, never allergies.
  const title = plain(recipe.name ?? recipe.title ?? "");
  const excepted = allowAnyway.some((w) => w && new RegExp(`\\b${wordPattern(plain(w))}\\b`).test(title));
  for (const key of rules) {
    const def = FOOD_RULES[key];
    if (!def) continue;
    if (excepted && def.group !== "allergy") continue;
    const cleaned = lines.map((l) => (def.except ? l.replace(new RegExp(def.except.source, "g"), " ") : l));
    const hit = cleaned.map((l) => l.match(def.hits)?.[0]).find(Boolean) ?? def.check?.(cleaned);
    if (hit) problems.push(`${problemLabel(key)} (${hit})`);
  }
  for (const word of excepted ? [] : dislikes) {
    const re = new RegExp(`\\b${wordPattern(plain(word))}\\b`);
    if (lines.some((l) => re.test(l))) problems.push(`Has ${word}`);
  }
  return problems;
}

function problemLabel(key: FoodRule): string {
  switch (key) {
    case "no-bones": return "Has bones";
    case "no-nuts": return "Has tree nuts";
    case "no-peanuts": return "Has peanuts";
    case "no-dairy": return "Has dairy";
    case "no-gluten": return "Has gluten";
    case "no-eggs": return "Has eggs";
    case "no-shellfish": return "Has shellfish";
    case "no-fish": return "Has fish";
    case "no-soy": return "Has soy";
    case "no-sesame": return "Has sesame";
    case "no-alcohol": return "Has alcohol";
    case "halal": return "Not halal";
    case "kosher": return "Not kosher-style";
    case "pregnancy": return "Not pregnancy-safe";
    case "vegetarian": return "Not vegetarian";
    case "pescatarian": return "Has meat";
    case "vegan": return "Not vegan";
    case "no-seafood": return "Has seafood";
    case "no-pork": return "Has pork";
    case "no-beef": return "Has beef";
    case "not-spicy": return "Spicy";
  }
}

/** Plain-words summary for the planner and the grocery list, e.g. "No bones; Peanut allergy; won't eat: mushrooms". */
export function rulesSummary(rules: FoodRule[] = [], dislikes: string[] = [], allowAnyway: string[] = []): string {
  const parts = rules.map((r) => (FOOD_RULES[r] ? `${FOOD_RULES[r].label}${FOOD_RULES[r].note ? ` (${FOOD_RULES[r].note})` : ""}` : "")).filter(Boolean);
  if (dislikes.length) parts.push(`won't eat: ${dislikes.join(", ")}`);
  if (allowAnyway.length) parts.push(`exceptions allowed anyway: ${allowAnyway.join(", ")}`);
  return parts.join("; ");
}
