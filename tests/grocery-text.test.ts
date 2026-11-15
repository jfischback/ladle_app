import { test } from "node:test";
import assert from "node:assert/strict";
import { groceryText } from "@/lib/grocery-text";

const list = {
  source: "basic" as const,
  sections: [
    { name: "Produce", items: [{ item: "Onions", quantity: "2", forRecipes: [] }, { item: "Cilantro", quantity: "1 bunch", forRecipes: [] }] },
    { name: "Already in your pantry", items: [{ item: "Salt", quantity: "", forRecipes: [] }] },
    { name: "Pantry check", items: [{ item: "Olive oil", quantity: "2 Tbsp", forRecipes: [] }] },
  ],
};

test("the list as text, without what's already in the pantry", () => {
  assert.equal(groceryText(list, { title: "Ladle: week of Nov 21" }), [
    "Ladle: week of Nov 21", "", "Produce", "• Onions (2)", "• Cilantro (1 bunch)", "", "If you're out of these:", "• Olive oil (2 Tbsp)",
  ].join("\n"));
});

test("checked-off items are left out", () => {
  const text = groceryText(list, { isChecked: (s, i) => s === "Produce" && i === 0 });
  assert.ok(!text.includes("Onions"));
  assert.ok(text.includes("Cilantro"));
  const done = groceryText({ ...list, sections: [list.sections[0]] }, { isChecked: () => true });
  assert.match(done, /All done/);
});
