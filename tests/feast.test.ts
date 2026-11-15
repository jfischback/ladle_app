import { test } from "node:test";
import assert from "node:assert/strict";
import { THANKSGIVING, feastDishes, feastTimeline, feastTips, turkeyFor, withFeast } from "@/lib/feast";
import { feastSection, withFeastSections } from "@/lib/feast-grocery";
import { mergeDuplicates } from "@/lib/grocery-merge";
import type { PlanDay } from "@/lib/types";

const all = THANKSGIVING.filter((d) => d.default).map((d) => d.key);
const feast = (guests: number, extra: Partial<NonNullable<PlanDay["feast"]>> = {}) => ({ holiday: "Thanksgiving", guests, dishes: all, frozen: true, ...extra });

test("the turkey fits the table", () => {
  assert.deepEqual([turkeyFor(4).kind, turkeyFor(4).lb], ["bone-in turkey breast", 4]);
  assert.equal(turkeyFor(10).lb, 13);
  assert.equal(turkeyFor(10).thawDays, 4);
  const crowd = turkeyFor(24);
  assert.ok(crowd.two && crowd.lb === 15, "30 lb is two birds");
});

test("sides scale to the guest count in half recipes", () => {
  const d = feastDishes(feast(20));
  const potatoes = d.find((x) => x.key === "potatoes")!;
  assert.equal(potatoes.times, 2);
  assert.equal(potatoes.scaled[0].amount, "10");
  assert.equal(d.find((x) => x.key === "turkey")!.scaled[0].unit, "(25 lb)".replace("25", String(turkeyFor(20).lb)));
});

test("the feast's groceries are one section, without pan drippings, kept apart from the week", () => {
  const sec = feastSection(feast(12));
  assert.equal(sec.name, "Thanksgiving dinner (12 people)");
  assert.ok(sec.items.some((i) => /whole turkey/.test(i.item) && /15 lb/.test(i.quantity)), JSON.stringify(sec.items.slice(0, 3)));
  assert.ok(!sec.items.some((i) => /drippings/.test(i.item)));
  const butter = sec.items.find((i) => i.item.startsWith("butter"));
  assert.ok(butter, "butter is on it");
  const week = { source: "basic" as const, sections: [{ name: "Dairy & Eggs", items: [{ item: "butter", quantity: "1 lb", forRecipes: ["Pancakes"] }] }] };
  const days = [{ date: "2026-11-26", recipeId: null, recipeName: null, estimatedCost: null, reason: "", saleItems: [], alternatives: [], feast: feast(12) }];
  const merged = mergeDuplicates(withFeastSections(week, days));
  assert.equal(merged.sections.length, 2, "the feast section isn't merged into the week");
  assert.equal(withFeastSections(merged, [{ ...days[0], feast: null }]).sections.length, 1, "taking the feast off removes its section");
});

test("the feast replaces the planned dinner; its leftovers night becomes feast leftovers", () => {
  const d = (date: string, recipeId: string | null, extra: Partial<PlanDay> = {}): PlanDay => ({ date, recipeId, recipeName: recipeId, estimatedCost: 9, reason: "", saleItems: [], alternatives: [], ...extra });
  const days = [d("2026-11-26", "chili", { batches: 2, holiday: "Thanksgiving" }), d("2026-11-27", "chili", { leftoverOf: "2026-11-26", lunch: { kind: "leftovers", recipeId: "chili", name: "Leftover chili", reason: "", eaters: "everyone", servings: 4 } })];
  const out = withFeast(days, 0, feast(8));
  assert.equal(out[0].recipeId, null);
  assert.equal(out[0].feast?.replaced, "chili");
  assert.equal(out[1].recipeName, "Thanksgiving leftovers");
  assert.equal(out[1].lunch?.name, "Thanksgiving leftovers");
});

test("the countdown: thaw days ahead, the day before, the big day", () => {
  const steps = feastTimeline(feast(10), "2026-11-26");
  assert.equal(steps[0].date, "2026-11-22");
  assert.match(steps[0].what, /13 lb takes about 4 days/);
  assert.ok(steps.some((s) => s.date === "2026-11-25" && /Pumpkin Pie/.test(s.what)));
  assert.equal(feastTimeline(feast(10, { frozen: false }), "2026-11-26")[0].date, "2026-11-25", "a fresh turkey needs no thawing");
  const tips = feastTips([{ date: "2026-11-26", recipeId: null, recipeName: null, estimatedCost: null, reason: "", saleItems: [], alternatives: [], feast: feast(10) }]);
  assert.match(tips.get("2026-11-22")![0], /^🦃 For Thu/);
});

test("the feast list buys whole packages and lists each thing once", async () => {
  const { wholePackages } = await import("@/lib/feast-grocery");
  assert.equal(wholePackages("1 1/2 (6 oz) can"), "2 (6 oz) cans");
  assert.equal(wholePackages("1 1/2"), "2");
  assert.equal(wholePackages("6 1/2 stalks"), "7 stalks");
  assert.equal(wholePackages("2 2/3 cups"), "2 2/3 cups");
  const sec = feastSection(feast(12));
  const names = sec.items.map((i) => i.item);
  assert.equal(names.filter((n) => n === "butter").length, 1);
  assert.ok(!names.some((n) => n.includes(",")), names.join(" | "));
  assert.ok(sec.items.find((i) => i.item === "refrigerated pie crust")!.quantity === "2");
});

test("taking the feast off clears its leftovers night and next-day lunch", async () => {
  const { withoutFeast } = await import("@/lib/feast");
  const d = (date: string, recipeId: string | null, extra: Partial<PlanDay> = {}): PlanDay => ({ date, recipeId, recipeName: recipeId, estimatedCost: 9, reason: "", saleItems: [], alternatives: [], ...extra });
  const days = withFeast([d("2026-11-26", "chili", { holiday: "Thanksgiving" }), d("2026-11-27", "chili", { leftoverOf: "2026-11-26", lunch: { kind: "leftovers", recipeId: "chili", name: "Leftover chili", reason: "", eaters: "everyone", servings: 4 } })], 0, feast(8));
  const out = withoutFeast(days, 0);
  assert.equal(out[0].feast, null);
  assert.equal(out[1].leftoverOf, null);
  assert.equal(out[1].recipeName, null);
  assert.equal(out[1].lunch?.kind, "open");
});
