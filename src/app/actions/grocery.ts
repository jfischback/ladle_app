"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { cleanChecks } from "@/lib/grocery-checks";
import { getPlan } from "@/lib/data";
import { addToList, removeFromList } from "@/lib/grocery-add";
import type { GroceryList } from "@/lib/types";

async function changeList(planId: string, change: (list: GroceryList) => GroceryList): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return { error: "Plan not found." };
  const plan = await getPlan(userId, planId);
  if (!plan?.groceryList) return { error: "Approve the week first to get a grocery list." };
  const db = await getDb();
  await db.update(plans).set({ groceryList: change(plan.groceryList) }).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  revalidatePath("/");
  return {};
}

/** Add something to this week's list that isn't for a recipe ("paper towels", "2 birthday candles"). */
export async function addGroceryItem(planId: string, text: string) {
  if (String(text).trim().length < 2) return { error: "Type what you need." };
  return changeList(planId, (list) => addToList(list, String(text)));
}

/** Take something the family added back off the list. */
export async function removeGroceryItem(planId: string, item: string) {
  return changeList(planId, (list) => removeFromList(list, String(item)));
}

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
