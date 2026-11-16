import { test } from "node:test";
import assert from "node:assert/strict";
import { PARTY_DISHES, PARTY_KINDS, partyDish, partyDishes, partyTimeline, partyTimes } from "@/lib/party";
import { partyGroceries, withPartySection } from "@/lib/party-grocery";
import { ruleProblems } from "@/lib/diet";

test("every party kind's usual menu uses real dishes", () => {
  for (const k of PARTY_KINDS) for (const d of k.dishes) assert.ok(partyDish(d), `${k.key}: ${d}`);
  assert.equal(new Set(PARTY_DISHES.map((d) => d.key)).size, PARTY_DISHES.length);
});

test("amounts follow the crowd, with more when the food is the meal", () => {
  const board = partyDish("charcuterie")!;
  assert.equal(partyTimes(board, 12, false), 1);
  assert.equal(partyTimes(board, 30, false), 2.5);
  assert.equal(partyTimes(board, 12, true), 1.5);
  assert.equal(partyTimes(board, 4, false), 1); // never less than one
  const cake = partyDish("sheet-cake")!;
  assert.equal(partyTimes(cake, 40, false), 2); // cakes are whole
  const [d] = partyDishes({ guests: 24, meal: false, dishes: ["deviled-eggs"] });
  assert.equal(d.times, 2);
  assert.equal(d.scaled.find((x) => x.item === "eggs")?.amount, "24");
});

test("food rules flag what doesn't fit", () => {
  assert.ok(ruleProblems(partyDish("charcuterie")!, ["vegetarian"]).length > 0);
  assert.equal(ruleProblems(partyDish("fruit-platter")!, ["vegetarian", "no-dairy"]).length, 0);
  assert.ok(ruleProblems(partyDish("deviled-eggs")!, ["no-eggs"]).length > 0);
});

test("timeline: order the cake, shop two days before, make-ahead the day before, food safety on the day", () => {
  const t = partyTimeline({ date: "2026-12-12", guests: 20, meal: false, dishes: ["sheet-cake", "pasta-salad", "meatballs"] });
  assert.equal(t[0].date, "2026-12-08");
  assert.match(t[0].what, /cake/i);
  assert.ok(t.some((x) => x.date === "2026-12-10" && /shop/i.test(x.what)));
  assert.ok(t.some((x) => x.date === "2026-12-11" && /pasta salad/i.test(x.what)));
  assert.ok(t.some((x) => x.date === "2026-12-12" && /2 hours/.test(x.what)));
});

test("shopping list: one section, things bought whole, shared ingredients merged", () => {
  const s = partyGroceries({ title: "Sam's birthday", guests: 18, meal: false, dishes: ["deviled-eggs", "cupcakes", "veggie-tray", "fruit-platter"] });
  assert.equal(s.name, "Party: Sam's birthday");
  const eggs = s.items.filter((x) => /^eggs?$/i.test(x.item));
  assert.equal(eggs.length, 1);
  const pine = s.items.find((x) => /pineapple/i.test(x.item));
  assert.ok(pine && !/\//.test(pine.quantity), `pineapple bought whole: ${pine?.quantity}`);
  const list = withPartySection({ sections: [{ name: "Produce", items: [] }, { name: s.name, items: [] }], source: "basic" }, s);
  assert.deepEqual(list.sections.map((x) => x.name), [s.name, "Produce"]);
});

test("units agree with the amount once scaled", () => {
  const [d] = partyDishes({ guests: 24, meal: false, dishes: ["pinwheels"] });
  assert.equal(d.scaled.find((x) => x.item === "baby spinach")?.unit, "cups");
});
