"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { cooks, foundRecipes } from "@/db/schema";
import { SUGGESTED_COOKS, adoptFoundRecipe, findSource, refreshCooks, type CookSource } from "@/lib/cooks";
import { TOO_MANY, under } from "@/lib/rate-limit";

type Result = { error?: string; found?: number; remaining?: number } | void;

async function addCook(userId: string, src: CookSource) {
  const db = await getDb();
  const [existing] = await db
    .select()
    .from(cooks)
    .where(and(eq(cooks.userId, userId), eq(cooks.feedUrl, src.feedUrl), isNull(cooks.archivedAt)));
  if (!existing) await db.insert(cooks).values({ userId, ...src });
}

/** Follow a cook by their website address. */
export async function followCook(site: string): Promise<Result> {
  const userId = await requireUserId();
  if (!(await under("cooks", userId))) return { error: TOO_MANY };
  if (!site.trim()) return { error: "Type their website, like pinchofyum.com." };
  try {
    await addCook(userId, await findSource(site));
  } catch (e) {
    return { error: (e as Error).message };
  }
  const r = await refreshCooks(userId, { budgetMs: 25000 });
  revalidatePath("/recipes");
  return { found: r.found, remaining: r.remaining };
}

/** Follow one or more of the suggested cooks. */
export async function followSuggested(names: string[]): Promise<Result> {
  const userId = await requireUserId();
  if (!(await under("cooks", userId))) return { error: TOO_MANY };
  for (const src of SUGGESTED_COOKS.filter((c) => names.includes(c.name))) await addCook(userId, src);
  const r = await refreshCooks(userId, { budgetMs: 25000 });
  revalidatePath("/recipes");
  return { found: r.found, remaining: r.remaining };
}

export async function unfollowCook(id: string) {
  const userId = await requireUserId();
  const db = await getDb();
  await db.update(cooks).set({ archivedAt: new Date() }).where(and(eq(cooks.id, id), eq(cooks.userId, userId)));
  revalidatePath("/recipes");
}

/** "Check for new recipes" button. */
export async function checkCooks(): Promise<Result> {
  const userId = await requireUserId();
  if (!(await under("cooks", userId))) return { error: TOO_MANY };
  const r = await refreshCooks(userId, { budgetMs: 25000, minHours: 0 });
  revalidatePath("/recipes");
  return { found: r.found, remaining: r.remaining };
}

/** Save a found recipe to My Recipes. */
export async function saveFound(id: string): Promise<{ error?: string; recipeId?: string }> {
  const userId = await requireUserId();
  const db = await getDb();
  const [row] = await db
    .select({ found: foundRecipes, cookName: cooks.name })
    .from(foundRecipes)
    .innerJoin(cooks, eq(cooks.id, foundRecipes.cookId))
    .where(and(eq(foundRecipes.id, id), eq(foundRecipes.userId, userId)));
  if (!row) return { error: "Recipe not found." };
  try {
    const recipeId = await adoptFoundRecipe(userId, row.found, { name: row.cookName }, false);
    await db.update(foundRecipes).set({ status: "saved" }).where(eq(foundRecipes.id, id));
    revalidatePath("/recipes");
    return { recipeId };
  } catch (e) {
    return { error: `Couldn't save it: ${(e as Error).message}` };
  }
}

/** "Not for us": hide it and never plan it. */
export async function dismissFound(id: string) {
  const userId = await requireUserId();
  const db = await getDb();
  await db.update(foundRecipes).set({ status: "dismissed" }).where(and(eq(foundRecipes.id, id), eq(foundRecipes.userId, userId)));
  revalidatePath("/recipes");
}
