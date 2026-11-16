"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { NOTIFY_LEVELS, type NotifyLevel } from "@/lib/alerts";
import type { Settings } from "@/lib/settings";

async function change(patch: (data: Settings) => Partial<Settings>): Promise<void> {
  const userId = await requireUserId();
  const db = await getDb();
  const [row] = await db.select({ data: settingsTable.data }).from(settingsTable).where(eq(settingsTable.userId, userId));
  if (!row) return;
  const data = row.data as Settings;
  await db.update(settingsTable).set({ data: { ...data, ...patch(data) }, updatedAt: new Date() }).where(eq(settingsTable.userId, userId));
  revalidatePath("/");
}

/** How many alerts: off, just the essentials, or everything. */
export async function setNotifyLevel(level: string): Promise<void> {
  if (!NOTIFY_LEVELS.some((l) => l.key === level)) return;
  await change(() => ({ notifyLevel: level as NotifyLevel }));
}

/** Close an alert for good (the newest 80 are remembered; older ones are long past anyway). */
export async function dismissAlert(key: string): Promise<void> {
  if (typeof key !== "string" || !/^[a-z]+:[\w:.-]{1,80}$/i.test(key)) return;
  await change((d) => ({ dismissedAlerts: [...(d.dismissedAlerts ?? []).filter((k) => k !== key), key].slice(-80) }));
}
