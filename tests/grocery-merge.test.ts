import { test } from "node:test";
import assert from "node:assert/strict";
import { addQuantities, itemKey, mergeDuplicates, plural, singular } from "@/lib/grocery-merge";
import type { GroceryList } from "@/lib/types";

const line = (item: string, quantity: string, note = "", forRecipes: string[] = []) => ({ item, quantity, note, forRecipes });

test("the same thing is spotted under different names", () => {
  assert.equal(itemKey("Eggs"), itemKey("large eggs"));
  assert.equal(itemKey("Eggs"), itemKey("Eggs, dozen"));
  assert.equal(itemKey("Chicken breast"), itemKey("boneless skinless chicken breasts"));
  assert.notEqual(itemKey("Milk"), itemKey("Whole milk"));
  assert.notEqual(itemKey("Peanut butter"), itemKey("Butter"));
  assert.notEqual(itemKey("shredded cheddar cheese"), itemKey("shredded mozzarella"));
});

test("duplicates across sections become one line", () => {
  const list: GroceryList = {
    source: "basic",
    sections: [
      { name: "Weekly staples", items: [line("Eggs", "2 dozen"), line("Milk", "1 gallon")] },
      { name: "Everything", items: [line("large eggs", "3", "", ["Omelet"]), line("milk", "1/2 cup", "", ["Pancakes"]), line("onion", "1")] },
      { name: "Athlete fuel", items: [line("Eggs", "1 dozen", "For Jake")] },
      { name: "Baby", items: [line("Baby yogurt cups", "6")] },
      { name: "Breakfast meat deal", items: [line("Eggs", "x")] },
    ],
  };
  const out = mergeDuplicates(list);
  const staples = out.sections.find((s) => s.name === "Weekly staples")!;
  const eggs = staples.items.find((i) => i.item === "Eggs")!;
  assert.equal(eggs.quantity, "3 dozen + 3");
  assert.match(eggs.note!, /also for recipes/);
  assert.match(eggs.note!, /For Jake/);
  assert.deepEqual(eggs.forRecipes, ["Omelet"]);
  assert.equal(staples.items.find((i) => i.item === "Milk")!.quantity, "1 gallon + 1/2 cup");
  assert.equal(out.sections.find((s) => s.name === "Athlete fuel"), undefined, "an emptied section disappears");
  assert.deepEqual(out.sections.find((s) => s.name === "Everything")!.items.map((i) => i.item), ["onion"]);
  assert.equal(out.sections.find((s) => s.name === "Breakfast meat deal")!.items.length, 1, "deals stay apart");
  assert.equal(out.sections.find((s) => s.name === "Baby")!.items.length, 1);
});

test("amounts add up by unit", () => {
  assert.equal(addQuantities(["1 gallon", "1/2 cup", "1 gallon"]), "2 gallons + 1/2 cup");
  assert.equal(addQuantities(["4", "3", "4 1/2"]), "11 1/2");
  assert.equal(addQuantities(["1 cup", "2 cups"]), "3 cups");
  assert.equal(addQuantities(["1 (15 oz) can", "1 (15 oz) can"]), "1 (15 oz) can + 1 (15 oz) can");
  assert.equal(addQuantities(["1 lb", "1/2 lb"]), "1 1/2 lb");
});

test("plurals read right", () => {
  assert.equal(addQuantities(["1 loaf", "1 loaf", "6 slices"]), "2 loaves + 6 slices");
  assert.equal(addQuantities(["1 bunch", "1 bunch"]), "2 bunches");
  assert.equal(addQuantities(["1 box", "2 boxes"]), "3 boxes");
  assert.equal(addQuantities(["8 oz", "8 oz"]), "16 oz");
  assert.equal(addQuantities(["2 large", "1 large"]), "3 large");
  for (const w of ["slice", "loaf", "bunch", "berry", "cup", "box", "leaf", "glass"]) assert.equal(singular(plural(w)), w, w);
});
