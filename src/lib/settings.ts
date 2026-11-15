export const MOTIVATIONS = {
  save_money: "Save money",
  eat_healthier: "Eat healthier",
  try_new: "Try new things",
} as const;
export type Motivation = keyof typeof MOTIVATIONS;

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type Settings = {
  // Q0 Motivation, ranked most important first
  motivation: Motivation[];
  // Q1 Household
  adults: number;
  kids: number;
  hasBaby: boolean;
  babyAgeMonths: number | null;
  // Q2 Store
  zip: string;
  storeLocationId: string | null; // Kroger locationId once connected
  storeName: string;
  fulfillment: "pickup" | "delivery";
  shoppingDay: number; // 0 = Sunday
  // Q3 Money
  weeklyBudget: number;
  budgetMode: "target" | "hard";
  // Q4 Meals
  dinnersPerWeek: number;
  noRepeatWeeks: number;
  favorQuickWeeknights: boolean;
  // Q5 Buying
  saleThresholdPct: number;
  preferPremiumOnSale: boolean;
  // Defaults, not questions (section 10 / 17)
  premiumDeeperPoints: number; // cheap version wins only if at least this many points deeper
  limitFreezer: boolean; // don't stock up on frozen
  fruitRule: boolean; // buy a lot of in-season fruit, only when on sale
  prepReminders: boolean; // remind the day before (marinating, thawing)
};

export const DEFAULT_SETTINGS: Settings = {
  motivation: ["save_money", "eat_healthier", "try_new"],
  adults: 2,
  kids: 0,
  hasBaby: false,
  babyAgeMonths: null,
  zip: "",
  storeLocationId: null,
  storeName: "",
  fulfillment: "pickup",
  shoppingDay: 6,
  weeklyBudget: 150,
  budgetMode: "target",
  dinnersPerWeek: 5,
  noRepeatWeeks: 3,
  favorQuickWeeknights: true,
  saleThresholdPct: 20,
  preferPremiumOnSale: true,
  premiumDeeperPoints: 30,
  limitFreezer: true,
  fruitRule: true,
  prepReminders: true,
};
