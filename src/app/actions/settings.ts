"use server";

import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { recipes, settings as settingsTable } from "@/db/schema";
import { findStores, krogerEnabled, type StoreLocation } from "@/lib/kroger";
import { DEFAULT_SETTINGS, MODES, type Mode, type Settings } from "@/lib/settings";
import { SEEN_KEYS, markSeen, type SeenKey } from "@/lib/seen";
import { getSettings } from "@/lib/data";
import { FOOD_RULES, type FoodRule } from "@/lib/diet";
import { StaplesSchema } from "@/lib/staples-schema";
import { copyStarters } from "@/lib/starters";
import { pickStarters } from "@/lib/starter-pick";
import { TOO_MANY, under } from "@/lib/rate-limit";

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
  dessertNights: int(0, 3),
  foodRules: z.array(z.enum(Object.keys(FOOD_RULES) as [FoodRule, ...FoodRule[]])).max(20),
  dislikes: z.array(z.string().trim().min(2).max(40)).max(30),
  staples: StaplesSchema,
  busyDays: z.array(int(0, 6)).max(7),
  busyMaxMinutes: int(10, 120),
  prepDay: int(0, 6).nullable(),
  prepMinutes: int(30, 300),
  equipment: z.array(z.enum(["oven", "stovetop", "microwave", "slow cooker", "pressure cooker", "grill", "air fryer"])).max(7),
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
    z.enum(["snacks", "sweets", "drinks", "baby", "pets"]),
    z.object({ rotateCount: int(0, 10), servingsTarget: int(0, 50).nullable(), neverWords: z.array(z.string().trim().min(2).max(40)).max(30) }),
  ),
  noRepeatWeeks: int(0, 12),
  favorQuickWeeknights: z.boolean(),
  saleThresholdPct: int(1, 90),
  preferPremiumOnSale: z.boolean(),
});

/** Switch the goal (Normal or Workout). Cost Cutting is separate (setCostCutting) and stays as it is. */
export async function setMode(mode: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!(mode in MODES)) return { error: "Pick a mode." };
  const db = await getDb();
  const [row] = await db.select({ data: settingsTable.data }).from(settingsTable).where(eq(settingsTable.userId, userId));
  if (!row) return { error: "Finish setting up first." };
  const data = row.data as Settings;
  const tightBudget = data.tightBudget || (data.mode as string) === "cost";
  await db.update(settingsTable).set({ data: { ...data, mode: mode as Mode, tightBudget }, updatedAt: new Date() }).where(eq(settingsTable.userId, userId));
  revalidatePath("/");
  return {};
}

/** Cost Cutting on or off ("every dollar counts"), with whichever goal is on. */
export async function setCostCutting(on: boolean): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const db = await getDb();
  const [row] = await db.select({ data: settingsTable.data }).from(settingsTable).where(eq(settingsTable.userId, userId));
  if (!row) return { error: "Finish setting up first." };
  const data = row.data as Settings;
  const mode = (data.mode as string) === "cost" ? "normal" : data.mode;
  await db.update(settingsTable).set({ data: { ...data, mode, tightBudget: on }, updatedAt: new Date() }).where(eq(settingsTable.userId, userId));
  revalidatePath("/");
  return {};
}

/** The planning check-in's "Still right?" screen: save just the food rules. They apply to every week. */
const FoodRulesOnly = z.object({
  foodRules: z.array(z.enum(Object.keys(FOOD_RULES) as [FoodRule, ...FoodRule[]])).max(20),
  dislikes: z.array(z.string().trim().min(2).max(40)).max(30),
  allowAnyway: z.array(z.string().trim().min(2).max(40)).max(20),
});
export async function saveFoodRules(input: unknown): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = FoodRulesOnly.safeParse(input);
  if (!parsed.success) return { error: "Something in the food rules didn't look right. Check them and try again." };
  const db = await getDb();
  const [row] = await db.select({ data: settingsTable.data }).from(settingsTable).where(eq(settingsTable.userId, userId));
  if (!row) return { error: "Finish setting up first." };
  const data = row.data as Settings;
  await db.update(settingsTable).set({ data: { ...data, ...parsed.data }, updatedAt: new Date() }).where(eq(settingsTable.userId, userId));
  revalidatePath("/");
  revalidatePath("/plan");
  return {};
}

/** Getting started: mark a section as looked at, or hide the list. */
export async function markSectionSeen(key: string): Promise<void> {
  const userId = await requireUserId();
  if (!(SEEN_KEYS as readonly string[]).includes(key)) return;
  await markSeen(userId, key as SeenKey);
  revalidatePath("/");
}

export async function saveSettings(input: Partial<Settings>, startWith?: "ours" | "own", stay = false) {
  const userId = await requireUserId();
  const parsed = SettingsSchema.parse(input);
  const cookDays = [...new Set(parsed.cookDays)].sort();
  // Keep settings the wizard doesn't show (e.g. prepReminders) instead of resetting them to defaults.
  const { data: current } = await getSettings(userId);
  const data: Settings = { ...DEFAULT_SETTINGS, ...current, ...parsed, cookDays, dinnersPerWeek: cookDays.length };
  // "Every dollar counts" in Settings is Cost Cutting; it works with either goal. (Old data stored it as a mode.)
  if ((data.mode as string) === "cost") data.mode = "normal";
  const db = await getDb();
  const now = new Date();
  await db
    .insert(settingsTable)
    .values({ userId, data, completedAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: settingsTable.userId, set: { data, updatedAt: now, completedAt: now } });

  if (startWith === "ours") {
    const starters = await db
      .select({ id: recipes.id, name: recipes.name, meal: recipes.meal, servings: recipes.servings, tags: recipes.tags, ingredients: recipes.ingredients, steps: recipes.steps })
      .from(recipes)
      .where(and(isNull(recipes.ownerId), isNull(recipes.archivedAt)));
    // The starters that fit this family (food rules, kitchen, household size); the rest stay in Starters & packs.
    await copyStarters(userId, pickStarters(starters, data).map((s) => s.id));
    redirect("/");
  }
  if (startWith === "own") redirect("/recipes/new");
  // Editing Settings: stay put (the screen says it saved). First-time setup goes on to Home.
  if (stay) {
    revalidatePath("/");
    revalidatePath("/setup");
    return;
  }
  redirect("/");
}

export async function lookupStores(zip: string): Promise<{ stores?: StoreLocation[]; error?: string; disabled?: boolean }> {
  const userId = await requireUserId();
  if (!(await under("stores", userId))) return { error: TOO_MANY };
  if (!krogerEnabled()) return { disabled: true };
  if (!/^\d{5}$/.test(zip.trim())) return { error: "Enter a 5-digit zip code." };
  try {
    return { stores: await findStores(zip.trim()) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
