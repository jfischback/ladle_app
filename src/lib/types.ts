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
};

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

export type GroceryItem = { item: string; quantity: string; note?: string; forRecipes: string[] };
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
