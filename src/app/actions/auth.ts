"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { z } from "zod";
import { claimSharedDataIfFirst, signIn, signOut } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { TOO_MANY, clientAddress, under } from "@/lib/rate-limit";
import { INVITE_ONLY_MESSAGE, mayCreateAccount, markFamilyInviteUsed } from "@/lib/signup-policy";

export type FormState = { error?: string } | undefined;

const SignupSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await under("signupPerAddress", await clientAddress()))) return { error: TOO_MANY };
  // Invite-only mode: a "new family" invite, a "join my household" link, or the very first account.
  const next = String(form.get("next") ?? "");
  const familyInvite = String(form.get("invite") ?? "");
  const joinCode = next.match(/^\/join\/([A-Za-z0-9_-]+)$/)?.[1];
  if (!(await mayCreateAccount({ familyInvite, joinCode }))) return { error: INVITE_ONLY_MESSAGE };
  const db = await getDb();
  const { email, password, name } = parsed.data;
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return { error: "An account with that email already exists. Sign in instead." };
  const [row] = await db.insert(users).values({ email, name: name || null, passwordHash: await bcrypt.hash(password, 10) }).returning();
  // The first account keeps everything set up while login was off; everyone else starts fresh.
  const claimed = await claimSharedDataIfFirst(row.id);
  if (familyInvite) await markFamilyInviteUsed(familyInvite, row.id);
  // Joining someone's household from an invite link: go back to it after signing up.
  const redirectTo = /^\/join\/[A-Za-z0-9_-]+$/.test(next) ? next : claimed ? "/" : "/setup";
  await signIn("credentials", { email, password, redirectTo });
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const next = String(form.get("next") ?? "");
  // Slow down password guessing: per email and per address.
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!(await under("loginPerEmail", email)) || !(await under("loginPerAddress", await clientAddress()))) return { error: TOO_MANY };
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: /^\/join\/[A-Za-z0-9_-]+$/.test(next) ? next : "/",
    });
  } catch (err) {
    if (err instanceof AuthError) return { error: "That email and password don't match." };
    throw err; // redirect
  }
}

export async function googleLogin() {
  await signIn("google", { redirectTo: "/" });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}
