export type Ingredient = { amount: string; unit: string; item: string };

export type PlanAlternative = {
  recipeId: string;
  recipeName: string;
  estimatedCost: number | null;
  reason: string;
};

export type PlanDay = {
  date: string; // YYYY-MM-DD
  recipeId: string | null; // null = no-cook night
  recipeName: string | null;
  estimatedCost: number | null;
  reason: string;
  saleItems: string[];
  alternatives: PlanAlternative[];
  ratedAt?: string | null;
  fromCook?: string | null; // set when this is a new recipe from a followed cook
  lunch?: PlanLunch | null; // the next-day-style lunch planned for this date, if someone's home
  breakfast?: PlanBreakfast | null; // breakfast for this date, if planned
  holiday?: string | null; // federal holiday on this date
  leftoverOf?: string | null; // "cook once, eat twice": leftovers of the dinner cooked on this date
  batches?: number; // how many dinners' worth this night cooks (2 = a double batch for a leftovers night)
  eating?: { adults: number; kids: number } | null; // who's at dinner tonight, when it isn't the usual household
  feast?: { holiday: string; guests: number; dishes: string[]; frozen: boolean; replaced?: string | null; replacedId?: string | null } | null; // a holiday dinner (Thanksgiving) instead of a recipe
};

/** One store product option for a grocery line. */
export type CartProduct = { upc: string; description: string; size: string; price: number; regular: number; onSale: boolean; aisle?: string | null; warn?: string | null }; // warn: the product's name breaks a food rule ("Has peanuts") // aisle: where it is in that store, when Kroger says

/** A grocery list line matched to a Fry's product, ready to send to the cart. */
export type CartLine = {
  key: string; // section + item, stable while reviewing
  section: string;
  item: string; // as on the grocery list
  quantity: number;
  chosen: number | null; // index into options; null = skipped
  options: CartProduct[];
};

export type CartState = { matchedAt: string; lines: CartLine[]; sentAt?: string | null; sentCount?: number };

export type ExtraCategory = "snacks" | "sweets" | "drinks" | "baby";

/** One snack/sweet/drink/baby item on this week's list, with why it's there. */
export type ExtraLine = {
  category: ExtraCategory;
  item: string; // the household's name for it
  product: string | null; // what we found at the store
  quantity: number;
  price: number | null; // per unit
  sale: SaleItem | null;
  reason: string; // "Every trip", "On sale", "This week's pick", "Running low"
};

/** Per-category rules for snacks, sweets, drinks and baby items. */
export type ExtrasRule = { rotateCount: number; servingsTarget: number | null; neverWords: string[] };

/** Breakfast for one day. */
export type PlanBreakfast = {
  recipeId: string | null;
  name: string;
  reason: string;
  eaters: string;
  servings: number;
  withDeal?: string | null; // e.g. "ham, 30% off": this week's breakfast-meat deal goes in
};

/** Lunch for one day: last night's leftovers, a lunch recipe, or an open slot. */
export type PlanLunch = {
  kind: "leftovers" | "recipe" | "open";
  recipeId: string | null;
  name: string;
  reason: string;
  eaters: string; // e.g. "1 adult + kids"
  servings: number; // adult-sized portions needed
};

export type GroceryItem = { item: string; quantity: string; note?: string; forRecipes: string[]; added?: boolean }; // added: typed in by the family
export type GroceryList = { sections: { name: string; items: GroceryItem[] }[]; source: "claude" | "basic"; notes?: string[] };

/** One sale found at the store: the ingredient it covers, the product on the shelf, and the prices. */
export type SaleItem = {
  item: string; // e.g. "chicken thighs"
  product: string; // e.g. "Kroger Boneless Skinless Chicken Thighs"
  size: string;
  regularPrice: number;
  salePrice: number;
  pctOff: number;
};

/** Something bought every week no matter what's for dinner (milk, eggs, bread…). */
export type Staple = { item: string; quantity: string; active: boolean };

/** A staple as it stood when a week was planned: its shelf price and any sale at their Fry's. */
export type StapleLine = { item: string; quantity: string; price: number | null; sale: SaleItem | null };

/** How this week's price check went, so the home screen can explain an empty sale list. */
export type SaleCheck =
  | { status: "ok"; checked: number; at: string }
  | { status: "off"; reason: "not-connected" | "no-store"; at: string }
  | { status: "failed"; message: string; at: string };
