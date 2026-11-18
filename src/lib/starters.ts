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
    .select({ starterId: recipes.starterId, name: recipes.name })
    .from(recipes)
    .where(eq(recipes.ownerId, userId)); // removed ones count too: they aren't added back
  const have = new Set(already.map((a) => a.starterId));
  // Skip a recipe they already have by name too: the shared list once held some recipes twice.
  const names = new Set(already.map((a) => a.name.trim().toLowerCase()));
  const starters = await db
    .select()
    .from(recipes)
    .where(and(inArray(recipes.id, starterIds), isNull(recipes.ownerId)));
  const rows = starters
    .filter((s) => {
      const k = s.name.trim().toLowerCase();
      if (have.has(s.id) || names.has(k)) return false;
      names.add(k);
      return true;
    })
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
