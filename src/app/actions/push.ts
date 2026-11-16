"use server";

import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { pushEnabled, sendPush } from "@/lib/push";
import { TOO_MANY, under } from "@/lib/rate-limit";

type Sub = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

/** This phone wants Ladle's alerts: remember it and send a hello, so they know it works. */
export async function savePushSubscription(sub: Sub): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!pushEnabled()) return { error: "Phone alerts aren't available yet." };
  if (!(await under("push", userId))) return { error: TOO_MANY };
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (!/^https:\/\/[^\s]{10,1000}$/.test(endpoint) || p256dh.length < 20 || p256dh.length > 200 || auth.length < 8 || auth.length > 100) return { error: "That phone's alert setup didn't look right. Try again." };
  const db = await getDb();
  const mine = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  if (mine.length >= 10) return { error: "That's a lot of phones. Turn alerts off on one first." };
  await db.insert(pushSubscriptions).values({ userId, endpoint, p256dh, auth }).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId, p256dh, auth } });
  const r = await sendPush({ endpoint, p256dh, auth }, { title: "Ladle alerts are on", body: "We'll let you know when it's time to plan, shop and prep.", url: "/", tag: "ladle-hello" });
  if (r === "gone") return { error: "That phone didn't accept alerts. Check its notification settings." };
  return {};
}

/** This phone doesn't want alerts any more. */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const userId = await requireUserId();
  if (typeof endpoint !== "string") return;
  const db = await getDb();
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, endpoint)));
}
