import "server-only";
import type { Recipe } from "@/db/schema";
import type { Settings } from "./settings";
import type { PlanDay, SaleItem } from "./types";
import { estimateCost } from "./nutrition";
import { ingredientTerm } from "./sales";
import { leftoverKind } from "./leftovers";
import { ruleProblems } from "./diet";
import { dayName, weekday } from "./week";
import { canCook } from "./prep";
import { dinnerServings } from "./scaling";

/** Grown-up-sized portions this household eats at dinner (the same count the grocery list scales to). */
export const householdServings = (s: Settings) => dinnerServings(s);

/** A dinner's estimated cost for this household, with this week's sales taken off. */
export function dinnerCost(recipe: Pick<Recipe, "ingredients" | "servings">, settings: Settings, sales: SaleItem[]): { total: number; perServing: number } {
  const off = new Map(sales.map((s) => [s.item, s.pctOff / 100]));
  const c = estimateCost(recipe, (ing) => off.get(ingredientTerm(ing) ?? "") ?? 0);
  const total = Math.round(c.perServing * householdServings(settings) * 100) / 100;
  return { total, perServing: c.perServing };
}

/** Fill in dinner costs the planner didn't estimate. */
export function fillCosts(days: PlanDay[], byId: Map<string, Recipe>, settings: Settings, sales: SaleItem[]): PlanDay[] {
  return days.map((d) => {
    if (!d.recipeId || d.estimatedCost != null || d.leftoverOf) return d;
    const r = byId.get(d.recipeId);
    return r ? { ...d, estimatedCost: dinnerCost(r, settings, sales).total } : d;
  });
}

/**
 * Cook once, eat twice: a dinner that reheats well is cooked as a double batch and eaten again the next
 * planned night. Halves the cooking and the number of different things to buy.
 */
export function cookOnceEatTwice(days: PlanDay[], byId: Map<string, Recipe>): { days: PlanDay[]; notes: string[] } {
  const out = days.map((d) => ({ ...d }));
  const notes: string[] = [];
  const cookIdx = out.map((d, i) => (d.recipeId ? i : -1)).filter((i) => i >= 0);
  for (let k = 0; k + 1 < cookIdx.length; k += 2) {
    const a = out[cookIdx[k]];
    const r = byId.get(a.recipeId!);
    if (!r || leftoverKind(r) !== "ok") { k -= 1; continue; } // try pairing the next night instead
    const b = out[cookIdx[k + 1]];
    out[cookIdx[k + 1]] = {
      ...b,
      recipeId: a.recipeId,
      recipeName: a.recipeName,
      estimatedCost: 0,
      reason: `Leftovers from ${dayName(a.date)}: cook once, eat twice`,
      saleItems: [],
      fromCook: null,
      alternatives: b.recipeId ? [{ recipeId: b.recipeId, recipeName: b.recipeName!, estimatedCost: b.estimatedCost, reason: b.reason }, ...b.alternatives].slice(0, 3) : b.alternatives,
      leftoverOf: a.date,
    };
    // The double batch is bought and cooked on the first night, so that night carries both dinners' cost.
    out[cookIdx[k]] = { ...a, batches: 2, estimatedCost: a.estimatedCost != null ? Math.round(a.estimatedCost * 2 * 100) / 100 : null, reason: `${a.reason} · double batch for ${dayName(b.date)}` };
    notes.push(`Make a double batch of ${a.recipeName} on ${dayName(a.date)}: ${dayName(b.date)} is leftovers night.`);
  }
  return { days: out, notes };
}

/**
 * After a change (a swap, a cheaper pick), make each night's batches add up again: a leftovers night needs its
 * dinner to still be cooked and to reheat well (otherwise it becomes a night off), and each cooking night's
 * cost covers every night it feeds.
 */
export function rebalanceBatches(days: PlanDay[], keepsWell: (recipeId: string) => boolean): PlanDay[] {
  let out = days.map((d) => ({ ...d }));
  // Leftovers whose dinner is gone, changed, or doesn't reheat well become nights off.
  out = out.map((d) => {
    if (!d.leftoverOf) return d;
    const cook = out.find((c) => c.date === d.leftoverOf && !c.leftoverOf);
    if (cook?.feast) return d; // holiday leftovers
    if (cook?.recipeId && cook.recipeId === d.recipeId && keepsWell(cook.recipeId)) return d;
    return { ...d, recipeId: null, recipeName: null, estimatedCost: null, reason: "No-cook night", saleItems: [], leftoverOf: null };
  });
  return out.map((d) => {
    if (!d.recipeId || d.leftoverOf) return d.batches ? { ...d, batches: undefined } : d;
    const want = 1 + out.filter((x) => x.leftoverOf === d.date).length;
    const had = d.batches ?? 1;
    if (want === had) return d;
    const cost = d.estimatedCost != null ? Math.round((d.estimatedCost / had) * want * 100) / 100 : null;
    const reason = want > 1 ? d.reason : d.reason.replace(/ · double batch for \w+/, "");
    return { ...d, batches: want > 1 ? want : undefined, estimatedCost: cost, reason };
  });
}

/** Grocery list notes for the week's portions: double batches, and small households. */
export function budgetNotes(days: PlanDay[]): string[] {
  const notes: string[] = [];
  for (const d of days) {
    if (!d.leftoverOf) continue;
    const cook = days.find((x) => x.date === d.leftoverOf);
    if (cook && !cook.feast) notes.push(`Make a double batch of ${cook.recipeName} on ${dayName(cook.date)}: ${dayName(d.date)} is leftovers night.`);
  }
  return notes;
}

const dinnersTotal = (days: PlanDay[]) => days.reduce((n, d) => n + (d.recipeId && !d.leftoverOf ? d.estimatedCost ?? 0 : 0), 0);

/**
 * Keep the week under a hard budget: swap the priciest dinners for cheaper recipes that fit the family's
 * rules (and busy nights) until the week fits, or nothing cheaper is left.
 */
export function enforceCap(
  days: PlanDay[],
  pool: Recipe[],
  settings: Settings,
  sales: SaleItem[],
  otherCosts: number,
  recentIds: Set<string>,
): { days: PlanDay[]; swaps: number; over: number } {
  const out = days.map((d) => ({ ...d }));
  const cap = settings.weeklyBudget;
  const family = settings.adults + settings.kids >= 2;
  const fits = pool.filter((r) => !ruleProblems(r, settings.foodRules, settings.dislikes, settings.allowAnyway).length && canCook(r, settings.equipment) && !(family && r.servings === 1) && !(r.rating != null && r.rating <= 2) && !r.trial);
  const costOf = new Map(fits.map((r) => [r.id, dinnerCost(r, settings, sales).total]));
  let swaps = 0;
  for (let guard = 0; guard < 14 && dinnersTotal(out) + otherCosts > cap; guard++) {
    const used = new Set(out.map((d) => d.recipeId).filter(Boolean));
    const priciest = out
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => d.recipeId && !d.leftoverOf && d.estimatedCost != null)
      .sort((x, y) => (y.d.estimatedCost ?? 0) - (x.d.estimatedCost ?? 0));
    let swapped = false;
    for (const { d, i } of priciest) {
      const busy = settings.busyDays.includes(weekday(d.date));
      const cheaper = fits
        .filter((r) => !used.has(r.id) && !(recentIds.has(r.id) && fits.length > 20) && (costOf.get(r.id) ?? 99) * (d.batches ?? 1) < (d.estimatedCost ?? 0) - 1)
        // A double-batch night must still suit leftovers.
        .filter((r) => (d.batches ?? 1) < 2 || leftoverKind(r) === "ok")
        .filter((r) => !busy || (r.totalMinutes ?? 30) <= settings.busyMaxMinutes)
        .sort((x, y) => (costOf.get(x.id) ?? 0) - (costOf.get(y.id) ?? 0));
      const pick = cheaper[0];
      if (!pick) continue;
      const prevDate = d.date;
      out[i] = {
        ...d,
        recipeId: pick.id,
        recipeName: pick.name,
        estimatedCost: Math.round((costOf.get(pick.id) ?? 0) * (d.batches ?? 1) * 100) / 100,
        reason: `Cheaper pick to stay under your $${cap} budget`,
        saleItems: [],
        fromCook: null,
        alternatives: [{ recipeId: d.recipeId!, recipeName: d.recipeName!, estimatedCost: d.estimatedCost, reason: d.reason }, ...d.alternatives].slice(0, 3),
      };
      // A leftovers night follows its dinner.
      for (let j = 0; j < out.length; j++) if (out[j].leftoverOf === prevDate) out[j] = { ...out[j], recipeId: pick.id, recipeName: pick.name };
      swaps++;
      swapped = true;
      break;
    }
    if (!swapped) break;
  }
  return { days: out, swaps, over: Math.max(0, Math.round(dinnersTotal(out) + otherCosts - cap)) };
}
