"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";

export type FormState = { error?: string } | undefined;

const SignupSchema = z.object({
  name: z.string().trim().max(80).optional(),
  email: z.string().trim().toLowerCase().email("Enter a valid email."),
  password: z.string().min(8, "Use at least 8 characters."),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const db = await getDb();
  const { email, password, name } = parsed.data;
  const [existing] = await db.select().from(users).where(eq(users.email, email));
  if (existing) return { error: "An account with that email already exists. Sign in instead." };
  await db.insert(users).values({ email, name: name || null, passwordHash: await bcrypt.hash(password, 10) });
  await signIn("credentials", { email, password, redirectTo: "/setup" });
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  try {
    await signIn("credentials", {
      email: form.get("email"),
      password: form.get("password"),
      redirectTo: "/",
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
