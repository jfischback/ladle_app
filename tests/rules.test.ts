import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleProblems } from "@/lib/diet";
import { leftoverKind } from "@/lib/leftovers";
import { pickyTips } from "@/lib/picky";
import { healthNeeds, healthTips } from "@/lib/health";
import { canCook, equipmentNeeded } from "@/lib/prep";
import { newAthlete, normalizeAthlete, suggestTargets } from "@/lib/athletes";
import { storeBrand } from "@/lib/stores";
import { starterBox } from "./helpers";

const R = (name: string, items: string[], extra: object = {}) => ({ name, ingredients: items.map((item) => ({ amount: "1", unit: "", item })), ...extra });

test("food rules", () => {
  assert.ok(ruleProblems(R("Shrimp tacos", ["shrimp"]), ["no-seafood"]).length);
  assert.equal(ruleProblems(R("Bean tacos", ["black beans", "coconut milk"]), ["vegan"]).length, 0);
  assert.ok(ruleProblems(R("Bean tacos", ["black beans", "cheddar"]), ["vegan"]).length);
  assert.ok(ruleProblems(R("Turkey sandwich", ["deli turkey"]), ["pregnancy"]).length);
  assert.equal(ruleProblems(R("Peanut butter toast", ["peanut butter"]), ["no-dairy"]).length, 0);
});

test("leftovers", () => {
  assert.equal(leftoverKind(R("Beef Chili", ["ground beef"])), "ok");
  for (const n of ["Ham and Cheese Omelet", "Chicken Quesadillas", "Pancakes", "Chicken Fettuccine Alfredo", "Grilled Steak", "Mac and Cheese in a Mug"]) {
    assert.equal(leftoverKind(R(n, [])), "none", n);
  }
});

test("picky eater tips", () => {
  const ava = [{ id: "a", name: "Ava", wontEat: ["onions", "spicy"], safeFoods: ["buttered noodles"] }];
  const tips = pickyTips(R("Classic Burgers", ["ground beef", "onion, sliced", "cilantro, for garnish"]), ava);
  assert.equal(tips.length, 1);
  assert.match(tips[0].tip, /without the onion/);
  const soup = pickyTips(R("Onion Soup", ["onions"]), ava);
  assert.equal(soup[0].kind, "side");
  assert.match(soup[0].tip, /buttered noodles/);
});

test("health tips are plain and use the person's own goal", () => {
  const dad = { ...newAthlete("Dad"), conditions: ["diabetes" as const], carbsPerMeal: 45 };
  const tips = healthTips(
    { name: "Spaghetti", servings: 4, ingredients: [{ amount: "1", unit: "lb", item: "spaghetti" }, { amount: "1", unit: "(24 oz) jar", item: "marinara sauce" }] },
    healthNeeds([dad]),
  );
  assert.equal(tips.length, 1);
  assert.match(tips[0], /Dad: about \d+ g carbs a plate \(your goal is 45\)/);
});

test("kitchen equipment", () => {
  assert.ok(equipmentNeeded({ name: "Pasta", ingredients: [], steps: ["Cook the pasta."] }).has("stovetop"));
  assert.ok(canCook({ name: "Slow Cooker Chili", ingredients: [], steps: ["Add to the slow cooker."] }, ["stovetop"]));
  assert.ok(!canCook({ name: "Sheet Pan Chicken", ingredients: [], tags: ["sheet-pan"], steps: ["Roast 20 minutes."] }, ["microwave"]));
  assert.ok(starterBox().filter((r) => canCook(r, ["microwave"])).length >= 8, "enough microwave-only dinners");
});

test("athlete and health targets", () => {
  assert.deepEqual(suggestTargets({ sport: "strongman", phase: "maintain", youth: false, milesPerWeek: null }, 200), { calories: 4200, protein: 200 });
  const p = suggestTargets({ sport: "active", phase: "cut", youth: false, milesPerWeek: null, conditions: ["pregnant"], trimester: 3 }, 150);
  assert.equal(p.calories, 2550, "pregnancy never cuts calories");
  assert.equal(normalizeAthlete({ id: "x", name: "J", goal: "strength" } as never).sport, "strongman", "old goals convert");
});

test("store names", () => {
  assert.equal(storeBrand("Fry's Marketplace - Gantzel Combs").name, "Fry's");
  assert.equal(storeBrand("Ralphs").name, "Ralphs");
  assert.equal(storeBrand("King Soopers").site, "https://www.kingsoopers.com");
  assert.equal(storeBrand("").name, null);
});

test("cooking-mode timers read the time from a step", async () => {
  const { stepMinutes } = await import("@/app/recipes/[id]/CookMode");
  assert.equal(stepMinutes("Simmer 15 minutes, stirring now and then."), 15);
  assert.equal(stepMinutes("Bake 20 to 25 minutes until golden."), 25);
  assert.equal(stepMinutes("Cook on low 6 hours or high 4 hours."), 360);
  assert.equal(stepMinutes("Season with salt."), null);
});
