import type { Ingredient } from "./types";

/**
 * Food rules: things a household never wants in a planned dinner (allergies, diets, "no bones").
 * Each rule is checked against the recipe's name and ingredient lines. Matching is deliberately cautious:
 * when in doubt a recipe is flagged, because a missed allergy is worse than a skipped dinner.
 */
export type FoodRule =
  | "no-bones" | "no-nuts" | "no-peanuts" | "no-dairy" | "no-gluten" | "no-eggs" | "no-shellfish" | "no-fish" | "no-soy"
  | "vegetarian" | "pescatarian" | "no-pork" | "no-beef" | "not-spicy";

type RuleDef = { label: string; group: "allergy" | "diet" | "texture"; icon: string; hits: RegExp; except?: RegExp; also?: FoodRule[] };

const MEAT = /\b(chicken|beef|steak|pork|bacon|ham|prosciutto|pancetta|sausages?|chorizo|kielbasa|salami|pepperoni|turkey|lamb|veal|venison|duck|bison|brisket|chuck|ribs?|oxtails?|meatballs?|carnitas|lard|gelatin|hot dogs?|bratwurst|ground meat|mince)\b/;
const FISH = /\b(salmon|tuna|cod|tilapia|halibut|fish|anchov(y|ies)|sardines?|mahi|trout|bass|swordfish|snapper|catfish|haddock|pollock|fish sauce|worcestershire)\b/;
const SHELLFISH = /\b(shrimp|prawns?|crab|lobster|scallops?|clams?|mussels?|oysters?|crawfish|crayfish|langoustines?|calamari|squid|octopus)\b/;

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
    hits: /\bmilk\b|cheese|\bbutter\b|cream\b|creamy sauce|yogurt|yoghurt|\bghee\b|parmesan|parmigiano|pecorino|mozzarella|cheddar|ricotta|half-and-half|half and half|buttermilk|feta|alfredo|queso|mascarpone|gruyere|brie|burrata|paneer|whey|casein|cream cheese|sour cream|creme fraiche/,
    except: /coconut (milk|cream)|(almond|oat|soy|rice|cashew|coconut|plant-based|non-dairy|dairy-free) (milk|cheese|butter|yogurt|cream)|peanut butter|nut butter|almond butter|apple butter|butternut|butter beans?|butter lettuce|cocoa butter|cream of tartar|ice cream maker|dairy-free|vegan (butter|cheese)/,
  },
  "no-gluten": {
    label: "Gluten-free", group: "allergy", icon: "🌾",
    hits: /\bflour\b|\bwheat\b|pasta|spaghetti|noodles?|macaroni|penne|rigatoni|fettuccine|linguine|lasagna|shells|orzo|ziti|tortellini|ravioli|gnocchi|couscous|barley|\bbread\b|breadcrumbs?|panko|croutons?|crackers?|tortillas?|pita|naan|\bbuns?\b|rolls?\b|biscuits?|pie crust|puff pastry|pastry|soy sauce|\bbeer\b|seitan|udon|ramen|dumplings?|pierogi|cream of (chicken|mushroom) soup|stuffing|bulgur|farro|semolina|graham/,
    except: /gluten-free|gf |corn tortillas?|rice noodles?|rice paper|almond flour|coconut flour|rice flour|tapioca flour|cassava flour|chickpea flour|oat flour \(gf\)|tamari|lettuce wraps?|egg rolls? wrappers? \(gf\)/,
  },
  "no-eggs": {
    label: "No eggs", group: "allergy", icon: "🥚",
    hits: /\beggs?\b|egg yolks?|egg whites?|mayonnaise|\bmayo\b|aioli|meringue|egg noodles/,
    except: /eggplant|vegan mayo|egg-free/,
  },
  "no-shellfish": { label: "Shellfish allergy", group: "allergy", icon: "🦐", hits: SHELLFISH },
  "no-fish": { label: "Fish allergy", group: "allergy", icon: "🐟", hits: FISH, except: /fish-free|vegan worcestershire/ },
  "no-soy": {
    label: "No soy", group: "allergy", icon: "🫘",
    hits: /\bsoy\b|soybeans?|tofu|edamame|miso|tamari|tempeh|teriyaki|hoisin|soy sauce/,
    except: /coconut aminos/,
  },
  vegetarian: {
    label: "Vegetarian", group: "diet", icon: "🥦",
    hits: new RegExp(`${MEAT.source}|${FISH.source}|${SHELLFISH.source}|\\b(chicken|beef|bone) (broth|stock|bouillon|base)\\b`),
    except: /vegetarian|plant-based|vegan|beyond meat|impossible|meatless|veggie (burger|sausage)/,
  },
  pescatarian: {
    label: "Pescatarian", group: "diet", icon: "🐠",
    hits: new RegExp(`${MEAT.source}|\\b(chicken|beef|bone) (broth|stock|bouillon|base)\\b`),
    except: /vegetarian|plant-based|vegan|meatless|veggie (burger|sausage)/,
  },
  "no-pork": {
    label: "No pork", group: "diet", icon: "🐖",
    hits: /\bpork\b|bacon|\bham\b|prosciutto|pancetta|chorizo|salami|pepperoni|carnitas|\blard\b|kielbasa|bratwurst|italian sausage|breakfast sausage|\bsausages?\b|baby back|spare ribs|hot dogs?/,
    except: /turkey (bacon|ham|sausage|pepperoni)|chicken (sausage|chorizo)|beef (sausage|hot dogs?)|plant-based|veggie sausage/,
  },
  "no-beef": {
    label: "No beef", group: "diet", icon: "🐄",
    hits: /\bbeef\b|steak|brisket|\bchuck\b|ground chuck|oxtails?|\bveal\b|short ribs|sirloin|ribeye|flank|skirt steak|roast beef|corned beef|meatballs?|hamburger|cheeseburger|beef (broth|stock|bouillon)/,
    except: /turkey meatballs?|chicken meatballs?|plant-based|impossible|beyond/,
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
  { title: "For little ones", group: "texture" },
];

/** Split "mushrooms, olives; cilantro" into ["mushroom", "olive", "cilantro"]. */
export function parseDislikes(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((w) => w.trim().toLowerCase().replace(/[^a-z\s'-]/g, ""))
    .filter((w) => w.length >= 3)
    .slice(0, 30);
}

const singular = (w: string) => w.replace(/ies$/, "y").replace(/(oes)$/, "o").replace(/s$/, "");

/**
 * What in this recipe breaks the household's food rules. Empty means it's fine.
 * Each problem is short and readable, e.g. "Has dairy (parmesan)" or "Has mushrooms".
 */
export function ruleProblems(
  recipe: { name?: string | null; title?: string | null; ingredients: Ingredient[] },
  rules: FoodRule[] = [],
  dislikes: string[] = [],
): string[] {
  const lines = [recipe.name ?? recipe.title ?? "", ...recipe.ingredients.map((i) => i.item)].map((l) => l.toLowerCase());
  const problems: string[] = [];
  for (const key of rules) {
    const def = FOOD_RULES[key];
    if (!def) continue;
    const hit = lines.map((l) => (def.except ? l.replace(new RegExp(def.except.source, "g"), " ") : l)).map((l) => l.match(def.hits)?.[0]).find(Boolean);
    if (hit) problems.push(`${problemLabel(key)} (${hit})`);
  }
  for (const word of dislikes) {
    const re = new RegExp(`\\b${singular(word).replace(/[-\s]+/g, "[-\\s]+")}(e?s)?\\b`);
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
    case "vegetarian": return "Not vegetarian";
    case "pescatarian": return "Has meat";
    case "no-pork": return "Has pork";
    case "no-beef": return "Has beef";
    case "not-spicy": return "Spicy";
  }
}

/** Plain-words summary for the planner and the grocery list, e.g. "No bones; Peanut allergy; won't eat: mushrooms". */
export function rulesSummary(rules: FoodRule[] = [], dislikes: string[] = []): string {
  const parts = rules.map((r) => FOOD_RULES[r]?.label).filter(Boolean);
  if (dislikes.length) parts.push(`won't eat: ${dislikes.join(", ")}`);
  return parts.join("; ");
}
