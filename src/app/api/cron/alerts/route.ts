import { NextResponse } from "next/server";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { pushSubscriptions, settings as settingsTable } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { householdAlerts } from "@/lib/household-alerts";
import { pushEnabled, sendPush } from "@/lib/push";
import type { Settings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// At most this many phone alerts a household gets in one morning (the most important first).
const PER_DAY = 3;

/**
 * Once a day (Vercel Cron, see vercel.json): send each household with phone alerts on what's new for them
 * today. Every alert goes out once (remembered in settings), and closed alerts never go out.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  if (!pushEnabled()) return NextResponse.json({ skipped: "Phone alerts aren't set up (no VAPID keys)." });
  const db = await getDb();
  const subs = await db.select().from(pushSubscriptions);
  const byHousehold = new Map<string, typeof subs>();
  for (const s of subs) byHousehold.set(s.userId, [...(byHousehold.get(s.userId) ?? []), s]);
  let sent = 0;
  const gone: string[] = [];
  for (const [userId, phones] of byHousehold) {
    try {
      const { data, complete } = await getSettings(userId);
      if (!complete || data.notifyLevel === "off") continue;
      const pushed = new Set(data.pushedAlerts ?? []);
      const fresh = (await householdAlerts(userId, data)).filter((a) => !pushed.has(a.key)).sort((a, b) => (a.level === b.level ? 0 : a.level === "essential" ? -1 : 1)).slice(0, PER_DAY);
      if (!fresh.length) continue;
      for (const a of fresh) {
        for (const p of phones) {
          const r = await sendPush(p, { title: a.title, body: a.text, url: a.href, tag: a.key });
          if (r === "sent") sent++;
          if (r === "gone") gone.push(p.id);
        }
      }
      const [row] = await db.select({ data: settingsTable.data }).from(settingsTable).where(eq(settingsTable.userId, userId));
      const saved = row?.data as Settings;
      await db.update(settingsTable).set({ data: { ...saved, pushedAlerts: [...(saved.pushedAlerts ?? []), ...fresh.map((a) => a.key)].slice(-120) } }).where(eq(settingsTable.userId, userId));
    } catch {
      // One household's trouble never stops the others.
    }
  }
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, [...new Set(gone)]));
  return NextResponse.json({ households: byHousehold.size, sent, removed: gone.length });
}
