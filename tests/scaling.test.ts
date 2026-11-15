import { test } from "node:test";
import assert from "node:assert/strict";
import { niceAmount, recipeMultipliers, scaleIngredient } from "@/lib/scaling";
import { rebalanceBatches } from "@/lib/budget";
import type { PlanDay } from "@/lib/types";

test("amounts read nicely", () => {
  assert.equal(niceAmount(1.5), "1 1/2");
  assert.equal(niceAmount(1 / 3), "1/3");
  assert.equal(niceAmount(3), "3");
  assert.equal(niceAmount(0.97), "1");
  assert.equal(niceAmount(0.125), "1/8");
  assert.equal(niceAmount(0.01), "1/8"); // never "0"
});

test("ingredients scale", () => {
  assert.equal(scaleIngredient({ amount: "1 1/2", unit: "cups", item: "rice" }, 2).amount, "3");
  assert.equal(scaleIngredient({ amount: "1/2", unit: "lb", item: "beef" }, 1.5).amount, "3/4");
  assert.equal(scaleIngredient({ amount: "2-3", unit: "", item: "eggs" }, 2).amount, "4 to 6");
  assert.equal(scaleIngredient({ amount: "2 large", unit: "", item: "eggs" }, 2).amount, "4 large");
  assert.equal(scaleIngredient({ amount: "", unit: "", item: "salt to taste" }, 2).amount, "");
  assert.equal(scaleIngredient({ amount: "1/4", unit: "tsp", item: "salt" }, 0.5).amount, "1/8");
});

test("how many batches the week needs", () => {
  const days = [
    { date: "a", recipeId: "A", batches: 2 },
    { date: "b", recipeId: "A", leftoverOf: "a" },
    { date: "c", recipeId: "B", lunch: { kind: "leftovers", recipeId: "A", servings: 1 } },
    { date: "d", recipeId: null, breakfast: { recipeId: "C", servings: 2.5 } },
  ] as unknown as PlanDay[];
  const m = recipeMultipliers(days, (id) => ({ A: 4, B: 2, C: 2 })[id as "A"], { adults: 2, kids: 2 });
  assert.equal(m.get("A"), 2); // 3.2 + 3.2 + 1 of 4
  assert.equal(m.get("B"), 2); // 3.2 of 2
  assert.equal(m.get("C"), 1.5);
  const two = recipeMultipliers([{ date: "a", recipeId: "A" }] as PlanDay[], () => 4, { adults: 2, kids: 0 });
  assert.equal(two.get("A"), 0.5, "two people: half of a 4-serving recipe");
  const one = recipeMultipliers([{ date: "a", recipeId: "A" }] as PlanDay[], () => 4, { adults: 1, kids: 0 });
  assert.equal(one.get("A"), 0.5, "never below a half batch");
});

test("leftovers nights stay consistent after swaps", () => {
  const keep = (id: string) => id !== "SALAD";
  const cook = { date: "d1", recipeId: "A", recipeName: "Chili", estimatedCost: 20, batches: 2, reason: "Good · double batch for Tue" } as PlanDay;
  const left = { date: "d2", recipeId: "A", recipeName: "Chili", estimatedCost: 0, leftoverOf: "d1", reason: "Leftovers" } as PlanDay;
  const swappedLeftover = rebalanceBatches([cook, { date: "d2", recipeId: "B", recipeName: "Tacos", estimatedCost: 8, leftoverOf: null, reason: "Your pick" } as PlanDay], keep);
  assert.deepEqual([swappedLeftover[0].batches, swappedLeftover[0].estimatedCost, swappedLeftover[0].reason], [undefined, 10, "Good"]);
  const salad = rebalanceBatches([{ ...cook, recipeId: "SALAD", batches: undefined, estimatedCost: 6 }, { ...left, recipeId: "SALAD" }], keep);
  assert.equal(salad[1].recipeId, null, "a dinner that doesn't reheat well can't have a leftovers night");
  const soup = rebalanceBatches([{ ...cook, recipeId: "SOUP", batches: undefined, estimatedCost: 7 }, { ...left, recipeId: "SOUP" }], keep);
  assert.deepEqual([soup[0].batches, soup[0].estimatedCost], [2, 14]);
  assert.deepEqual(rebalanceBatches([cook, left], keep), [cook, left]);
});
