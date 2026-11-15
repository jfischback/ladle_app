import { eq, isNull } from "drizzle-orm";
import type { DB } from "./index";
import { recipes, type NewRecipe } from "./schema";
import starter from "@/data/starter-recipes.json";

/**
 * Loads the shared starter set (from the Starter Recipe Set sheet) on first boot,
 * and adds any starter recipes that were added to the JSON file since.
 * Existing rows are never removed; only their tags follow the file (tags decide which recipe packs they're in).
 * Families' own copies are never touched.
 */
export async function seedStarterSet(db: DB) {
  const existing = await db.select({ id: recipes.id, name: recipes.name, tags: recipes.tags }).from(recipes).where(isNull(recipes.ownerId));
  const have = new Set(existing.map((r) => r.name));
  const rows: NewRecipe[] = (starter as NewRecipe[])
    .filter((r) => !have.has(r.name))
    .map((r) => ({ ...r, ownerId: null }));
  if (rows.length) await db.insert(recipes).values(rows);
  const tagsByName = new Map((starter as NewRecipe[]).map((r) => [r.name, r.tags ?? []]));
  for (const e of existing) {
    const want = tagsByName.get(e.name);
    if (want && [...want].sort().join("|") !== [...e.tags].sort().join("|")) await db.update(recipes).set({ tags: want }).where(eq(recipes.id, e.id));
  }
}
