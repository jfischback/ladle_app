"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { StaplesSchema } from "@/lib/staples";
import type { Staple } from "@/lib/types";

/** Save the weekly staples list (only that part of the settings). */
export async function saveStaples(list: Staple[]): Promise<{ error?: string } | void> {
  const userId = await requireUserId();
  const parsed = StaplesSchema.safeParse(list);
  if (!parsed.success) return { error: "Each staple needs a name (2 to 60 letters)." };
  const { data, complete } = await getSettings(userId);
  const next = { ...data, staples: parsed.data };
  const now = new Date();
  const db = await getDb();
  await db
    .insert(settingsTable)
    .values({ userId, data: next, completedAt: complete ? now : null, updatedAt: now })
    .onConflictDoUpdate({ target: settingsTable.userId, set: { data: next, updatedAt: now } });
  revalidatePath("/staples");
  revalidatePath("/");
}
