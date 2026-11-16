import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarDays, monthGrid, shiftMonth, weekOfDate } from "@/lib/calendar-view";
import type { PlanDay } from "@/lib/types";

test("months shift across years", () => {
  assert.equal(shiftMonth("2026-11", 1), "2026-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});

test("a month's grid is whole Sunday-to-Saturday weeks covering every day", () => {
  const g = monthGrid("2026-11"); // Nov 1, 2026 is a Sunday; Nov 30 is a Monday
  assert.equal(g[0][0], "2026-11-01");
  assert.equal(g.length, 5);
  assert.equal(g[4][6], "2026-12-05");
  const feb = monthGrid("2027-02"); // starts on a Monday
  assert.equal(feb[0][0], "2027-01-31");
  assert.ok(feb.flat().includes("2027-02-28"));
});

test("the week of a date starts on Sunday", () => {
  assert.deepEqual(weekOfDate("2026-11-18"), ["2026-11-15", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21"]);
});

const day = (date: string, patch: Partial<PlanDay> = {}) => ({ date, recipeId: "r1", recipeName: "Tacos", estimatedCost: null, reason: "", saleItems: [], leftoverOf: null, ...patch }) as unknown as PlanDay;

test("approved plans win over drafts, and parties land on their day", () => {
  const m = calendarDays(
    [
      { weekOf: "2026-11-21", status: "approved", createdAt: new Date(1), days: [day("2026-11-21"), day("2026-11-22", { recipeId: null, recipeName: null })] },
      { weekOf: "2026-11-21", status: "draft", createdAt: new Date(2), days: [day("2026-11-21", { recipeName: "Soup" })] },
    ],
    [{ id: "p1", title: "Sam's birthday", date: "2026-11-22", icon: "🎂" }, { id: "p2", title: "Grad party", date: "2026-12-12", icon: "🎓" }],
  );
  assert.equal(m.get("2026-11-21")!.dinner, "Tacos");
  assert.equal(m.get("2026-11-22")!.kind, "off");
  assert.equal(m.get("2026-11-22")!.parties[0].title, "Sam's birthday");
  assert.equal(m.get("2026-12-12")!.dinner, null);
});
