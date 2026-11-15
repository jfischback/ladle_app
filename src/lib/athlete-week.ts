import "server-only";
import type { Plan } from "@/db/schema";
import type { Settings } from "./settings";
import type { SaleItem } from "./types";
import { recipesByIds } from "./data";
import { estimateNutrition, estimateSodium, type NutritionEstimate } from "./nutrition";
import { allowedFuel, planAthleteWeek, type AthleteWeek } from "./athletes";

/** Each athlete's week for a plan: meals with their portions, the fuel that closes the gap, and day totals. */
export async function athleteWeeks(userId: string, plan: Pick<Plan, "days" | "saleItems">, settings: Settings): Promise<AthleteWeek[]> {
  if (!settings.athletes.length) return [];
  const ids = [...new Set(plan.days.flatMap((d) => [d.recipeId, d.breakfast?.recipeId, d.lunch?.recipeId]).filter((x): x is string => !!x))];
  const recipes = ids.length ? await recipesByIds(userId, ids) : [];
  const nutrition = new Map<string, NutritionEstimate & { sodium: number }>(recipes.map((r) => [r.id, { ...estimateNutrition(r), sodium: estimateSodium(r) }]));
  const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
  return settings.athletes.map((a) =>
    planAthleteWeek(a, plan.days, nutrition, allowedFuel(a, settings.foodRules, settings.dislikes, settings.allowAnyway), sales),
  );
}
