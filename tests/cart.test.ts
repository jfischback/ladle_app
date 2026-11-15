import { test } from "node:test";
import assert from "node:assert/strict";
import { cartQuantity, packagesForWeight, unitPrice } from "@/lib/cart";

test("cart quantities from grocery lines", () => {
  const cases: [string, string, number][] = [
    ["3", "onions", 3], ["3 1/2 (10 oz) can", "enchilada sauce", 4], ["4 (16 oz) can", "refried beans", 4],
    ["8 + 4", "flour tortillas", 2], ["18", "eggs", 2], ["6", "eggs", 1], ["2 dozen", "eggs", 2],
    ["1 1/2 lb", "ground beef", 1], ["1/4 cup + 6 cups + 2 cup", "shredded cheddar cheese", 1], ["2 cloves", "garlic", 1],
    ["2 jars", "salsa", 2], ["6 slices", "bread", 1], ["12 slices", "bacon", 1], ["2", "avocados", 2], ["", "salt to taste", 1],
    ["2 (15 oz) cans + 1 (15 oz) can", "black beans", 3], ["8", "hamburger buns", 1], ["2 heads", "lettuce", 2],
  ];
  for (const [q, item, want] of cases) assert.equal(cartQuantity(q, item), want, `${q} ${item}`);
});

test("weighed items use the package size", () => {
  assert.equal(packagesForWeight("4 lbs + 2 lb", "1 lb"), 6);
  assert.equal(packagesForWeight("3 3/4 lb", "3 lb"), 2);
  assert.equal(packagesForWeight("12 oz", "16 oz"), 1);
  assert.equal(packagesForWeight("2 cups", "16 oz"), null);
});

test("price per ounce", () => {
  assert.equal(unitPrice("2 lb", 4)?.per, 0.125);
  assert.equal(unitPrice("12 ct", 6)?.unit, "ct");
  assert.equal(unitPrice("family size", 4), null);
});
