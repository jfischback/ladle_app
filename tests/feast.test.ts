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
  assert.equal(sec.name, "Thanksgiving dinner");
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

test("review fixes: roasting times, breast steps, thaw that's too late", () => {
  assert.equal(turkeyFor(8).roastHours, 3, "a 10 lb bird: up to 3 hours (USDA)");
  assert.ok(turkeyFor(40).lb <= 24 && turkeyFor(40).two, "never a bird over 24 lb");
  const breast = feastDishes(feast(4)).find((d) => d.key === "turkey")!;
  assert.ok(breast.steps.some((s) => /thickest part of the breast/.test(s)));
  assert.ok(!breast.steps.some((s) => /thigh|giblets/.test(s)));
  // 24 guests -> 2 x 15 lb, 4 days to thaw: shopping Sunday Nov 22 is still in time; Tuesday isn't.
  const ok = feastTimeline(feast(10), "2026-11-26", { boughtOn: "2026-11-21", today: "2026-11-15" });
  assert.match(ok[0].what, /Move the turkey/);
  const late = feastTimeline(feast(10), "2026-11-26", { boughtOn: "2026-11-24", today: "2026-11-15" });
  assert.equal(late[0].date, "2026-11-24");
  assert.match(late[0].what, /cold water/);
  assert.match(late[0].what, /Never thaw it on the counter/);
});

test("review fixes: whole pies, at least one recipe of each side, gravy needs the turkey", () => {
  const small = feastDishes(feast(2));
  assert.equal(small.find((d) => d.key === "pumpkin-pie")!.times, 1);
  assert.equal(small.find((d) => d.key === "stuffing")!.times, 1);
  assert.equal(feastDishes(feast(12)).find((d) => d.key === "pumpkin-pie")!.times, 2, "12 people: two whole pies");
  assert.ok(!feastDishes(feast(8, { dishes: ["gravy", "potatoes"] })).some((d) => d.key === "gravy"));
  const units = feastDishes(feast(30)).flatMap((d) => d.scaled.map((i) => `${i.amount} ${i.unit}`));
  assert.ok(!units.some((u) => /^(1|1\/2|1\/3) cups\b|^[2-9]\d* \(\d+(\.\d+)? oz\) (bag|can)$/.test(u)), units.join(" | "));
});

test("review fixes: feast grocery amounts read like a shopping list", async () => {
  const { sameVolume, butterSticks } = await import("@/lib/feast-grocery");
  assert.deepEqual(sameVolume(["1 3/4 cups", "6 tbsp"]), ["2 1/8 cup"]);
  assert.deepEqual(sameVolume(["1 tbsp", "3 tsp"]), ["2 tbsp"]);
  assert.equal(butterSticks("2 1/8 cup"), "5 sticks");
  const sec = feastSection(feast(12));
  assert.match(sec.items.find((i) => i.item === "butter")!.quantity, /^\d+ sticks$/);
  assert.equal(sec.items.find((i) => i.item === "kosher salt")!.quantity, "2 tbsp");
});

test("review fixes: removing the feast brings back the dinner it replaced; other edits keep feast leftovers", async () => {
  const { withoutFeast } = await import("@/lib/feast");
  const { rebalanceBatches } = await import("@/lib/budget");
  const d = (date: string, recipeId: string | null, extra: Partial<PlanDay> = {}): PlanDay => ({ date, recipeId, recipeName: recipeId, estimatedCost: 9, reason: "", saleItems: [], alternatives: [], ...extra });
  const days = withFeast([d("2026-11-25", "soup"), d("2026-11-26", "chili", { batches: 2, estimatedCost: 18, holiday: "Thanksgiving" }), d("2026-11-27", "chili", { leftoverOf: "2026-11-26" })], 1, feast(8));
  const kept = rebalanceBatches(days, () => true);
  assert.equal(kept[2].recipeName, "Thanksgiving leftovers", "swapping another night doesn't wipe the feast leftovers");
  const back = withoutFeast(days, 1);
  assert.equal(back[1].recipeId, "chili");
  assert.equal(back[2].recipeName, null);
});

test("review fixes: a feast on a leftovers night drops the double batch", () => {
  const d = (date: string, recipeId: string | null, extra: Partial<PlanDay> = {}): PlanDay => ({ date, recipeId, recipeName: recipeId, estimatedCost: 10, reason: "x · double batch for Thu", saleItems: [], alternatives: [], ...extra });
  const out = withFeast([d("2026-11-25", "chili", { batches: 2, estimatedCost: 20 }), d("2026-11-26", "chili", { leftoverOf: "2026-11-25", holiday: "Thanksgiving" })], 1, feast(8));
  assert.equal(out[0].batches, undefined);
  assert.equal(out[0].estimatedCost, 10);
  assert.equal(out[0].reason, "x");
});

test("Christmas: a glazed ham sized for the table, warmed not thawed", async () => {
  const { CHRISTMAS, hamFor, mainFor, feastLabel } = await import("@/lib/feast");
  const xmas = (guests: number) => ({ holiday: "Christmas Day", guests, dishes: CHRISTMAS.filter((d) => d.default).map((d) => d.key), frozen: true });
  assert.equal(feastLabel("Christmas Day"), "Christmas");
  assert.equal(hamFor(10).lb, 6);
  assert.equal(hamFor(16).lb, 10);
  assert.ok(hamFor(30).two && hamFor(30).lb <= 12);
  assert.equal(mainFor(xmas(10))!.thawDays, null);
  const ham = feastDishes(xmas(10)).find((d) => d.key === "ham")!;
  assert.ok(ham.steps.some((s) => /140°F/.test(s)));
  assert.match(`${ham.scaled[0].amount} ${ham.scaled[0].unit} ${ham.scaled[0].item}`, /^1 \(6 lb\) spiral-cut ham$/);
  const steps = feastTimeline(xmas(10), "2026-12-25", { boughtOn: "2026-12-19", today: "2026-12-01" });
  assert.ok(!steps.some((s) => /freezer|thaw/i.test(s.what)), "no thawing for a ham");
  assert.ok(steps.some((s) => s.date === "2026-12-25" && /ham/.test(s.what)));
  const sec = feastSection(xmas(10));
  assert.equal(sec.name, "Christmas dinner");
  assert.ok(sec.items.some((i) => /spiral-cut ham/.test(i.item)));
  const out = withFeast([{ date: "2026-12-25", recipeId: "chili", recipeName: "chili", estimatedCost: 9, reason: "", saleItems: [], alternatives: [], holiday: "Christmas Day" }, { date: "2026-12-26", recipeId: "chili", recipeName: "chili", estimatedCost: 0, reason: "", saleItems: [], alternatives: [], leftoverOf: "2026-12-25" }], 0, xmas(10));
  assert.equal(out[0].recipeName, "Christmas dinner");
  assert.equal(out[1].recipeName, "Christmas leftovers");
  assert.match(out[1].reason, /^Ham sandwiches/);
});

test("review fixes: Christmas dinner is on Dec 25 even when the federal holiday moves", async () => {
  const { feastHolidayOn, CHRISTMAS } = await import("@/lib/feast");
  const { holidayOn } = await import("@/lib/holidays");
  assert.equal(holidayOn("2027-12-25"), null, "2027: observed on Friday the 24th");
  assert.equal(feastHolidayOn("2027-12-25", holidayOn("2027-12-25")), "Christmas Day");
  assert.equal(feastHolidayOn("2027-12-24", holidayOn("2027-12-24")), null);
  assert.equal(feastHolidayOn("2026-11-26", holidayOn("2026-11-26")), "Thanksgiving");
  assert.ok(!CHRISTMAS.flatMap((d) => d.steps).some((s) => /turkey/i.test(s)), "nothing about turkey at Christmas");
  const out = withFeast([{ date: "2026-12-25", recipeId: "a", recipeName: "a", estimatedCost: 1, reason: "", saleItems: [], alternatives: [] }, { date: "2026-12-26", recipeId: "a", recipeName: "a", estimatedCost: 0, reason: "", saleItems: [], alternatives: [], leftoverOf: "2026-12-25" }], 0, { holiday: "Christmas Day", guests: 6, dishes: ["potatoes", "rolls"], frozen: false });
  assert.equal(out[1].reason, "Plates of everything from the feast");
});
