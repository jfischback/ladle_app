import "server-only";
import { and, desc, eq, isNull, isNotNull, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { cooks, foundRecipes, pantryItems, plans, recipes, settings as settingsTable } from "@/db/schema";
import { DEFAULT_SETTINGS, cookDaysFor, type Settings } from "./settings";

export async function getSettings(userId: string): Promise<{ data: Settings; complete: boolean }> {
  const db = await getDb();
  const [row] = await db.select().from(settingsTable).where(eq(settingsTable.userId, userId));
  const saved = row?.data ?? {};
  const cookDays = cookDaysFor(saved);
  return { data: { ...DEFAULT_SETTINGS, ...saved, cookDays, dinnersPerWeek: cookDays.length }, complete: !!row?.completedAt };
}

export async function myRecipes(userId: string, meal = "dinner") {
  const db = await getDb();
  return db
    .select()
    .from(recipes)
    .where(and(eq(recipes.ownerId, userId), eq(recipes.meal, meal), isNull(recipes.archivedAt), eq(recipes.trial, false)))
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

export async function myCooks(userId: string) {
  const db = await getDb();
  return db.select().from(cooks).where(and(eq(cooks.userId, userId), isNull(cooks.archivedAt))).orderBy(cooks.name);
}

/** New dinners from followed cooks, newest first, one per title. */
export async function cookShelf(userId: string, limit = 60) {
  const db = await getDb();
  const rows = await db
    .select({ found: foundRecipes, cookName: cooks.name })
    .from(foundRecipes)
    .innerJoin(cooks, eq(cooks.id, foundRecipes.cookId))
    .where(and(eq(foundRecipes.userId, userId), eq(foundRecipes.status, "new"), isNull(cooks.archivedAt)))
    .orderBy(desc(foundRecipes.publishedAt), desc(foundRecipes.createdAt));
  const seen = new Set<string>();
  return rows.filter((r) => {
    const key = `${r.cookName}|${r.found.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

export async function myPantry(userId: string) {
  const db = await getDb();
  return db.select().from(pantryItems).where(eq(pantryItems.userId, userId)).orderBy(pantryItems.place, pantryItems.name);
}
