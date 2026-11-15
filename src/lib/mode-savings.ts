import type { PlanDay } from "./types";

/**
 * What Cost Cutting saved on a week: a typical week of the family's own dinners (the average dinner in their
 * recipe box, times the dinners cooked) minus this week's dinners. Never below zero. An estimate, and labeled so.
 */
export function weekSaving(days: PlanDay[], averageDinner: number): number {
  const cooked = days.filter((d) => d.recipeId && !d.leftoverOf && d.estimatedCost != null);
  if (!cooked.length || !(averageDinner > 0)) return 0;
  const spent = cooked.reduce((a, d) => a + (d.estimatedCost ?? 0) / (d.batches ?? 1), 0);
  return Math.max(0, Math.round((averageDinner * cooked.length - spent) * 100) / 100);
}

/** The average dinner cost across a recipe box (for the comparison above). */
export const averageCost = (costs: number[]) => {
  const ok = costs.filter((c) => Number.isFinite(c) && c > 0);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : 0;
};
