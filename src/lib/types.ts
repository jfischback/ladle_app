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
};

export type GroceryItem = { item: string; quantity: string; note?: string; forRecipes: string[] };
export type GroceryList = { sections: { name: string; items: GroceryItem[] }[]; source: "claude" | "basic" };

/** One sale found at the store: the ingredient it covers, the product on the shelf, and the prices. */
export type SaleItem = {
  item: string; // e.g. "chicken thighs"
  product: string; // e.g. "Kroger Boneless Skinless Chicken Thighs"
  size: string;
  regularPrice: number;
  salePrice: number;
  pctOff: number;
};

/** How this week's price check went, so the home screen can explain an empty sale list. */
export type SaleCheck =
  | { status: "ok"; checked: number; at: string }
  | { status: "off"; reason: "not-connected" | "no-store"; at: string }
  | { status: "failed"; message: string; at: string };
