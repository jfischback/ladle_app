import "server-only";
import { headers } from "next/headers";
import { lt, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Count one use of `key` in the current window. Returns false when it's over `limit`.
 * Kept in the database, so it holds across Vercel's many servers.
 */
export async function allow(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const db = await getDb();
  const start = new Date(Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  // Now and then, clear out old windows.
  if (Math.random() < 0.02) await db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - 2 * 86400000)));
  return (row?.count ?? 1) <= limit;
}

/** The visitor's address, for limits before anyone is signed in. */
export async function clientAddress(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/** The limits, in one place. */
export const LIMITS = {
  loginPerEmail: [10, 15 * 60],
  loginPerAddress: [40, 15 * 60],
  signupPerAddress: [10, 60 * 60],
  plan: [20, 60 * 60],
  approve: [20, 60 * 60],
  importRecipe: [30, 60 * 60],
  cooks: [30, 60 * 60],
  cartMatch: [15, 60 * 60],
  cartSend: [10, 60 * 60],
  stores: [30, 60 * 60],
  invite: [20, 24 * 60 * 60],
} as const satisfies Record<string, readonly [number, number]>;

export const TOO_MANY = "That's a lot of tries in a short time. Please wait a few minutes and try again.";

/** Shorthand: `if (!(await under("plan", userId))) return { error: TOO_MANY }`. */
export const under = (what: keyof typeof LIMITS, who: string) => allow(`${what}:${who}`, LIMITS[what][0], LIMITS[what][1]);
