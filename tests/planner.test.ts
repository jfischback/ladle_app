import { test } from "node:test";
import assert from "node:assert/strict";
import { planWeek } from "@/lib/planner";
import { ruleProblems } from "@/lib/diet";
import { proteinGroup } from "@/lib/protein";
import { canCook } from "@/lib/prep";
import { weekday } from "@/lib/week";
import { settings, starterBox } from "./helpers";

delete process.env.ANTHROPIC_API_KEY; // the basic planner, no AI

const SCENARIOS = [
  settings({ foodRules: ["no-seafood", "no-bones"], busyDays: [2, 4], busyMaxMinutes: 30 }),
  settings({ foodRules: ["vegetarian"], cookDays: [1, 2, 3, 4], dinnersPerWeek: 4 }),
  settings({ adults: 1, kids: 0, equipment: ["microwave", "stovetop"], tightBudget: true, budgetMode: "hard", weeklyBudget: 60 }),
  settings({ adults: 2, kids: 3, pickyEaters: [{ id: "a", name: "Ava", wontEat: ["onions"], safeFoods: [] }], maxSameProtein: 1 }),
];

test("60 planned weeks follow every hard rule", async () => {
  const box = starterBox();
  for (let run = 0; run < 60; run++) {
    const s = SCENARIOS[run % SCENARIOS.length];
    const { days } = await planWeek({ settings: s, weekStart: "2026-11-21", recipes: box, recentPlans: [], saleItems: [] });
    const dinners = days.filter((d) => d.recipeId);
    assert.ok(dinners.length >= Math.min(s.cookDays.length, 3), `run ${run}: only ${dinners.length} dinners`);
    const ids = dinners.map((d) => d.recipeId);
    assert.equal(new Set(ids).size, ids.length, `run ${run}: a repeat`);
    for (const d of dinners) {
      const r = box.find((x) => x.id === d.recipeId)!;
      assert.equal(ruleProblems(r, s.foodRules, s.dislikes, s.allowAnyway).length, 0, `run ${run}: ${r.name} breaks a food rule`);
      assert.ok(canCook(r, s.equipment), `run ${run}: ${r.name} needs equipment they don't have`);
      assert.ok(s.cookDays.includes(weekday(d.date)), `run ${run}: dinner on a night off`);
      if (s.busyDays.includes(weekday(d.date)) && !r.tags.includes("slow-cooker")) {
        assert.ok((r.totalMinutes ?? 0) <= s.busyMaxMinutes, `run ${run}: slow dinner on a busy night (${r.name})`);
      }
      if (s.adults + s.kids >= 2) assert.notEqual(r.servings, 1, `run ${run}: single-serving ${r.name} for a family`);
    }
    if (s.maxSameProtein === 1) {
      const counts = new Map<string, number>();
      for (const d of dinners) {
        const g = proteinGroup(box.find((x) => x.id === d.recipeId)!);
        if (g !== "Vegetarian") counts.set(g, (counts.get(g) ?? 0) + 1);
      }
      // The cap can relax by one when the box can't fill the week otherwise.
      for (const [g, n] of counts) assert.ok(n <= 2, `run ${run}: ${g} on ${n} nights with a cap of 1`);
    }
  }
});
