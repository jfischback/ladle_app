import type { Athlete } from "./athletes";
import type { Settings } from "./settings";
import type { Ingredient } from "./types";
import { estimateNutrition, estimateSodium } from "./nutrition";

/** What the household's health needs mean for shared dinners. Not medical advice: it follows the numbers people enter. */
export type HealthNeeds = {
  keto: string[]; // names
  diabetes: { name: string; carbsPerMeal: number }[];
  lowSodium: { name: string; perMeal: number }[];
};

/** Someone with a health need who isn't training: no portions, protein or snacks of their own, just the need. */
export type HealthCondition = "diabetes" | "lowsodium" | "keto";
export type HealthPerson = { id: string; name: string; conditions: HealthCondition[]; carbsPerMeal: number; sodiumPerDay: number };
export const HEALTH_CONDITIONS: HealthCondition[] = ["diabetes", "lowsodium", "keto"];

// The same starting numbers athlete mode uses; the person's own care team's numbers replace them.
export function newHealthPerson(name = ""): HealthPerson {
  return { id: Math.random().toString(36).slice(2, 10), name, conditions: [], carbsPerMeal: 45, sodiumPerDay: 1500 };
}

export function normalizeHealthPerson(raw: Partial<HealthPerson>): HealthPerson {
  const base = newHealthPerson(raw.name ?? "");
  return { ...base, ...raw, conditions: (raw.conditions ?? []).filter((c): c is HealthCondition => HEALTH_CONDITIONS.includes(c as HealthCondition)) };
}

type WithNeeds = Pick<Athlete, "name" | "carbsPerMeal" | "sodiumPerDay"> & { conditions: readonly string[] };

/** Everyone's health needs: people in athlete mode plus the health-only list. */
export const householdHealth = (s: Pick<Settings, "athletes" | "healthPeople">): HealthNeeds => healthNeeds([...s.athletes, ...(s.healthPeople ?? [])]);

export function healthNeeds(people: WithNeeds[]): HealthNeeds {
  return {
    keto: people.filter((p) => p.conditions.includes("keto")).map((p) => p.name || "Someone"),
    diabetes: people.filter((p) => p.conditions.includes("diabetes")).map((p) => ({ name: p.name || "Someone", carbsPerMeal: p.carbsPerMeal })),
    // Dinner gets about 40% of the day's sodium: the biggest, saltiest meal.
    lowSodium: people.filter((p) => p.conditions.includes("lowsodium")).map((p) => ({ name: p.name || "Someone", perMeal: Math.round(p.sodiumPerDay * 0.4) })),
  };
}

export const hasNeeds = (n: HealthNeeds) => n.keto.length + n.diabetes.length + n.lowSodium.length > 0;

type R = { name: string; ingredients: Ingredient[]; servings: number | null };

// Starchy sides that can be cut or swapped to bring carbs down.
const STARCH = /\b(rice|pasta|spaghetti|penne|fettuccine|noodles|tortillas?|buns?|bread|rolls?|potato(es)?|fries|tater tots|cornbread|mac and cheese|biscuits?|bagels?|pancakes?|waffles?)\b/;
// Swaps that bring sodium down.
const SALTY_SWAPS: [RegExp, string][] = [
  [/broth|stock|bouillon/, "low-sodium broth"], [/canned|can\b.*(beans|tomato)|beans|tomatoes/, "no-salt-added beans and tomatoes"],
  [/soy sauce|tamari/, "low-sodium soy sauce"], [/bacon|sausage|ham|deli|pepperoni|salami/, "half the cured meat"],
  [/seasoned salt|taco seasoning|cajun|seasoning/, "a salt-free seasoning blend"], [/cheese|parmesan/, "less cheese"],
];

const plain = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Planner nudge: below zero when a dinner fights the household's needs (keto most strongly). */
export function healthScore(r: R, n: HealthNeeds): number {
  if (!hasNeeds(n)) return 0;
  const nut = estimateNutrition(r);
  if (nut.coverage < 0.5) return 0;
  let s = 0;
  if (n.keto.length) s -= nut.carbs > 35 ? 4 : nut.carbs > 20 ? 2 : -0.5;
  for (const d of n.diabetes) s -= nut.carbs > d.carbsPerMeal + 40 ? 2 : nut.carbs > d.carbsPerMeal + 15 ? 1 : 0;
  if (n.lowSodium.length) {
    const mg = estimateSodium(r);
    const limit = Math.min(...n.lowSodium.map((x) => x.perMeal));
    s -= mg > limit * 2 ? 2.5 : mg > limit * 1.3 ? 1.2 : mg > limit ? 0.4 : 0;
  }
  return s;
}

/** Day-card tips: how each person can make tonight's dinner work for them. */
export function healthTips(r: R, n: HealthNeeds): string[] {
  if (!hasNeeds(n)) return [];
  const nut = estimateNutrition(r);
  if (nut.coverage < 0.5) return [];
  const lines = r.ingredients.map((i) => plain(i.item));
  const starch = [...new Set(lines.map((l) => l.match(STARCH)?.[0]).filter((x): x is string => !!x))].slice(0, 2);
  const tips: string[] = [];
  for (const name of n.keto) {
    if (nut.carbs > 15) tips.push(`${name} (keto): about ${nut.carbs} g carbs a plate. ${starch.length ? `Skip the ${starch.join(" and ")} and add a green vegetable or cauliflower rice.` : "Have a smaller portion with a big salad."}`);
  }
  for (const d of n.diabetes) {
    if (nut.carbs > d.carbsPerMeal + 10) tips.push(`${d.name}: about ${nut.carbs} g carbs a plate (your goal is ${d.carbsPerMeal}). ${starch.length ? `Have about half the ${starch[0]} and fill up on protein and vegetables.` : "Have a smaller portion and add vegetables."}`);
  }
  if (n.lowSodium.length) {
    const mg = estimateSodium(r);
    const limit = Math.min(...n.lowSodium.map((x) => x.perMeal));
    if (mg > limit) {
      const swaps = [...new Set(SALTY_SWAPS.filter(([re]) => lines.some((l) => re.test(l))).map(([, s]) => s))].slice(0, 3);
      tips.push(`${n.lowSodium.map((x) => x.name).join(" & ")} (low sodium): about ${mg.toLocaleString("en-US")} mg sodium a plate. ${swaps.length ? `Use ${swaps.join(", ")}, and skip extra salt at the table.` : "Go light on salt and seasoning blends, and skip extra salt at the table."}`);
    }
  }
  return tips;
}

/** Grocery list notes for the week. */
export function healthGroceryNotes(n: HealthNeeds): string[] {
  const notes: string[] = [];
  if (n.lowSodium.length) notes.push("Low sodium: pick low-sodium broth, no-salt-added canned beans and tomatoes, and unsalted butter.");
  if (n.keto.length) notes.push(`For ${n.keto.join(" & ")} (keto): add a bag of cauliflower rice and salad greens to swap for the starchy sides.`);
  return notes;
}
