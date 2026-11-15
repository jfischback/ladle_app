"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { recipes, settings as settingsTable } from "@/db/schema";
import { findFrysStores, krogerEnabled, type StoreLocation } from "@/lib/kroger";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { FOOD_RULES, type FoodRule } from "@/lib/diet";
import { copyStarters } from "./recipes";

const int = (min: number, max: number) => z.number().int().min(min).max(max);

const SettingsSchema = z.object({
  motivation: z.array(z.enum(["save_money", "eat_healthier", "try_new"])).min(1).max(3),
  adults: int(1, 12),
  kids: int(0, 12),
  hasBaby: z.boolean(),
  babyAgeMonths: int(0, 36).nullable(),
  zip: z.string().trim().max(10),
  storeLocationId: z.string().nullable(),
  storeName: z.string().trim().max(200),
  fulfillment: z.enum(["pickup", "delivery"]),
  shoppingDay: int(0, 6),
  weeklyBudget: z.number().min(10).max(5000),
  budgetMode: z.enum(["target", "hard"]),
  cookDays: z.array(int(0, 6)).min(1).max(7),
  newRecipesPerWeek: int(0, 2),
  foodRules: z.array(z.enum(Object.keys(FOOD_RULES) as [FoodRule, ...FoodRule[]])).max(20),
  dislikes: z.array(z.string().trim().min(2).max(40)).max(30),
  noRepeatWeeks: int(0, 12),
  favorQuickWeeknights: z.boolean(),
  saleThresholdPct: int(1, 90),
  preferPremiumOnSale: z.boolean(),
});

export async function saveSettings(input: Partial<Settings>, startWith?: "ours" | "own") {
  const userId = await requireUserId();
  const parsed = SettingsSchema.parse(input);
  const cookDays = [...new Set(parsed.cookDays)].sort();
  const data: Settings = { ...DEFAULT_SETTINGS, ...parsed, cookDays, dinnersPerWeek: cookDays.length };
  const db = await getDb();
  const now = new Date();
  await db
    .insert(settingsTable)
    .values({ userId, data, completedAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: settingsTable.userId, set: { data, updatedAt: now, completedAt: now } });

  if (startWith === "ours") {
    const starters = await db
      .select({ id: recipes.id })
      .from(recipes)
      .where(and(isNull(recipes.ownerId), isNull(recipes.archivedAt), eq(recipes.meal, "dinner")));
    await copyStarters(userId, starters.map((s) => s.id));
    redirect("/");
  }
  if (startWith === "own") redirect("/recipes/new");
  redirect("/");
}

export async function lookupStores(zip: string): Promise<{ stores?: StoreLocation[]; error?: string; disabled?: boolean }> {
  await requireUserId();
  if (!krogerEnabled()) return { disabled: true };
  if (!/^\d{5}$/.test(zip.trim())) return { error: "Enter a 5-digit zip code." };
  try {
    return { stores: await findFrysStores(zip.trim()) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
