import { test } from "node:test";
import assert from "node:assert/strict";
import { recipeSaleSummary, saleEnds, saleEndDate } from "@/lib/sale-summary";
import type { SaleItem } from "@/lib/types";

const sale = (item: string, regularPrice: number, salePrice: number, endsOn: string | null = null): SaleItem => ({ item, product: item, size: "", regularPrice, salePrice, pctOff: Math.round((1 - salePrice / regularPrice) * 100), endsOn });

const recipe = {
  ingredients: [
    { amount: "1", unit: "lb", item: "chicken thighs" },
    { amount: "1", unit: "cup", item: "heavy cream" },
    { amount: "1", unit: "", item: "yellow onion, chopped" },
    { amount: "", unit: "", item: "Salt, to taste" },
    { amount: "1", unit: "tbsp", item: "olive oil" },
  ],
};

test("counts what's on sale, costly items first, and skips pantry basics", () => {
  const s = recipeSaleSummary(recipe, ["old string sale", sale("heavy cream", 3.5, 2.5), sale("chicken thigh", 6, 4), sale("chicken thighs", 7, 4.5), sale("bananas", 1, 0.5)]);
  assert.equal(s.total, 3); // chicken, cream, onion (salt and oil don't count)
  assert.deepEqual(s.onSale.map((x) => x.item), ["chicken thighs", "heavy cream"]);
  assert.equal(s.saved, 3.5);
});

test("nothing on sale", () => {
  const s = recipeSaleSummary(recipe, []);
  assert.equal(s.onSale.length, 0);
  assert.equal(s.saved, 0);
});

test("sale end dates from Kroger's price data", () => {
  assert.equal(saleEndDate({ value: "2026-11-18T23:59:59Z", timezone: "UTC" }), "2026-11-18");
  assert.equal(saleEndDate("2026-11-18"), "2026-11-18");
  assert.equal(saleEndDate(undefined), null);
  assert.equal(saleEndDate({ value: 5 }), null);
  assert.equal(saleEnds("2026-11-18"), "ends Wed 11/18");
  assert.equal(saleEnds(null), "");
  assert.equal(saleEnds("soon"), "");
});
