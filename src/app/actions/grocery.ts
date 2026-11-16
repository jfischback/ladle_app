"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { cleanChecks, tickKey } from "@/lib/grocery-checks";
import { updateGroceryList } from "@/lib/plan-list";
import { getPlan } from "@/lib/data";
import { markBought } from "@/lib/bought";
import { ADDED_SECTION, addToList, parseAdded, removeFromList } from "@/lib/grocery-add";
import type { GroceryList } from "@/lib/types";

async function changeList(planId: string, change: (list: GroceryList) => GroceryList, untick?: string): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return { error: "Plan not found." };
  try {
    const saved = await updateGroceryList(userId, planId, change);
    if (!saved) return { error: "Approve the week first to get a grocery list." };
    // More of something already ticked, or taken off: it isn't "got" any more.
    if (untick) await mergeChecks(userId, planId, { [tickKey(ADDED_SECTION, untick)]: false });
  } catch (e) {
    return { error: (e as Error).message.startsWith("That's a lot") ? (e as Error).message : "Couldn't change the list just now. Try again." };
  }
  revalidatePath("/");
  return {};
}

/** Add something to this week's list that isn't for a recipe ("paper towels", "2 birthday candles"). */
export async function addGroceryItem(planId: string, text: string) {
  if (String(text).trim().length < 2) return { error: "Type what you need." };
  return changeList(planId, (list) => addToList(list, String(text)), parseAdded(String(text))?.item);
}

/** Take something the family added back off the list. */
export async function removeGroceryItem(planId: string, item: string) {
  return changeList(planId, (list) => removeFromList(list, String(item)), String(item));
}

/**
 * Tick or untick grocery list items for everyone in the household. Only the changed items are merged in,
 * so two people shopping at once don't undo each other's ticks.
 */
export async function setGroceryChecks(planId: string, changes: Record<string, boolean>): Promise<Record<string, boolean> | null> {
  const userId = await requireUserId();
  const clean = cleanChecks(changes);
  if (!/^[0-9a-f-]{36}$/i.test(planId) || !Object.keys(clean).length) return null;
  const saved = await mergeChecks(userId, planId, clean);
  // A tick is how Ladle knows something was bought (and an untick, that it wasn't): keep the pantry in step.
  if (saved) {
    const plan = await getPlan(userId, planId);
    const things = (on: boolean) => Object.entries(clean).filter(([, v]) => v === on).map(([k]) => ({ section: k.split("::")[0], item: k.split("::").slice(1).join("::") }));
    await markBought(userId, things(true), true, plan?.stockUp ?? []);
    await markBought(userId, things(false), false, plan?.stockUp ?? []);
  }
  return saved;
}

async function mergeChecks(userId: string, planId: string, clean: Record<string, boolean>): Promise<Record<string, boolean> | null> {
  const db = await getDb();
  const [row] = await db
    .update(plans)
    .set({ groceryChecked: sql`coalesce(${plans.groceryChecked}, '{}'::jsonb) || ${JSON.stringify(clean)}::jsonb` })
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
    .returning({ groceryChecked: plans.groceryChecked });
  return row?.groceryChecked ?? null;
}
