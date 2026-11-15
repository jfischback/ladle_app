import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { and, eq, isNull, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { getDb } from "./db";
import { careLinks, settings as settingsTable, users } from "./db/schema";
import { mayCreateAccount } from "./lib/signup-policy";

export const googleEnabled = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const db = await getDb();
        const email = parsed.data.email.toLowerCase().trim();
        const [user] = await db.select().from(users).where(eq(users.email, email));
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        return ok ? { id: user.id, email: user.email, name: user.name } : null;
      },
    }),
    ...(googleEnabled ? [Google] : []),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Invite-only mode applies to Google sign-ups too: a new Google account needs an invite (or to be the first).
    async signIn({ user, account }) {
      if (account?.provider !== "google" || !user.email) return true;
      const db = await getDb();
      const [found] = await db.select({ id: users.id }).from(users).where(eq(users.email, user.email.toLowerCase()));
      return found ? true : mayCreateAccount({});
    },
    async jwt({ token, user, account }) {
      if (user && account?.provider === "google" && user.email) {
        // Link Google sign-ins to our users table by email.
        const db = await getDb();
        const email = user.email.toLowerCase();
        const [found] = await db.select().from(users).where(eq(users.email, email));
        const row =
          found ?? (await db.insert(users).values({ email, name: user.name ?? null }).returning())[0];
        token.uid = row.id;
        if (!found) await claimSharedDataIfFirst(row.id);
      } else if (user?.id) {
        token.uid = user.id;
      }
      return token;
    },
  },
});

export const loginRequired = process.env.REQUIRE_LOGIN === "true";

export const GUEST_EMAIL = "guest@ladle.local";

/** While login is off, everyone shares this one built-in account. */
async function guestUserId(): Promise<string> {
  const db = await getDb();
  const [found] = await db.select().from(users).where(eq(users.email, GUEST_EMAIL));
  if (found) return found.id;
  const [row] = await db
    .insert(users)
    .values({ email: GUEST_EMAIL, name: "Guest" })
    .onConflictDoNothing()
    .returning();
  if (row) return row.id;
  const [again] = await db.select().from(users).where(eq(users.email, GUEST_EMAIL));
  return again.id;
}

/**
 * When login is first turned on, the first real account takes over everything made while it was off
 * (recipes, settings, plans, pantry, the Fry's connection), by joining the shared household.
 */
export async function claimSharedDataIfFirst(newUserId: string): Promise<boolean> {
  const db = await getDb();
  const [guest] = await db.select().from(users).where(eq(users.email, GUEST_EMAIL));
  if (!guest) return false;
  const [guestSettings] = await db.select({ userId: settingsTable.userId }).from(settingsTable).where(eq(settingsTable.userId, guest.id));
  if (!guestSettings) return false;
  // Only one account ever takes it over: the first to sign up after sign-in is turned on. (Accounts made
  // earlier, e.g. while testing, don't block this; anyone already in the shared household does.)
  const [claimed] = await db.select({ id: users.id }).from(users).where(and(eq(users.householdId, guest.id), ne(users.id, newUserId)));
  if (claimed) return false;
  // Only the very first real account gets it.
  await db.update(users).set({ householdId: guest.id, ownsHousehold: true }).where(eq(users.id, newUserId));
  return true;
}

/** The signed-in account (not the household): for account pages like "Household". */
export async function currentAccount(): Promise<{ accountId: string; householdId: string; email: string; name: string | null; isOwner: boolean }> {
  const db = await getDb();
  const id = loginRequired ? (await auth())?.user?.id : await guestUserId();
  if (!id) throw new Error("Not signed in");
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) throw new Error("Not signed in");
  return { accountId: u.id, householdId: u.householdId ?? u.id, email: u.email, name: u.name, isOwner: !u.householdId || u.ownsHousehold };
}

/** The signed-in account's own household (never the one they're caring for). */
export async function homeHouseholdId(): Promise<string> {
  if (!loginRequired) return guestUserId();
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Not signed in");
  // A household member uses the household's data.
  const db = await getDb();
  const [u] = await db.select({ householdId: users.householdId }).from(users).where(eq(users.id, id));
  if (!u) throw new Error("Not signed in");
  return u.householdId ?? id;
}

/** Caregiver mode: which cared-for household (if any) this browser has switched to. A cookie names the link. */
export const ACTING_COOKIE = "ladle-acting-for";

/**
 * The cared-for household this family is planning for right now, or null. The cookie only names a link; the
 * link must belong to the signed-in account's own household and not be removed, or it's ignored.
 */
export async function actingFor(home?: string): Promise<{ linkId: string; householdId: string; label: string } | null> {
  const linkId = (await cookies()).get(ACTING_COOKIE)?.value;
  if (!linkId || !/^[0-9a-f-]{36}$/i.test(linkId)) return null;
  const mine = home ?? (await homeHouseholdId());
  const db = await getDb();
  const [link] = await db
    .select({ id: careLinks.id, householdId: careLinks.householdId, label: careLinks.label })
    .from(careLinks)
    .where(and(eq(careLinks.id, linkId), eq(careLinks.caregiverHouseholdId, mine), isNull(careLinks.archivedAt)));
  return link ? { linkId: link.id, householdId: link.householdId, label: link.label } : null;
}

/**
 * The household whose data this request works on (use in server actions / pages behind middleware): the
 * account's own, or, in caregiver mode, the cared-for household it has switched to.
 */
export async function requireUserId(): Promise<string> {
  const home = await homeHouseholdId();
  return (await actingFor(home))?.householdId ?? home;
}
