import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { plans } from "@/db/schema";
import type { GroceryList } from "./types";

/**
 * Change a week's grocery list without losing someone else's change made at the same moment: the plan row is
 * locked while the list is read, changed and written back. `change` returns the new list, or null to leave it.
 */
export async function updateGroceryList(userId: string, planId: string, change: (list: GroceryList) => GroceryList | null): Promise<GroceryList | null> {
  const db = await getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ groceryList: plans.groceryList })
      .from(plans)
      .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
      .for("update");
    if (!row?.groceryList) return null;
    const next = change(row.groceryList);
    if (!next) return null;
    await tx.update(plans).set({ groceryList: next }).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
    return next;
  });
}
