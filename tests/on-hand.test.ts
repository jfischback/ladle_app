import { test } from "node:test";
import assert from "node:assert/strict";
import { onHandMatch, parseOnHand, rankByOnHand } from "@/lib/on-hand";
import { starterBox } from "./helpers";

test("parses what someone typed they have", () => {
  assert.deepEqual(parseOnHand("Chicken, rice and broccoli\nsour cream"), ["chicken", "rice", "broccoli", "sour cream"]);
});

test("matches what's on hand and lists what's missing", () => {
  const r = { ingredients: [
    { item: "boneless chicken thighs", amount: "2", unit: "lb" },
    { item: "white rice", amount: "1", unit: "cup" },
    { item: "salt", amount: "1", unit: "tsp" },
    { item: "broccoli florets", amount: "2", unit: "cups" },
    { item: "peanut butter", amount: "2", unit: "tbsp" },
  ] };
  const m = onHandMatch(r as never, parseOnHand("chicken, rice, butter"));
  assert.equal(m.total, 4, "salt doesn't count");
  assert.equal(m.have, 2);
  assert.deepEqual(m.need, ["broccoli florets", "peanut butter"], "butter isn't peanut butter");
});

test("ranks the starters by fewest missing", () => {
  const ranked = rankByOnHand(starterBox("dinner"), parseOnHand("chicken, rice, onion, garlic"), ["butter", "sour cream"]);
  assert.ok(ranked.length > 5);
  assert.ok(ranked.every((x) => x.usesUp > 0), "only dinners that use something typed in");
  assert.ok(ranked[0].usesUp >= 2, "the top pick uses up several of them");
  assert.ok(ranked.slice(0, 5).some((x) => /chicken/i.test(x.r.name)), ranked.slice(0, 5).map((x) => x.r.name).join(", "));
});

test("typed words don't match a different product", async () => {
  const { onHandMatch } = await import("@/lib/on-hand");
  const ing = (item: string) => ({ item, amount: "1", unit: "" });
  const m = onHandMatch({ ingredients: [ing("chicken broth"), ing("onion powder"), ing("yellow onion"), ing("brown rice"), ing("chicken breasts")] } as never, ["chicken", "onion", "rice"]);
  assert.deepEqual(m.need, ["chicken broth", "onion powder"]);
});

test("cauliflower rice and rice vinegar aren't rice", async () => {
  const { onHandMatch } = await import("@/lib/on-hand");
  const ing = (item: string) => ({ item, amount: "1", unit: "" });
  const m = onHandMatch({ ingredients: [ing("cauliflower rice"), ing("rice vinegar"), ing("jasmine rice")] } as never, ["rice"]);
  assert.deepEqual(m.need, ["cauliflower rice", "rice vinegar"]);
});

test("what to buy reads as the thing, not the prep", async () => {
  const { onHandMatch } = await import("@/lib/on-hand");
  const m = onHandMatch({ ingredients: [{ item: "boneless, skinless chicken thighs, cut in strips", amount: "1", unit: "lb" }, { item: "yellow onion, diced (about 1 cup)", amount: "1", unit: "" }] } as never, []);
  assert.deepEqual(m.need, ["boneless skinless chicken thighs", "yellow onion"]);
});

test("the thing itself has to match: tortillas, not corn; potatoes, not sweet potatoes", async () => {
  const { onHandMatch } = await import("@/lib/on-hand");
  const ing = (item: string) => ({ item, amount: "1", unit: "" });
  const r = { ingredients: [ing("corn tortillas"), ing("frozen corn"), ing("sweet potatoes, cubed"), ing("russet potatoes"), ing("boneless, skinless chicken thighs, cut in strips"), ing("broccoli florets")] } as never;
  assert.deepEqual(onHandMatch(r, ["tortillas", "potatoes", "chicken", "broccoli"]).need, ["frozen corn", "sweet potatoes"]);
  assert.deepEqual(onHandMatch(r, ["corn"]).need.includes("corn tortillas"), true, "corn isn't corn tortillas");
});

test("pantry names still match", async () => {
  const { onHandMatch } = await import("@/lib/on-hand");
  const ing = (item: string) => ({ item, amount: "1", unit: "" });
  const r = { ingredients: [ing("shredded cheddar cheese"), ing("olive oil"), ing("kosher salt"), ing("grated parmesan cheese")] } as never;
  assert.deepEqual(onHandMatch(r, ["Shredded cheddar", "Good olive oil, like California Olive Ranch", "parmesan"]).need, []);
});
