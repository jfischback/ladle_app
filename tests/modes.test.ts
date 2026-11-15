import { test } from "node:test";
import assert from "node:assert/strict";
import { averageCost, weekSaving } from "@/lib/mode-savings";

const day = (recipeId: string | null, estimatedCost: number | null, extra = {}) => ({ date: "2026-11-16", recipeId, recipeName: recipeId, estimatedCost, reason: "", saleItems: [], alternatives: [], ...extra });

test("Cost Cutting's saving: a typical week of your dinners minus this week's", () => {
  // Typical dinner $12; this week three dinners at $8, $9 and a double batch $16 (one dinner's worth is $8); leftovers and nights off don't count.
  const days = [day("a", 8), day("b", 9), day("c", 16, { batches: 2 }), day("c", 0, { leftoverOf: "x" }), day(null, null)];
  assert.equal(weekSaving(days, 12), 36 - 25);
  assert.equal(weekSaving([day("a", 20)], 12), 0, "never a negative saving");
  assert.equal(weekSaving([], 12), 0);
  assert.equal(averageCost([10, 14, 0, NaN]), 12);
});
