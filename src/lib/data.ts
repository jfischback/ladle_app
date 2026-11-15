import "server-only";
import { and, desc, eq, isNull, isNotNull, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { plans, recipes, settings as settingsTable } from "@/db/schema";
import { DEFAULT_SETTINGS, type Settings } from "./settings";

export async function getSettings(userId: string): Promise<{ data: Settings; complete: boolean }> {
  const db = await getDb();
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
  return { data: { ...DEFAULT_SETTINGS, ...(row?.data ?? {}) }, complete: !!row?.completedAt };
}

export async function myRecipes(userId: string, meal = "dinner") {
  const db = await getDb();
  return db
    .select()
    .from(recipes)
    .where(and(eq(recipes.ownerId, userId), eq(recipes.meal, meal), isNull(recipes.archivedAt)))
    .orderBy(recipes.name);
}

/** Starter recipes the user hasn't added to their list yet. */
export async function browseStarters(userId: string) {
  const db = await getDb();
  const mine = await db
    .select({ starterId: recipes.starterId })
    .from(recipes)
    .where(and(eq(recipes.ownerId, userId), isNotNull(recipes.starterId)));
  const added = new Set(mine.map((m) => m.starterId));
  const all = await db
    .select()
    .from(recipes)
    .where(and(isNull(recipes.ownerId), isNull(recipes.archivedAt)))
    .orderBy(recipes.protein, recipes.name);
  return all.filter((r) => !added.has(r.id));
}

export async function getRecipe(userId: string, id: string) {
  const db = await getDb();
  const [r] = await db.select().from(recipes).where(eq(recipes.id, id));
  if (!r || (r.ownerId !== null && r.ownerId !== userId)) return null;
  return r;
}

export async function recipesByIds(userId: string, ids: string[]) {
  if (!ids.length) return [];
  const db = await getDb();
  const rows = await db.select().from(recipes).where(inArray(recipes.id, ids));
  return rows.filter((r) => r.ownerId === userId);
}

export async function activePlans(userId: string) {
  const db = await getDb();
  return db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, userId), isNull(plans.archivedAt)))
    .orderBy(desc(plans.weekOf));
}

export async function getPlan(userId: string, id: string) {
  const db = await getDb();
  const [p] = await db.select().from(plans).where(and(eq(plans.id, id), eq(plans.userId, userId)));
  return p ?? null;
}
