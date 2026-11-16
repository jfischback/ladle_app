import "server-only";
import { timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { householdInvites, settings as settingsTable, users } from "@/db/schema";

const GUEST_EMAIL = "guest@ladle.local";

/** "open": anyone with the link can make an account. "invite": only with an invite link (set SIGNUP_MODE=invite). */
export const inviteOnly = () => process.env.SIGNUP_MODE === "invite";

/**
 * The owner's claim code (OWNER_CLAIM_CODE, set by whoever runs the site): the only way to take over the household
 * that was set up while sign-in was off. Without it, being first to sign up gets nothing.
 */
export function validClaimCode(code: string | undefined | null): boolean {
  const want = process.env.OWNER_CLAIM_CODE ?? "";
  if (want.length < 12 || !code) return false;
  const a = Buffer.from(code);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Is there a household from before sign-in that nobody has taken over yet? */
export async function sharedHouseholdUnclaimed(): Promise<boolean> {
  const db = await getDb();
  const [guest] = await db.select({ id: users.id }).from(users).where(eq(users.email, GUEST_EMAIL));
  if (!guest) return false;
  const [setUp] = await db.select({ id: settingsTable.userId }).from(settingsTable).where(eq(settingsTable.userId, guest.id));
  const [claimed] = await db.select({ id: users.id }).from(users).where(eq(users.householdId, guest.id));
  return !!setUp && !claimed;
}

/**
 * In invite-only mode, may someone sign up with no invite? Only the owner: with the claim code when there's a
 * household to take over, or as the very first account on a site that has nothing set up yet.
 */
export async function ownerStillToCome(claimCode?: string): Promise<boolean> {
  if (await sharedHouseholdUnclaimed()) return validClaimCode(claimCode);
  const db = await getDb();
  const [anyone] = await db.select({ id: users.id }).from(users).where(ne(users.email, GUEST_EMAIL)).limit(1);
  return !anyone;
}

/** A still-good invite of this kind (unused, not expired). */
export async function validInvite(code: string, kind: "join" | "family"): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{6,40}$/.test(code)) return false;
  const db = await getDb();
  const [inv] = await db.select({ code: householdInvites.code }).from(householdInvites)
    .where(and(eq(householdInvites.code, code), eq(householdInvites.kind, kind), isNull(householdInvites.usedAt), gt(householdInvites.expiresAt, new Date())));
  return !!inv;
}

/**
 * May someone create an account right now? Always in open mode. In invite mode: with a "new family" invite,
 * a "join my household" invite link, or as the very first account (the owner).
 */
export async function mayCreateAccount(opts: { familyInvite?: string; joinCode?: string; claimCode?: string }): Promise<boolean> {
  if (!inviteOnly()) return true;
  if (opts.familyInvite && (await validInvite(opts.familyInvite, "family"))) return true;
  if (opts.joinCode && (await validInvite(opts.joinCode, "join"))) return true;
  return ownerStillToCome(opts.claimCode);
}

/** Mark a "new family" invite as used by the account it created. */
export async function markFamilyInviteUsed(code: string, accountId: string) {
  const db = await getDb();
  await db.update(householdInvites).set({ usedBy: accountId, usedAt: new Date() })
    .where(and(eq(householdInvites.code, code), eq(householdInvites.kind, "family"), isNull(householdInvites.usedAt)));
}

export const INVITE_ONLY_MESSAGE = "Ladle is invite-only right now. Ask someone who uses it to send you an invite link.";
