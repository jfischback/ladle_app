import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanItems } from "@/lib/fridge";

test("fridge items are short, plain and distinct", () => {
  assert.deepEqual(cleanItems(["Chicken thighs", "chicken thighs", " Broccoli! ", "x", "<b>milk</b>"]), ["chicken thighs", "broccoli", "b milk b"]);
  assert.equal(cleanItems(Array.from({ length: 40 }, (_, i) => `item ${i}`)).length, 20);
});
