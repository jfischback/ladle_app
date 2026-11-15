import type { FoodRule } from "./diet";
import type { Athlete } from "./athletes";
import type { PickyEater } from "./picky";
import type { ExtraCategory, ExtrasRule, Staple } from "./types";

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
  pickyEaters: PickyEater[]; // kids (or grown-ups) with their own won't-eat list and safe foods
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
  tightBudget: boolean; // "Every dollar counts": cheapest dinners and products win, brands and extras don't matter
  cookOnceEatTwice: boolean; // cook a double batch, eat it again the next planned night (less cost and waste)
  snap: boolean; // pays with SNAP/EBT: keep the cart EBT-friendly
  // Q4 Meals
  dinnersPerWeek: number; // kept equal to cookDays.length
  cookDays: number[]; // 0 = Sunday … 6 = Saturday: the nights we plan a dinner for
  foodRules: FoodRule[]; // allergies, diets, "no bones"
  dislikes: string[]; // foods the family won't eat, e.g. ["mushroom", "olive"]
  staples: Staple[]; // weekly staples, added to every grocery list
  busyDays: number[]; // nights that need a quick dinner (subset of cookDays)
  busyMaxMinutes: number; // "quick" on a busy night, e.g. 30
  maxSameProtein: number; // most nights a week with the same main protein (chicken, beef…); sale proteins may go over
  lunchDays: number[]; // weekdays someone eats lunch at home (leftovers first, then a lunch recipe)
  lunchAdults: number; // adults eating those lunches
  lunchKids: boolean; // kids and the baby eat those lunches too
  holidayEveryoneHome: boolean; // on federal holidays everyone eats lunch at home
  holidayNoReheat: string[]; // proteins someone won't eat reheated on those days (e.g. "Chicken")
  allowAnyway: string[]; // exceptions to diet rules, e.g. "sushi" with No seafood (never allergies)
  breakfastDays: number[]; // weekdays we plan breakfast
  breakfastAdults: number; // adults eating those breakfasts
  breakfastKids: boolean; // kids and the baby eat them too
  breakfastMaxMinutes: number; // quick mornings, e.g. 15
  breadBreakfasts: number; // bread-based breakfasts a week (pancakes, bagels…); the rest are egg or protein
  breakfastMustHave: string[]; // e.g. ["omelet"]: at least one of each, every week
  breakfastMeatDeal: boolean; // find the week's best breakfast-meat sale and use it in egg breakfasts
  extras: Record<ExtraCategory, ExtrasRule>; // snacks, sweets, drinks and baby: how many to rotate, targets, never-buy words
  athletes: Athlete[]; // athlete mode: people with their own calorie and protein goals
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
  pickyEaters: [],
  babyAgeMonths: null,
  zip: "",
  storeLocationId: null,
  storeName: "",
  fulfillment: "pickup",
  shoppingDay: 6,
  weeklyBudget: 150,
  budgetMode: "target",
  tightBudget: false,
  cookOnceEatTwice: false,
  snap: false,
  dinnersPerWeek: 5,
  cookDays: [0, 1, 2, 3, 4],
  foodRules: [],
  dislikes: [],
  staples: [],
  busyDays: [],
  busyMaxMinutes: 30,
  maxSameProtein: 2,
  lunchDays: [],
  lunchAdults: 1,
  lunchKids: true,
  holidayEveryoneHome: true,
  holidayNoReheat: [],
  allowAnyway: [],
  breakfastDays: [],
  breakfastAdults: 1,
  breakfastKids: true,
  breakfastMaxMinutes: 15,
  breadBreakfasts: 1,
  breakfastMustHave: [],
  breakfastMeatDeal: true,
  extras: {
    snacks: { rotateCount: 2, servingsTarget: null, neverWords: [] },
    sweets: { rotateCount: 1, servingsTarget: null, neverWords: [] },
    drinks: { rotateCount: 1, servingsTarget: null, neverWords: [] },
    // Safety defaults for babies: no honey under 12 months, nothing labeled for toddlers or 12+ months.
    baby: { rotateCount: 2, servingsTarget: 5, neverWords: ["honey", "toddler", "12+ months", "12 months+"] },
  },
  athletes: [],
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
