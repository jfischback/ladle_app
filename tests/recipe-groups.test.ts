import { test } from "node:test";
import assert from "node:assert/strict";
import { groupOf, groupRecipes } from "@/lib/recipe-groups";

test("each starter protein lands in the right group", () => {
  assert.equal(groupOf("chicken"), "chicken");
  assert.equal(groupOf("chicken and beef"), "chicken");
  assert.equal(groupOf("beef"), "beef");
  assert.equal(groupOf("sausage"), "pork");
  assert.equal(groupOf("turkey"), "turkey");
  assert.equal(groupOf("seafood"), "seafood");
  for (const p of ["beans (no meat)", "dairy", "eggs", "tofu"]) assert.equal(groupOf(p), "meatless", p);
  assert.equal(groupOf(null), "other");
  assert.equal(groupOf("lamb"), "other");
});

test("groups keep A-to-Z order inside and drop empty groups", () => {
  const rows = [{ name: "B", protein: "beef" }, { name: "A", protein: "chicken" }, { name: "C", protein: "chicken" }];
  const g = groupRecipes(rows);
  assert.deepEqual(g.map((x) => x.key), ["chicken", "beef"]);
  assert.deepEqual(g[0].items.map((r) => r.name), ["A", "C"]);
});
