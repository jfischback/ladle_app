import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import type { Settings } from "./settings";

export const SEEN_KEYS = ["cooking", "pantry", "staples", "athletes", "creators", "getting-started-hidden"] as const;
export type SeenKey = (typeof SEEN_KEYS)[number];

/** Remember that a household has looked at a section (for the Getting started list). Writes only the first time. */
export async function markSeen(userId: string, key: SeenKey): Promise<void> {
  const db = await getDb();
  const [row] = await db.select({ data: settingsTable.data }).from(settingsTable).where(eq(settingsTable.userId, userId));
  if (!row) return;
  const data = row.data as Partial<Settings>;
  if ((data.seen ?? []).includes(key)) return;
  await db.update(settingsTable).set({ data: { ...data, seen: [...(data.seen ?? []), key] } as Settings }).where(eq(settingsTable.userId, userId));
}
