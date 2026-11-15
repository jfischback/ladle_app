"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { extraItems, settings as settingsTable } from "@/db/schema";
import { getSettings } from "@/lib/data";
import type { ExtraCategory, ExtrasRule } from "@/lib/types";

const Category = z.enum(["snacks", "sweets", "drinks", "baby"]);
const Mode = z.enum(["always", "on-sale", "rotate", "when-low"]);
const ItemSchema = z.object({
  category: Category,
  name: z.string().trim().min(2).max(120),
  mode: Mode,
  qty: z.number().int().min(1).max(24).default(1),
  saleQty: z.number().int().min(1).max(24).nullable().default(null),
  anyBrand: z.boolean().default(false),
  servings: z.number().int().min(1).max(48).nullable().default(null),
});

function done() {
  revalidatePath("/extras");
  revalidatePath("/");
}

export async function addExtra(input: { category: ExtraCategory; name: string; mode: string; qty?: number; saleQty?: number | null; anyBrand?: boolean; servings?: number | null }) {
  const userId = await requireUserId();
  const parsed = ItemSchema.safeParse(input);
  if (!parsed.success) return { error: "Give it a name (2 to 120 letters)." };
  const db = await getDb();
  await db
    .insert(extraItems)
    .values({ userId, ...parsed.data })
    .onConflictDoUpdate({ target: [extraItems.userId, extraItems.category, extraItems.name], set: { ...parsed.data } });
  done();
}

/** Change one or more fields; only what was changed is written (no defaults). */
export async function updateExtra(id: string, patch: { mode?: string; qty?: number; saleQty?: number | null; anyBrand?: boolean; servings?: number | null; status?: string }) {
  const userId = await requireUserId();
  const parsed = z
    .object({
      mode: Mode.optional(),
      qty: z.number().int().min(1).max(24).optional(),
      saleQty: z.number().int().min(1).max(24).nullable().optional(),
      anyBrand: z.boolean().optional(),
      servings: z.number().int().min(1).max(48).nullable().optional(),
      status: z.enum(["have", "low", "out"]).optional(),
    })
    .safeParse(patch);
  if (!parsed.success) return;
  const db = await getDb();
  await db.update(extraItems).set(parsed.data).where(and(eq(extraItems.id, id), eq(extraItems.userId, userId)));
  done();
}

export async function removeExtra(id: string) {
  const userId = await requireUserId();
  const db = await getDb();
  await db.delete(extraItems).where(and(eq(extraItems.id, id), eq(extraItems.userId, userId)));
  done();
}

/** A category's rules: how many to rotate in a week, a servings target (baby), never-buy words for "any brand" items. */
export async function saveExtrasRule(category: ExtraCategory, rule: ExtrasRule) {
  const userId = await requireUserId();
  const parsed = z
    .object({ rotateCount: z.number().int().min(0).max(10), servingsTarget: z.number().int().min(0).max(50).nullable(), neverWords: z.array(z.string().trim().min(2).max(40)).max(30) })
    .safeParse(rule);
  if (!Category.safeParse(category).success || !parsed.success) return;
  const { data, complete } = await getSettings(userId);
  const next = { ...data, extras: { ...data.extras, [category]: parsed.data } };
  const now = new Date();
  const db = await getDb();
  await db
    .insert(settingsTable)
    .values({ userId, data: next, completedAt: complete ? now : null, updatedAt: now })
    .onConflictDoUpdate({ target: settingsTable.userId, set: { data: next, updatedAt: now } });
  done();
}
