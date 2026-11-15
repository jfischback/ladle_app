"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { pantryItems, plans } from "@/db/schema";
import { getPlan } from "@/lib/data";
import { PANTRY_SECTIONS, guessPlace, pantryName, type Place } from "@/lib/pantry";

const ItemSchema = z.object({
  name: z.string().trim().min(2).max(80),
  place: z.enum(["pantry", "fridge", "freezer"]),
  status: z.enum(["have", "low", "out"]).default("have"),
  onSaleOnly: z.boolean().default(false),
});

/** Add (or update, if the name is already there) a pantry item. */
export async function addPantryItem(input: { name: string; place?: Place; status?: "have" | "low" | "out"; onSaleOnly?: boolean }) {
  const userId = await requireUserId();
  const parsed = ItemSchema.safeParse({ place: guessPlace(input.name), ...input });
  if (!parsed.success) return { error: "Give it a name (2 to 80 letters)." };
  const db = await getDb();
  await db
    .insert(pantryItems)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({ target: [pantryItems.userId, pantryItems.name], set: { ...parsed.data, updatedAt: new Date() } });
  revalidatePath("/pantry");
  revalidatePath("/");
}

export async function updatePantryItem(id: string, patch: { status?: "have" | "low" | "out"; onSaleOnly?: boolean; place?: Place }) {
  const userId = await requireUserId();
  // No defaults here: a patch only changes what was tapped (starring an item must not reset its status).
  const parsed = z
    .object({ status: z.enum(["have", "low", "out"]).optional(), onSaleOnly: z.boolean().optional(), place: z.enum(["pantry", "fridge", "freezer"]).optional() })
    .safeParse(patch);
  if (!parsed.success) return;
  const db = await getDb();
  await db.update(pantryItems).set({ ...parsed.data, updatedAt: new Date() }).where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)));
  revalidatePath("/pantry");
  revalidatePath("/");
}

export async function removePantryItem(id: string) {
  const userId = await requireUserId();
  const db = await getDb();
  await db.delete(pantryItems).where(and(eq(pantryItems.id, id), eq(pantryItems.userId, userId)));
  revalidatePath("/pantry");
}

/**
 * Answer a "Pantry check" question on this week's grocery list. "Have it" remembers it in the pantry and moves it
 * to "Already in your pantry"; "Need it" keeps it on the list to buy (and remembers you're out).
 */
export async function answerPantryCheck(planId: string, item: string | null, have: boolean) {
  const userId = await requireUserId();
  const plan = await getPlan(userId, planId);
  if (!plan?.groceryList) return;
  const sections = plan.groceryList.sections.map((s) => ({ ...s, items: [...s.items] }));
  const check = sections.find((s) => s.name === PANTRY_SECTIONS.PANTRY_CHECK);
  if (!check) return;
  // One item, or every question at once ("I have all of these").
  const answering = item === null ? [...check.items] : check.items.filter((i) => i.item === item);
  if (!answering.length) return;
  const db = await getDb();
  for (const it of answering) {
    const name = pantryName(it.item).slice(0, 80);
    if (name.length < 2) continue;
    await db
      .insert(pantryItems)
      // "Need it" puts it on this week's list, so after shopping they'll have it: either way it's "have" next week.
      .values({ userId, name, place: guessPlace(name), status: "have" })
      .onConflictDoUpdate({ target: [pantryItems.userId, pantryItems.name], set: { status: "have", updatedAt: new Date() } });
  }
  check.items = check.items.filter((i) => !answering.includes(i));
  for (const moved of answering) {
    const targetName = have ? PANTRY_SECTIONS.HAVE_IT : "Pantry items to buy";
    let target = sections.find((s) => s.name === targetName);
    if (!target) {
      target = { name: targetName, items: [] };
      // "To buy" goes just before the pantry check; "have it" goes last.
      if (have) sections.push(target);
      else sections.splice(sections.indexOf(check), 0, target);
    }
    target.items.push({ ...moved, note: have ? "You have this" : "You said you need it" });
  }
  await db
    .update(plans)
    .set({ groceryList: { ...plan.groceryList, sections: sections.filter((s) => s.items.length) } })
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  revalidatePath("/");
}
