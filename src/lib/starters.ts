import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { recipes } from "@/db/schema";

// Lives outside "use server" files on purpose: it takes a userId, so it must never be callable from the browser.
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
