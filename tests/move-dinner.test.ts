import { test } from "node:test";
import assert from "node:assert/strict";
import { moveDinner } from "@/lib/move-dinner";
import type { PlanDay } from "@/lib/types";

const day = (date: string, recipeId: string | null, extra: Partial<PlanDay> = {}): PlanDay => ({
  date, recipeId, recipeName: recipeId ? recipeId.toUpperCase() : null, estimatedCost: recipeId ? 10 : null, reason: "", saleItems: [], alternatives: [], ...extra,
});
const lunch = (recipeId: string) => ({ kind: "leftovers" as const, recipeId, name: `Leftover ${recipeId.toUpperCase()}`, reason: "From last night", eaters: "1 adult", servings: 1 });
const open = { kind: "open" as const, recipeId: null, name: "Lunch: your pick", reason: "", eaters: "1 adult", servings: 1 };

test("trades two nights and keeps each day's date and lunch slot", () => {
  const days = [day("2026-11-16", "tacos"), day("2026-11-17", "chili"), day("2026-11-18", "pasta")];
  const r = moveDinner(days, 0, 2, "2026-11-16");
  assert.ok("days" in r);
  assert.deepEqual(r.days.map((d) => [d.date, d.recipeId]), [["2026-11-16", "pasta"], ["2026-11-17", "chili"], ["2026-11-18", "tacos"]]);
});

test("past and cooked nights can't move", () => {
  const days = [day("2026-11-16", "tacos", { ratedAt: "x" }), day("2026-11-17", "chili"), day("2026-11-18", "pasta")];
  assert.ok("error" in moveDinner(days, 0, 2, "2026-11-16"));
  assert.ok("error" in moveDinner(days, 1, 2, "2026-11-18"));
});

test("a leftovers night follows its dinner and must stay after it", () => {
  const days = [day("2026-11-16", "chili", { batches: 2 }), day("2026-11-17", "tacos"), day("2026-11-18", "chili", { leftoverOf: "2026-11-16" })];
  const ok = moveDinner(days, 0, 1, "2026-11-16");
  assert.ok("days" in ok);
  assert.equal(ok.days[2].leftoverOf, "2026-11-17", "leftovers now point at Tuesday");
  assert.equal(ok.days[1].batches, 2, "the double batch moved with the dinner");
  const bad = moveDinner(days, 0, 2, "2026-11-16");
  assert.ok("error" in bad && /after/.test(bad.error));
});

test("a next-day leftovers lunch trades along with its dinner", () => {
  const days = [day("2026-11-16", "chili"), day("2026-11-17", "tacos", { lunch: lunch("chili") }), day("2026-11-18", "pasta"), day("2026-11-19", "soup", { lunch: open })];
  const r = moveDinner(days, 0, 2, "2026-11-16");
  assert.ok("days" in r);
  assert.equal(r.days[3].lunch?.recipeId, "chili", "Thursday lunch is chili leftovers");
  assert.equal(r.days[3].lunch?.eaters, "1 adult");
  assert.equal(r.days[1].lunch?.kind, "open");
});

test("a leftovers lunch with nowhere to go says what to do", () => {
  const days = [day("2026-11-16", "chili"), day("2026-11-17", "tacos", { lunch: lunch("chili") }), day("2026-11-18", "pasta")];
  const r = moveDinner(days, 0, 2, "2026-11-16");
  assert.ok("days" in r);
  assert.equal(r.days[1].lunch?.kind, "open");
  assert.match(r.days[1].lunch!.reason, /moved to Wed/);
});

test("only nights that work are offered", async () => {
  const { moveTargets } = await import("@/lib/move-dinner");
  const days = [day("2026-11-15", null), day("2026-11-16", "chili", { batches: 2 }), day("2026-11-17", "chili", { leftoverOf: "2026-11-16" }), day("2026-11-18", "tacos")];
  assert.deepEqual(moveTargets(days, 0, "2026-11-15").map((t) => t.index), [1, 3], "a night off can't take the leftovers before the chili");
  assert.deepEqual(moveTargets(days, 2, "2026-11-15").map((t) => t.index), [3]);
});

test("two cook-once-eat-twice dinners trade along with their leftovers nights", () => {
  const days = [
    day("2026-11-22", "sheetpan", { batches: 2 }), day("2026-11-23", "sheetpan", { leftoverOf: "2026-11-22" }),
    day("2026-11-24", "enchiladas", { batches: 2 }), day("2026-11-25", "enchiladas", { leftoverOf: "2026-11-24" }),
  ];
  const r = moveDinner(days, 0, 2, "2026-11-22");
  assert.ok("days" in r, "error" in r ? r.error : "");
  assert.deepEqual(r.pair, [1, 3]);
  assert.deepEqual(r.days.map((d) => [d.recipeId, d.leftoverOf ?? null]), [["enchiladas", null], ["enchiladas", "2026-11-22"], ["sheetpan", null], ["sheetpan", "2026-11-24"]]);
});
