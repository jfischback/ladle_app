"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { currentAccount } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { completeReset, createResetLink, emailEnabled, sendResetEmail } from "@/lib/password-reset";
import { TOO_MANY, allow, clientAddress } from "@/lib/rate-limit";

export type ResetState = { error?: string; done?: string } | undefined;

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** "Forgot password?": email a reset link when email is set up. The answer never says whether an account exists. */
export async function requestReset(_: ResetState, form: FormData): Promise<ResetState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { error: "Enter the email you signed up with." };
  if (!(await allow(`reset:${email}`, 3, 3600)) || !(await allow(`reset-ip:${await clientAddress()}`, 10, 3600))) return { error: TOO_MANY };
  if (!emailEnabled()) {
    return { done: "Ladle can't send email yet. Ask the person who set up your household to make you a reset link: it's on their Household page, next to your name." };
  }
  const db = await getDb();
  const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (u) {
    try {
      await sendResetEmail(email, await createResetLink(u.id, await origin()));
    } catch {
      return { error: "We couldn't send the email just now. Please try again in a few minutes." };
    }
  }
  return { done: "If that email has a Ladle account, a reset link is on its way. It works once, for an hour." };
}

/** Choose a new password from a reset link. */
export async function resetPassword(_: ResetState, form: FormData): Promise<ResetState> {
  const token = String(form.get("token") ?? "");
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== String(form.get("confirm") ?? "")) return { error: "The two passwords don't match." };
  const ok = await completeReset(token, password);
  if (!ok) return { error: "This reset link has expired or was already used. Ask for a new one." };
  redirect("/login?reset=1");
}

/** A household owner makes a one-time reset link for a member who forgot their password (no email needed). */
export async function memberResetLink(accountId: string): Promise<{ url?: string; error?: string }> {
  const me = await currentAccount();
  if (!me.isOwner) return { error: "Only the household's owner can make reset links." };
  if (accountId === me.accountId) return { error: "Use “Forgot password?” on the sign-in page for your own account." };
  if (!(await allow(`member-reset:${me.accountId}`, 10, 3600))) return { error: TOO_MANY };
  const db = await getDb();
  const [member] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, accountId), eq(users.householdId, me.householdId)));
  if (!member) return { error: "That person isn't in your household." };
  return { url: await createResetLink(member.id, await origin()) };
}
