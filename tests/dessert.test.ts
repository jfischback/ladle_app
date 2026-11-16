import { test } from "node:test";
import assert from "node:assert/strict";
import { planDesserts } from "@/lib/dessert";
import type { PlanDay } from "@/lib/types";
import { settings, starterBox } from "./helpers";

// A week from Monday Nov 23 to Sunday Nov 29, 2026, dinner every night but Thursday.
const week = (): PlanDay[] =>
  ["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"].map((date, i) => ({
    date, recipeId: i === 3 ? null : `dinner-${i}`, recipeName: i === 3 ? null : "Dinner", estimatedCost: null, reason: "", saleItems: [], leftoverOf: null,
  }) as PlanDay);

const desserts = starterBox("dessert");

test("there are starter desserts, all of them meal: dessert", () => {
  assert.ok(desserts.length >= 10);
});

test("none when dessert nights is 0", () => {
  const out = planDesserts(week(), settings({ dessertNights: 0 }), desserts, []);
  assert.ok(out.every((d) => !d.dessert));
});

test("weekend nights first, no repeats, only on dinner nights", () => {
  const out = planDesserts(week(), settings({ dessertNights: 3 }), desserts, []);
  const nights = out.filter((d) => d.dessert);
  assert.deepEqual(nights.map((d) => d.date), ["2026-11-27", "2026-11-28", "2026-11-29"]);
  assert.equal(new Set(nights.map((d) => d.dessert!.recipeId)).size, 3);
  assert.ok(nights.every((d) => d.dessert!.servings > 0));
});

test("food rules: a dairy-free family never gets a dairy dessert", () => {
  for (let n = 0; n < 10; n++) {
    const out = planDesserts(week(), settings({ dessertNights: 2, foodRules: ["no-dairy"] }), desserts, []);
    for (const d of out.filter((x) => x.dessert)) {
      const r = desserts.find((x) => x.id === d.dessert!.recipeId)!;
      assert.ok(!r.ingredients.some((i) => /milk|butter|cream cheese|ice cream|yogurt/i.test(i.item)), `${r.name} has dairy`);
    }
  }
});

test("a dessert with a sale ingredient is picked first and says so", () => {
  const out = planDesserts(week(), settings({ dessertNights: 1 }), desserts, [{ item: "strawberries", product: "Strawberries 1 lb", size: "1 lb", regularPrice: 4, salePrice: 2, pctOff: 50 }]);
  const d = out.find((x) => x.dessert)!.dessert!;
  assert.match(d.name, /strawberr/i);
  assert.match(d.reason, /On sale this week: strawberries/);
});

test("a busy night gets a quick dessert", () => {
  for (let n = 0; n < 10; n++) {
    const out = planDesserts(week(), settings({ dessertNights: 1, busyDays: [5] }), desserts, []);
    const d = out.find((x) => x.dessert)!;
    const r = desserts.find((x) => x.id === d.dessert!.recipeId)!;
    assert.ok((r.totalMinutes ?? 30) <= 20, `${r.name} takes ${r.totalMinutes} min on a busy Friday`);
  }
});
