import { test } from "node:test";
import assert from "node:assert/strict";
import starters from "@/data/starter-recipes.json";
import { estimateCost, estimateNutrition, estimateSodium, ingredientAmount, parseAmount } from "@/lib/nutrition";
import type { Ingredient } from "@/lib/types";

type R = { name: string; meal: string; servings: number | null; tags: string[]; ingredients: Ingredient[] };
const all = starters as unknown as R[];

test("amounts parse", () => {
  assert.equal(parseAmount("1 1/2"), 1.5);
  assert.equal(parseAmount("1/2"), 0.5);
  assert.equal(parseAmount("2-3"), 2.5);
  assert.equal(parseAmount("½"), 0.5);
});

test("known tricky lines", () => {
  const g = (i: Ingredient) => {
    const a = ingredientAmount(i);
    return a && a !== "skip" ? Math.round(a.grams) : a;
  };
  assert.equal(g({ amount: "200", unit: "g (7 oz)", item: "chicken thighs" }), 200);
  assert.equal(g({ amount: "2", unit: "cups (about 500 g)", item: "crushed tomato" }), 480);
  assert.equal(g({ amount: "8", unit: "slices", item: "pepperoni" }), 16);
  assert.equal(g({ amount: "1", unit: "(15 oz) can", item: "black beans" }), 425);
  assert.equal(g({ amount: "", unit: "", item: "About 2 lb bone-in chicken pieces" }), 907);
  assert.equal(g({ amount: "1", unit: "tsp", item: "black pepper" }), "skip");
});

test("every starter's estimate is believable", () => {
  for (const r of all) {
    const n = estimateNutrition(r);
    if (n.coverage < 0.6) continue;
    const [lo, hi] = r.meal === "dinner" ? [150, 1900] : [100, 1200];
    assert.ok(n.kcal >= lo && n.kcal <= hi, `${r.name}: ${n.kcal} kcal a serving`);
    assert.ok(estimateSodium(r) < 4500, `${r.name}: ${estimateSodium(r)} mg sodium`);
    assert.ok(estimateCost(r).perServing < 10, `${r.name}: ${estimateCost(r).perServing} dollars a serving`);
  }
});

test("the budget pack really is budget", () => {
  for (const r of all.filter((x) => x.tags.includes("budget"))) {
    assert.ok(estimateCost(r).perServing <= 2.5, `${r.name}: ${estimateCost(r).perServing} dollars a serving`);
  }
});
