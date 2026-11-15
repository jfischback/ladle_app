import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { authConfig } from "./auth.config";
import { getDb } from "./db";
import { users } from "./db/schema";

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
    async jwt({ token, user, account }) {
      if (user && account?.provider === "google" && user.email) {
        // Link Google sign-ins to our users table by email.
        const db = await getDb();
        const email = user.email.toLowerCase();
        const [found] = await db.select().from(users).where(eq(users.email, email));
        const row =
          found ?? (await db.insert(users).values({ email, name: user.name ?? null }).returning())[0];
        token.uid = row.id;
      } else if (user?.id) {
        token.uid = user.id;
      }
      return token;
    },
  },
});

export const loginRequired = process.env.REQUIRE_LOGIN === "true";

const GUEST_EMAIL = "guest@ladle.local";

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

/** Returns the current user's id or throws (use in server actions / pages behind middleware). */
export async function requireUserId(): Promise<string> {
  if (!loginRequired) return guestUserId();
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}
