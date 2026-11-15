"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { recipes } from "@/db/schema";
import { draftFromPhoto, draftFromUrl, type RecipeDraft } from "@/lib/recipe-import";

/** Copy shared starter recipes into the user's private list (skips ones already added). */
export async function copyStarters(userId: string, starterIds: string[]) {
  if (!starterIds.length) return;
  const db = await getDb();
  const already = await db
    .select({ starterId: recipes.starterId })
    .from(recipes)
    .where(and(eq(recipes.ownerId, userId), inArray(recipes.starterId, starterIds)));
  const have = new Set(already.map((a) => a.starterId));
  const starters = await db
    .select()
    .from(recipes)
    .where(and(inArray(recipes.id, starterIds), isNull(recipes.ownerId)));
  const rows = starters
    .filter((s) => !have.has(s.id))
    .map((s) => ({
      meal: s.meal,
      name: s.name,
      protein: s.protein,
      servings: s.servings,
      totalMinutes: s.totalMinutes,
      ingredients: s.ingredients,
      steps: s.steps,
      tags: s.tags,
      ease: s.ease,
      prepAhead: s.prepAhead,
      creditName: s.creditName,
      creditUrl: s.creditUrl,
      sourceDocUrl: s.sourceDocUrl,
      ownerId: userId,
      starterId: s.id,
    }));
  if (rows.length) await db.insert(recipes).values(rows);
}

export async function addStarter(starterId: string) {
  const userId = await requireUserId();
  await copyStarters(userId, [starterId]);
  revalidatePath("/recipes");
}

export async function addAllStarters() {
  const userId = await requireUserId();
  const db = await getDb();
  const all = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(isNull(recipes.ownerId), isNull(recipes.archivedAt)));
  await copyStarters(userId, all.map((a) => a.id));
  revalidatePath("/recipes");
  redirect("/recipes");
}

const RecipeInput = z.object({
  name: z.string().trim().min(1, "Give the recipe a name.").max(200),
  meal: z.enum(["dinner", "breakfast", "lunch"]).default("dinner"),
  protein: z.string().trim().max(60).nullable(),
  servings: z.number().int().min(1).max(50).nullable(),
  totalMinutes: z.number().int().min(1).max(2000).nullable(),
  ingredients: z
    .array(z.object({ amount: z.string().trim().max(40), unit: z.string().trim().max(40), item: z.string().trim().max(200) }))
    .transform((xs) => xs.filter((x) => x.item)),
  steps: z.array(z.string().trim().max(2000)).transform((xs) => xs.filter(Boolean)),
  tags: z.array(z.string().trim().max(40)).max(20),
  ease: z.number().int().min(1).max(5).nullable(),
  prepAhead: z.string().trim().max(300).nullable(),
  creditName: z.string().trim().max(300).nullable(),
  creditUrl: z.string().trim().url().max(1000).nullable().or(z.literal("").transform(() => null)),
});
export type RecipeInputType = z.input<typeof RecipeInput>;

export async function saveRecipe(input: RecipeInputType, id?: string): Promise<{ error?: string } | void> {
  const userId = await requireUserId();
  const parsed = RecipeInput.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getDb();
  let recipeId = id;
  if (id) {
    const res = await db
      .update(recipes)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(recipes.id, id), eq(recipes.ownerId, userId)))
      .returning({ id: recipes.id });
    if (!res.length) return { error: "Recipe not found." };
  } else {
    const [row] = await db
      .insert(recipes)
      .values({ ...parsed.data, ownerId: userId })
      .returning({ id: recipes.id });
    recipeId = row.id;
  }
  revalidatePath("/recipes");
  redirect(`/recipes/${recipeId}`);
}

export async function archiveRecipe(id: string) {
  const userId = await requireUserId();
  const db = await getDb();
  await db
    .update(recipes)
    .set({ archivedAt: new Date() })
    .where(and(eq(recipes.id, id), eq(recipes.ownerId, userId)));
  revalidatePath("/recipes");
  redirect("/recipes");
}

export async function rateRecipe(id: string, stars: number) {
  const userId = await requireUserId();
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) return;
  const db = await getDb();
  await db
    .update(recipes)
    .set({ rating: stars, updatedAt: new Date() })
    .where(and(eq(recipes.id, id), eq(recipes.ownerId, userId)));
  revalidatePath(`/recipes/${id}`);
  revalidatePath("/recipes");
}

export type DraftResult = { draft?: RecipeDraft & { creditUrl?: string }; error?: string };

export async function importFromLink(url: string): Promise<DraftResult> {
  await requireUserId();
  try {
    return { draft: await draftFromUrl(url.trim()) };
  } catch (e) {
    return { error: e instanceof TypeError ? "That doesn't look like a web link." : (e as Error).message };
  }
}

export async function importFromPhoto(form: FormData): Promise<DraftResult> {
  await requireUserId();
  const file = form.get("photo");
  if (!(file instanceof File) || !file.size) return { error: "Choose a photo first." };
  if (file.size > 5 * 1024 * 1024) return { error: "That photo is over 5 MB. Try a smaller one." };
  try {
    const b64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return { draft: await draftFromPhoto(b64, file.type) };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
