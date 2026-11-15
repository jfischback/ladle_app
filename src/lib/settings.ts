import type { FoodRule } from "./diet";
import type { Staple } from "./types";

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
  dinnersPerWeek: number; // kept equal to cookDays.length
  cookDays: number[]; // 0 = Sunday … 6 = Saturday: the nights we plan a dinner for
  foodRules: FoodRule[]; // allergies, diets, "no bones"
  dislikes: string[]; // foods the family won't eat, e.g. ["mushroom", "olive"]
  staples: Staple[]; // weekly staples, added to every grocery list
  noRepeatWeeks: number;
  favorQuickWeeknights: boolean;
  newRecipesPerWeek: number; // 0-2 new dinners from followed cooks, picked by the planner
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
  cookDays: [0, 1, 2, 3, 4],
  foodRules: [],
  dislikes: [],
  staples: [],
  noRepeatWeeks: 3,
  favorQuickWeeknights: true,
  newRecipesPerWeek: 1,
  saleThresholdPct: 20,
  preferPremiumOnSale: true,
  premiumDeeperPoints: 30,
  limitFreezer: true,
  fruitRule: true,
  prepReminders: true,
};

// Nights to fill first when an older setting only said "N dinners a week": Mon–Thu, then Sun, Fri, Sat.
const DAY_PREFERENCE = [1, 2, 3, 4, 0, 5, 6];

/** Older saved settings had only a dinner count; turn it into specific nights. */
export function cookDaysFor(saved: Partial<Settings>): number[] {
  if (Array.isArray(saved.cookDays) && saved.cookDays.length) return [...new Set(saved.cookDays)].filter((d) => d >= 0 && d <= 6).sort();
  const n = Math.min(7, Math.max(1, saved.dinnersPerWeek ?? 5));
  return DAY_PREFERENCE.slice(0, n).sort();
}
