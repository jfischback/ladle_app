import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { extraItems, pantryItems } from "@/db/schema";
import { myExtras, myPantry } from "./data";
import { CATEGORIES } from "./extras";
import { pantrySearchTerm, sameThing } from "./pantry";
import type { SaleItem } from "./types";

type Thing = { section: string; item: string };

/** Which pantry rows and snack rows a set of grocery lines stands for. Pure, so it can be tested. */
export function boughtMatches(
  things: Thing[],
  pantry: { id: string; name: string }[],
  extras: { id: string; category: string; name: string }[],
  stockUp: Pick<SaleItem, "item">[] = [],
): { pantryIds: string[]; extraIds: string[] } {
  const labelOf = new Map(CATEGORIES.map((c) => [c.label.toLowerCase(), c.key as string]));
  const stock = things.some((t) => /stock up/i.test(t.section)) ? new Set(stockUp.map((s) => s.item)) : new Set<string>();
  const pantryIds = pantry.filter((p) => things.some((t) => sameThing(t.item, p.name)) || stock.has(pantrySearchTerm(p.name))).map((p) => p.id);
  const extraIds = extras.filter((x) => things.some((t) => labelOf.get(t.section.toLowerCase()) === x.category && t.item.trim().toLowerCase() === x.name.trim().toLowerCase())).map((x) => x.id);
  return { pantryIds, extraIds };
}

/**
 * Ladle only knows something was bought when a person says so: they ticked it off the grocery list, or sent it
 * to their store cart. Approving a week doesn't count (the shopping hasn't happened yet). `got` false undoes a tick:
 * the thing was on the list to buy and wasn't got, so it's low again.
 */
export async function markBought(userId: string, things: Thing[], got: boolean, stockUp: Pick<SaleItem, "item">[] = []): Promise<void> {
  if (!things.length) return;
  const [pantry, extras] = await Promise.all([myPantry(userId), myExtras(userId)]);
  const { pantryIds, extraIds } = boughtMatches(things, pantry, extras, stockUp);
  const db = await getDb();
  const now = new Date();
  if (pantryIds.length) {
    await db.update(pantryItems).set({ status: got ? "have" : "low", updatedAt: now }).where(and(eq(pantryItems.userId, userId), inArray(pantryItems.id, pantryIds)));
  }
  for (const x of extras.filter((x) => extraIds.includes(x.id))) {
    // "Rotate" items take turns from when they were last bought; "when low" items count as restocked.
    await db.update(extraItems).set(got ? { lastPickedAt: now, ...(x.mode === "when-low" ? { status: "have" as const } : {}) } : x.mode === "when-low" ? { status: "low" as const } : {}).where(eq(extraItems.id, x.id));
  }
}
