"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { getSettings } from "@/lib/data";
import type { Athlete } from "@/lib/athletes";

const AthleteSchema = z.object({
  id: z.string().min(1).max(20),
  name: z.string().trim().max(40),
  sport: z.enum(["strongman", "powerlifting", "bodybuilding", "crossfit", "endurance", "combat", "team", "gym", "active", "weightloss"]),
  phase: z.enum(["bulk", "maintain", "cut"]),
  youth: z.boolean(),
  weightLb: z.number().int().min(60).max(600).nullable(),
  milesPerWeek: z.number().int().min(0).max(200).nullable(),
  calories: z.number().int().min(1200).max(8000),
  protein: z.number().int().min(40).max(500),
  mealsPerDay: z.number().int().min(3).max(7),
  trainingDays: z.array(z.number().int().min(0).max(6)).max(7),
  competitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  shakes: z.boolean(),
  conditions: z.array(z.enum(["diabetes", "keto", "lowsodium", "pregnant", "breastfeeding"])).max(5),
  carbsPerMeal: z.number().int().min(10).max(120),
  sodiumPerDay: z.number().int().min(500).max(5000),
  trimester: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
});

/** Save the household's athletes (athlete mode). An empty list turns athlete mode off. */
export async function saveAthletes(list: Athlete[]): Promise<{ error?: string; addedPregnancyRule?: boolean }> {
  const userId = await requireUserId();
  const parsed = z.array(AthleteSchema).max(8).safeParse(list);
  if (!parsed.success) return { error: "Check the numbers: calories 1,200 to 8,000, protein 40 to 500 g a day, carbs 10 to 120 g a meal, sodium 500 to 5,000 mg a day." };
  const athletes = parsed.data.map((a) => ({ ...a, trainingDays: [...new Set(a.trainingDays)].sort() }));
  const { data: current, complete } = await getSettings(userId);
  // Someone pregnant: the family's dinners follow pregnancy food safety too (no raw fish, deli meat unheated, etc.).
  const pregnant = athletes.some((a) => a.conditions.includes("pregnant"));
  const foodRules = pregnant && !current.foodRules.includes("pregnancy") ? [...current.foodRules, "pregnancy" as const] : current.foodRules;
  const data = { ...current, athletes, foodRules };
  const db = await getDb();
  const now = new Date();
  await db
    .insert(settingsTable)
    .values({ userId, data, updatedAt: now, completedAt: complete ? now : null })
    .onConflictDoUpdate({ target: settingsTable.userId, set: { data, updatedAt: now } });
  revalidatePath("/athletes");
  revalidatePath("/");
  return { addedPregnancyRule: foodRules !== current.foodRules };
}
