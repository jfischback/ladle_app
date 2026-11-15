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
};

export type GroceryItem = { item: string; quantity: string; note?: string; forRecipes: string[] };
export type GroceryList = { sections: { name: string; items: GroceryItem[] }[]; source: "claude" | "basic" };
