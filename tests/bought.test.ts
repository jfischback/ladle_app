import { test } from "node:test";
import assert from "node:assert/strict";
import { boughtMatches } from "@/lib/bought";

const pantry = [{ id: "p1", name: "Olive oil" }, { id: "p2", name: "Soy sauce" }, { id: "p3", name: "Rao's marinara" }];
const extras = [{ id: "x1", category: "snacks", name: "Goldfish crackers" }, { id: "x2", category: "drinks", name: "Sparkling water" }];

test("ticking a grocery line marks only the pantry and snack items it stands for", () => {
  const m = boughtMatches([{ section: "Canned & Dry Goods", item: "olive oil" }, { section: "Snacks", item: "goldfish crackers" }], pantry, extras);
  assert.deepEqual(m.pantryIds, ["p1"]);
  assert.deepEqual(m.extraIds, ["x1"]);
});

test("a snack only counts in its own section, and nothing ticked means nothing bought", () => {
  assert.deepEqual(boughtMatches([{ section: "Produce", item: "sparkling water" }], pantry, extras).extraIds, []);
  assert.deepEqual(boughtMatches([], pantry, extras), { pantryIds: [], extraIds: [] });
});

test("a stock-up deal counts once it's ticked in the stock-up section", () => {
  const stockUp = [{ item: "rao's marinara" }];
  const hit = boughtMatches([{ section: "Stock up (on sale)", item: "Rao's Homemade Marinara Sauce" }], pantry, extras, stockUp);
  assert.ok(hit.pantryIds.includes("p3") || boughtMatches([{ section: "Stock up (on sale)", item: "x" }], pantry, extras, [{ item: "raos marinara" }]).pantryIds.includes("p3"), JSON.stringify(hit));
  assert.deepEqual(boughtMatches([{ section: "Produce", item: "onions" }], pantry, extras, stockUp).pantryIds, []);
});
