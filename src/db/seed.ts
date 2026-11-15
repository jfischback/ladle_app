import { isNull } from "drizzle-orm";
import type { DB } from "./index";
import { recipes, type NewRecipe } from "./schema";
import starter from "@/data/starter-recipes.json";

/**
 * Loads the shared starter set (from the Starter Recipe Set sheet) on first boot,
 * and adds any starter recipes that were added to the JSON file since.
 * Existing rows are never changed or removed.
 */
export async function seedStarterSet(db: DB) {
  const existing = await db.select({ name: recipes.name }).from(recipes).where(isNull(recipes.ownerId));
  const have = new Set(existing.map((r) => r.name));
  const rows: NewRecipe[] = (starter as NewRecipe[])
    .filter((r) => !have.has(r.name))
    .map((r) => ({ ...r, ownerId: null }));
  if (rows.length) await db.insert(recipes).values(rows);
}
