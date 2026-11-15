import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { passwordResets, users } from "@/db/schema";

const HOUR = 3600_000;
const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** A one-time reset link for an account, good for an hour. Only a hash of the token is kept. */
export async function createResetLink(userId: string, origin: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  const db = await getDb();
  await db.insert(passwordResets).values({ tokenHash: hash(token), userId, expiresAt: new Date(Date.now() + HOUR) });
  return `${origin}/reset/${token}`;
}

/** The account a still-good reset link is for, or null. */
export async function resetTarget(token: string): Promise<{ userId: string; email: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ userId: passwordResets.userId, email: users.email })
    .from(passwordResets)
    .innerJoin(users, eq(users.id, passwordResets.userId))
    .where(and(eq(passwordResets.tokenHash, hash(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, new Date())));
  return row ?? null;
}

/** Set the new password and use up every open link for that account. */
export async function completeReset(token: string, password: string): Promise<{ email: string } | null> {
  const target = await resetTarget(token);
  if (!target) return null;
  const db = await getDb();
  await db.update(users).set({ passwordHash: await bcrypt.hash(password, 10) }).where(eq(users.id, target.userId));
  await db.update(passwordResets).set({ usedAt: new Date() }).where(and(eq(passwordResets.userId, target.userId), isNull(passwordResets.usedAt)));
  return { email: target.email };
}

/** Email is optional: set RESEND_API_KEY and EMAIL_FROM (an address on a domain verified with Resend). */
export const emailEnabled = () => !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendResetEmail(to: string, url: string): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM,
      to,
      subject: "Reset your Ladle password",
      text: `Hi! Someone (hopefully you) asked to reset the password for your Ladle account.\n\nChoose a new password here (the link works once, for an hour):\n${url}\n\nIf you didn't ask for this, you can ignore this email.`,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Email failed (${res.status})`);
}
