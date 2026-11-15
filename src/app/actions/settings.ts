"use server";

import { redirect } from "next/navigation";
import { and, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { recipes, settings as settingsTable } from "@/db/schema";
import { findStores, krogerEnabled, type StoreLocation } from "@/lib/kroger";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";
import { getSettings } from "@/lib/data";
import { FOOD_RULES, type FoodRule } from "@/lib/diet";
import { StaplesSchema } from "@/lib/staples-schema";
import { copyStarters } from "@/lib/starters";

const int = (min: number, max: number) => z.number().int().min(min).max(max);

const SettingsSchema = z.object({
  motivation: z.array(z.enum(["save_money", "eat_healthier", "try_new"])).min(1).max(3),
  adults: int(1, 12),
  kids: int(0, 12),
  hasBaby: z.boolean(),
  pickyEaters: z.array(z.object({
    id: z.string().min(1).max(20),
    name: z.string().trim().max(40),
    wontEat: z.array(z.string().trim().min(2).max(40)).max(20),
    safeFoods: z.array(z.string().trim().min(2).max(40)).max(20),
  })).max(10),
  babyAgeMonths: int(0, 36).nullable(),
  zip: z.string().trim().max(10),
  storeLocationId: z.string().nullable(),
  storeName: z.string().trim().max(200),
  fulfillment: z.enum(["pickup", "delivery"]),
  shoppingDay: int(0, 6),
  weeklyBudget: z.number().min(10).max(5000),
  budgetMode: z.enum(["target", "hard"]),
  tightBudget: z.boolean(),
  cookOnceEatTwice: z.boolean(),
  snap: z.boolean(),
  cookDays: z.array(int(0, 6)).min(1).max(7),
  newRecipesPerWeek: int(0, 2),
  foodRules: z.array(z.enum(Object.keys(FOOD_RULES) as [FoodRule, ...FoodRule[]])).max(20),
  dislikes: z.array(z.string().trim().min(2).max(40)).max(30),
  staples: StaplesSchema,
  busyDays: z.array(int(0, 6)).max(7),
  busyMaxMinutes: int(10, 120),
  maxSameProtein: int(1, 7),
  lunchDays: z.array(int(0, 6)).max(7),
  lunchAdults: int(0, 12),
  lunchKids: z.boolean(),
  holidayEveryoneHome: z.boolean(),
  holidayNoReheat: z.array(z.string().max(20)).max(10),
  allowAnyway: z.array(z.string().trim().min(2).max(40)).max(20),
  breakfastDays: z.array(int(0, 6)).max(7),
  breakfastAdults: int(0, 12),
  breakfastKids: z.boolean(),
  breakfastMaxMinutes: int(5, 120),
  breadBreakfasts: int(0, 7),
  breakfastMustHave: z.array(z.string().trim().min(2).max(40)).max(10),
  breakfastMeatDeal: z.boolean(),
  extras: z.record(
    z.enum(["snacks", "sweets", "drinks", "baby"]),
    z.object({ rotateCount: int(0, 10), servingsTarget: int(0, 50).nullable(), neverWords: z.array(z.string().trim().min(2).max(40)).max(30) }),
  ),
  noRepeatWeeks: int(0, 12),
  favorQuickWeeknights: z.boolean(),
  saleThresholdPct: int(1, 90),
  preferPremiumOnSale: z.boolean(),
});

export async function saveSettings(input: Partial<Settings>, startWith?: "ours" | "own") {
  const userId = await requireUserId();
  const parsed = SettingsSchema.parse(input);
  const cookDays = [...new Set(parsed.cookDays)].sort();
  // Keep settings the wizard doesn't show (e.g. prepReminders) instead of resetting them to defaults.
  const { data: current } = await getSettings(userId);
  const data: Settings = { ...DEFAULT_SETTINGS, ...current, ...parsed, cookDays, dinnersPerWeek: cookDays.length };
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
      .where(and(isNull(recipes.ownerId), isNull(recipes.archivedAt)));
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
    return { stores: await findStores(zip.trim()) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
