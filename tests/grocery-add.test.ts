import { test } from "node:test";
import assert from "node:assert/strict";
import { ADDED_SECTION, addToList, parseAdded, removeFromList } from "@/lib/grocery-add";
import { cartItems } from "@/lib/cart";
import type { GroceryList } from "@/lib/types";

const base: GroceryList = { source: "basic", sections: [{ name: "Produce", items: [{ item: "onion", quantity: "1", forRecipes: ["Chili"] }] }] };

test("reads what someone typed", () => {
  assert.deepEqual(parseAdded("2 paper towels"), { item: "paper towels", quantity: "2" });
  assert.deepEqual(parseAdded("  milk "), { item: "milk", quantity: "1" });
  assert.deepEqual(parseAdded("3 x birthday candles"), { item: "birthday candles", quantity: "3" });
  assert.equal(parseAdded(" "), null);
});

test("added things get their own section, add up, come off, and go to the cart", () => {
  let list = addToList(base, "paper towels");
  list = addToList(list, "2 paper towels");
  list = addToList(list, "Milk");
  const mine = list.sections.find((s) => s.name === ADDED_SECTION)!;
  assert.deepEqual(mine.items.map((i) => [i.item, i.quantity, i.added]), [["paper towels", "3", true], ["Milk", "1", true]]);
  assert.equal(base.sections.length, 1, "the original list isn't changed");
  assert.ok(cartItems(list).some((c) => c.item === "paper towels" && c.quantity === 3));
  list = removeFromList(removeFromList(list, "paper towels"), "Milk");
  assert.ok(!list.sections.some((s) => s.name === ADDED_SECTION));
});
