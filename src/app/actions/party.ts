"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { parties } from "@/db/schema";
import { activePlans } from "@/lib/data";
import { PARTY_DISHES, PARTY_KINDS, partyKind } from "@/lib/party";
import { isSectionOf, partyGroceries, withPartySection, withoutParty } from "@/lib/party-grocery";
import { updateGroceryList } from "@/lib/plan-list";
import { addDays, today } from "@/lib/week";
import type { SaleItem } from "@/lib/types";

type Input = { kind: string; title: string; date: string; guests: number; meal: boolean; dishes?: string[] };

function clean(input: Input): { value?: Required<Input>; error?: string } {
  const kind = PARTY_KINDS.some((k) => k.key === input?.kind) ? input.kind : "other";
  const title = String(input?.title ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || partyKind(kind).label;
  const date = String(input?.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return { error: "Pick the party's date." };
  if (date < today()) return { error: "That date has passed." };
  if (date > addDays(today(), 366)) return { error: "Pick a date within the next year." };
  const guests = Math.round(Number(input?.guests));
  if (!Number.isFinite(guests) || guests < 4 || guests > 150) return { error: "Choose between 4 and 150 guests." };
  const keys = new Set(PARTY_DISHES.map((d) => d.key));
  const dishes = Array.isArray(input.dishes) ? [...new Set(input.dishes.filter((d) => keys.has(d)))] : [...partyKind(kind).dishes];
  if (!dishes.length) return { error: "Pick at least one thing to serve." };
  return { value: { kind, title, date, guests, meal: !!input.meal, dishes } };
}

const isId = (id: unknown): id is string => typeof id === "string" && /^[0-9a-f-]{36}$/i.test(id);

/** Plan a new party: it starts with the usual food for that kind of party, ready to change. */
export async function createParty(input: Input): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const { value, error } = clean(input);
  if (!value) return { error };
  const db = await getDb();
  const mine = await db.select({ id: parties.id }).from(parties).where(and(eq(parties.userId, userId), isNull(parties.archivedAt)));
  if (mine.length >= 20) return { error: "That's a lot of parties! Remove an old one first." };
  const [row] = await db.insert(parties).values({ userId, ...value }).returning({ id: parties.id });
  revalidatePath("/party");
  redirect(`/party/${row.id}`);
}

/** Change the guest count, the date, whether it's the meal, or the food. */
export async function updateParty(id: string, input: Input): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!isId(id)) return { error: "Party not found." };
  const { value, error } = clean(input);
  if (!value) return { error };
  const db = await getDb();
  const [old] = await db.select().from(parties).where(and(eq(parties.id, id), eq(parties.userId, userId), isNull(parties.archivedAt)));
  if (!old) return { error: "Party not found." };
  await db.update(parties).set(value).where(eq(parties.id, old.id));
  // Already on a grocery list: keep that list in step (more guests, different food, new name).
  for (const p of await activePlans(userId)) {
    if (!p.groceryList?.sections.some((s) => isSectionOf(s, old.id, old.title))) continue;
    const sales = p.saleItems.filter((x): x is SaleItem => typeof x !== "string");
    const section = partyGroceries(value, sales);
    // Same title: the section keeps its name and its ticks. A new title replaces it.
    await updateGroceryList(userId, p.id, (list) => withPartySection(value.title === old.title ? list : withoutParty(list, old.id, old.title), section, old.id, value.title));
  }
  revalidatePath(`/party/${id}`);
  revalidatePath("/");
  return {};
}

/** Take a party off the list (and its groceries off the week's list, if they were added). */
export async function removeParty(id: string): Promise<void> {
  const userId = await requireUserId();
  if (!isId(id)) return;
  const db = await getDb();
  const [row] = await db.update(parties).set({ archivedAt: new Date() }).where(and(eq(parties.id, id), eq(parties.userId, userId))).returning();
  if (row) {
    for (const p of await activePlans(userId)) {
      if (p.groceryList?.sections.some((s) => isSectionOf(s, row.id, row.title))) {
        await updateGroceryList(userId, p.id, (list) => withoutParty(list, row.id, row.title));
      }
    }
  }
  revalidatePath("/party");
  redirect("/party");
}

/** Put the party's shopping on the grocery list for the week you'll shop for it (two days before). */
export async function addPartyToList(id: string): Promise<{ error?: string; week?: string }> {
  const userId = await requireUserId();
  if (!isId(id)) return { error: "Party not found." };
  const db = await getDb();
  const [party] = await db.select().from(parties).where(and(eq(parties.id, id), eq(parties.userId, userId), isNull(parties.archivedAt)));
  if (!party) return { error: "Party not found." };
  const shop = addDays(party.date, -2);
  const withList = (await activePlans(userId)).filter((p) => p.groceryList);
  // The week whose shopping covers the party: it includes the shopping day or the party, else the latest week before it.
  const plan =
    withList.find((p) => p.days.some((d) => d.date === shop || d.date === party.date)) ??
    withList.filter((p) => p.weekOf <= party.date).sort((a, b) => b.weekOf.localeCompare(a.weekOf))[0];
  if (!plan) return { error: "Approve a week's dinners first, then the party's shopping goes on that grocery list." };
  const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
  const section = partyGroceries(party, sales);
  const saved = await updateGroceryList(userId, plan.id, (list) => withPartySection(list, section, party.id, party.title));
  if (!saved) return { error: "Couldn't add it just now. Try again." };
  revalidatePath("/");
  return { week: plan.weekOf };
}
