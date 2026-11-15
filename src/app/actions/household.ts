"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { currentAccount, loginRequired } from "@/auth";
import { getDb } from "@/db";
import { householdInvites, users } from "@/db/schema";

const DAY = 86400000;

/** A "join my household" link, good for 7 days and one person. */
export async function createInvite(): Promise<{ code?: string; error?: string }> {
  if (!loginRequired) return { error: "Turn on sign-in first, so each person has their own account." };
  const me = await currentAccount();
  const code = randomBytes(9).toString("base64url");
  const db = await getDb();
  await db.insert(householdInvites).values({ code, householdId: me.householdId, createdBy: me.accountId, expiresAt: new Date(Date.now() + 7 * DAY) });
  revalidatePath("/household");
  return { code };
}

export async function cancelInvite(code: string) {
  const me = await currentAccount();
  const db = await getDb();
  await db.delete(householdInvites).where(and(eq(householdInvites.code, code), eq(householdInvites.householdId, me.householdId), isNull(householdInvites.usedAt)));
  revalidatePath("/household");
}

/** Join the household an invite is for. Your own recipes and plans are kept, just hidden, until you leave. */
export async function joinHousehold(code: string): Promise<{ error?: string }> {
  const me = await currentAccount();
  const db = await getDb();
  const [inv] = await db.select().from(householdInvites).where(and(eq(householdInvites.code, code), isNull(householdInvites.usedAt), gt(householdInvites.expiresAt, new Date())));
  if (!inv) return { error: "This invite link has expired or was already used. Ask for a new one." };
  if (inv.householdId === me.householdId) return { error: "You're already in this household." };
  await db.update(users).set({ householdId: inv.householdId === me.accountId ? null : inv.householdId }).where(eq(users.id, me.accountId));
  await db.update(householdInvites).set({ usedBy: me.accountId, usedAt: new Date() }).where(eq(householdInvites.code, code));
  revalidatePath("/", "layout");
  redirect("/");
}

/** Leave the shared household and go back to your own. */
export async function leaveHousehold() {
  const me = await currentAccount();
  if (me.householdId === me.accountId) return;
  const db = await getDb();
  await db.update(users).set({ householdId: null }).where(eq(users.id, me.accountId));
  revalidatePath("/", "layout");
  redirect("/");
}

/** Remove someone from your household (they go back to their own). */
export async function removeMember(accountId: string) {
  const me = await currentAccount();
  if (accountId === me.accountId) return;
  const db = await getDb();
  await db.update(users).set({ householdId: null }).where(and(eq(users.id, accountId), eq(users.householdId, me.householdId)));
  revalidatePath("/household");
}
