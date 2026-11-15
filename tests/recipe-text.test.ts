import { test } from "node:test";
import assert from "node:assert/strict";
import { recipeText } from "@/lib/recipe-text";

const r = { name: "Chili", servings: 4, totalMinutes: 45, ingredients: [{ amount: "1", unit: "lb", item: "ground beef" }, { amount: "1", unit: "", item: "onion, chopped" }], steps: ["Brown the beef.", "Simmer 30 minutes."], creditName: "Grandma", creditUrl: null };

test("a recipe reads well as a text", () => {
  const t = recipeText(r);
  assert.match(t, /^Chili\nServes 4 · 45 min\n\nIngredients\n• 1 lb ground beef\n• 1 onion, chopped\n\nSteps\n1\. Brown the beef\.\n2\. Simmer 30 minutes\.\n\nFrom Grandma/);
});

test("it uses the servings picked on the page", () => {
  const t = recipeText(r, 2);
  assert.match(t, /Serves 8/);
  assert.match(t, /• 2 lb ground beef/);
});
