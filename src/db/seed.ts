import { eq, isNull, sql } from "drizzle-orm";
import type { DB } from "./index";
import { recipes, type NewRecipe } from "./schema";
import starter from "@/data/starter-recipes.json";

/**
 * Loads the shared starter set (from the Starter Recipe Set sheet) on first boot,
 * and adds any starter recipes that were added to the JSON file since.
 * Existing rows are never removed; only their tags (which decide the recipe packs) and steps (the method, in our words) follow the file.
 * Families' own copies are left alone, except that unedited copies get a reworded method.
 */
export async function seedStarterSet(db: DB) {
  // Several servers can start at once: one lock so only one of them adds missing starters (no doubles).
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(424242)`);
    await seedStarterSetLocked(tx as unknown as DB);
  });
}

async function seedStarterSetLocked(db: DB) {
  const existing = await db.select({ id: recipes.id, name: recipes.name, tags: recipes.tags, steps: recipes.steps }).from(recipes).where(isNull(recipes.ownerId));
  const have = new Set(existing.map((r) => r.name));
  const rows: NewRecipe[] = (starter as NewRecipe[])
    .filter((r) => !have.has(r.name))
    .map((r) => ({ ...r, ownerId: null }));
  if (rows.length) await db.insert(recipes).values(rows);
  const byName = new Map((starter as NewRecipe[]).map((r) => [r.name, r]));
  for (const e of existing) {
    const file = byName.get(e.name);
    if (!file) continue;
    const want = file.tags ?? [];
    const change: Partial<NewRecipe> = {};
    if ([...want].sort().join("|") !== [...e.tags].sort().join("|")) change.tags = want;
    if (file.steps && JSON.stringify(file.steps) !== JSON.stringify(e.steps)) change.steps = file.steps;
    if (Object.keys(change).length) await db.update(recipes).set(change).where(eq(recipes.id, e.id));
    // Families' copies get the new method too, but only if they never edited it (their steps still match the old wording).
    if (change.steps) {
      const copies = await db.select({ id: recipes.id, steps: recipes.steps }).from(recipes).where(eq(recipes.starterId, e.id));
      for (const c of copies) if (JSON.stringify(c.steps) === JSON.stringify(e.steps)) await db.update(recipes).set({ steps: change.steps }).where(eq(recipes.id, c.id));
    }
  }
}
