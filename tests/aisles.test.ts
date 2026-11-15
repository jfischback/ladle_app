import { test } from "node:test";
import assert from "node:assert/strict";
import { aisleOf, notBought } from "@/lib/aisles";
import { basicGroceryList } from "@/lib/grocery";
import type { Recipe } from "@/db/schema";

test("items land in the right store section", () => {
  const cases: [string, string][] = [
    ["yellow onion, chopped", "Produce"], ["garlic, minced", "Produce"], ["red bell pepper, diced", "Produce"],
    ["freshly ground black pepper", "Spices, Oils & Sauces"], ["garlic powder", "Spices, Oils & Sauces"], ["olive oil", "Spices, Oils & Sauces"],
    ["crushed tomatoes (fire-roasted recommended)", "Canned & Dry Goods"], ["black beans, drained", "Canned & Dry Goods"], ["peanut butter", "Canned & Dry Goods"],
    ["frozen corn", "Frozen"], ["boneless, skinless chicken thighs", "Meat & Seafood"], ["New York strip or ribeye steaks", "Meat & Seafood"],
    ["hot Italian sausages, casings removed", "Meat & Seafood"], ["sliced deli ham", "Deli"], ["shredded rotisserie chicken", "Deli"],
    ["shredded cheddar cheese", "Dairy & Eggs"], ["large eggs", "Dairy & Eggs"], ["unsalted butter, melted", "Dairy & Eggs"],
    ["corn or flour tortillas, warmed", "Bakery & Bread"], ["hamburger buns", "Bakery & Bread"],
  ];
  for (const [item, want] of cases) assert.equal(aisleOf(item), want, item);
});

test("water and skewers aren't groceries", () => {
  assert.ok(notBought("water, divided"));
  assert.ok(notBought("Large pot of water"));
  assert.ok(notBought("bamboo skewers, soaked in water 30 minutes"));
  assert.ok(!notBought("sparkling water"));
});

test("the basic list is sorted into sections in store order", () => {
  const r = { id: "r1", name: "Tacos", servings: 4, ingredients: [
    { amount: "1", unit: "lb", item: "ground beef" }, { amount: "1", unit: "", item: "onion, chopped" },
    { amount: "8", unit: "", item: "corn tortillas" }, { amount: "1", unit: "cup", item: "shredded cheese" }, { amount: "1", unit: "cup", item: "water" },
  ] } as unknown as Recipe;
  const list = basicGroceryList([r]);
  assert.deepEqual(list.sections.map((s) => s.name), ["Produce", "Meat & Seafood", "Dairy & Eggs", "Bakery & Bread"]);
});

test("the basic list adds up the same item from two recipes", () => {
  const mk = (id: string, amount: string) => ({ id, name: id, servings: 4, ingredients: [{ amount, unit: "cup", item: "shredded cheese" }] }) as unknown as Recipe;
  const list = basicGroceryList([mk("Tacos", "1/2"), mk("Omelet", "1/4")]);
  const cheese = list.sections.flatMap((s) => s.items).find((i) => i.item === "shredded cheese")!;
  assert.equal(cheese.quantity, "3/4 cup");
});
