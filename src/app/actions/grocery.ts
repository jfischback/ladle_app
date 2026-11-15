"use server";

import { and, eq, sql } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { cleanChecks } from "@/lib/grocery-checks";

/**
 * Tick or untick grocery list items for everyone in the household. Only the changed items are merged in,
 * so two people shopping at once don't undo each other's ticks.
 */
export async function setGroceryChecks(planId: string, changes: Record<string, boolean>): Promise<Record<string, boolean> | null> {
  const userId = await requireUserId();
  const clean = cleanChecks(changes);
  if (!/^[0-9a-f-]{36}$/i.test(planId) || !Object.keys(clean).length) return null;
  const db = await getDb();
  const [row] = await db
    .update(plans)
    .set({ groceryChecked: sql`coalesce(${plans.groceryChecked}, '{}'::jsonb) || ${JSON.stringify(clean)}::jsonb` })
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
    .returning({ groceryChecked: plans.groceryChecked });
  return row?.groceryChecked ?? null;
}
