import "server-only";
import { and, eq, gt, isNull, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { householdInvites, settings as settingsTable, users } from "@/db/schema";

const GUEST_EMAIL = "guest@ladle.local";

/** "open": anyone with the link can make an account. "invite": only with an invite link (set SIGNUP_MODE=invite). */
export const inviteOnly = () => process.env.SIGNUP_MODE === "invite";

/** The first account (the owner, taking over what was set up before sign-in) can always sign up. */
export async function ownerStillToCome(): Promise<boolean> {
  const db = await getDb();
  const [guest] = await db.select({ id: users.id }).from(users).where(eq(users.email, GUEST_EMAIL));
  if (guest) {
    const [setUp] = await db.select({ id: settingsTable.userId }).from(settingsTable).where(eq(settingsTable.userId, guest.id));
    const [claimed] = await db.select({ id: users.id }).from(users).where(eq(users.householdId, guest.id));
    if (setUp && !claimed) return true;
  }
  const [anyone] = await db.select({ id: users.id }).from(users).where(guest ? ne(users.id, guest.id) : undefined).limit(1);
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
export async function mayCreateAccount(opts: { familyInvite?: string; joinCode?: string }): Promise<boolean> {
  if (!inviteOnly()) return true;
  if (opts.familyInvite && (await validInvite(opts.familyInvite, "family"))) return true;
  if (opts.joinCode && (await validInvite(opts.joinCode, "join"))) return true;
  return ownerStillToCome();
}

/** Mark a "new family" invite as used by the account it created. */
export async function markFamilyInviteUsed(code: string, accountId: string) {
  const db = await getDb();
  await db.update(householdInvites).set({ usedBy: accountId, usedAt: new Date() })
    .where(and(eq(householdInvites.code, code), eq(householdInvites.kind, "family"), isNull(householdInvites.usedAt)));
}

export const INVITE_ONLY_MESSAGE = "Ladle is invite-only right now. Ask someone who uses it to send you an invite link.";
