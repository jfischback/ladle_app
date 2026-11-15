"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { ACTING_COOKIE, actingFor, currentAccount, homeHouseholdId, loginRequired } from "@/auth";
import { getDb } from "@/db";
import { careLinks, householdInvites, settings as settingsTable, users } from "@/db/schema";
import { DEFAULT_SETTINGS } from "@/lib/settings";
import { TOO_MANY, under } from "@/lib/rate-limit";

const COOKIE = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 90 };

async function myLink(linkId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) return null;
  const home = await homeHouseholdId();
  const db = await getDb();
  const [link] = await db.select().from(careLinks).where(and(eq(careLinks.id, linkId), eq(careLinks.caregiverHouseholdId, home), isNull(careLinks.archivedAt)));
  return link ?? null;
}

/**
 * "Plan for someone else": add a person this family cares for (an aging parent). They get their own household
 * (recipes, plans, pantry, cart), and this browser switches to it and opens setup, ready for one adult.
 */
export async function addCaredFor(form: FormData): Promise<{ error?: string }> {
  const label = String(form.get("label") ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  if (label.length < 1) return { error: "Who are you planning for? Type a name, like Mom." };
  const home = await homeHouseholdId();
  if (!(await under("invite", home))) return { error: TOO_MANY };
  const db = await getDb();
  const existing = await db.select({ id: careLinks.id }).from(careLinks).where(and(eq(careLinks.caregiverHouseholdId, home), isNull(careLinks.archivedAt)));
  if (existing.length >= 6) return { error: "That's the most people one family can plan for. Remove someone first." };
  // Their household: an account no one signs in to (until they're invited), holding their recipes and plans.
  const [person] = await db.insert(users).values({ email: `care-${randomUUID()}@ladle.local`, name: label }).returning({ id: users.id });
  // Setup starts ready for one adult (they finish it themselves); it isn't complete until they save it.
  await db.insert(settingsTable).values({ userId: person.id, data: { ...DEFAULT_SETTINGS, adults: 1, kids: 0, weeklyBudget: 75 } });
  const [link] = await db.insert(careLinks).values({ caregiverHouseholdId: home, householdId: person.id, label }).returning({ id: careLinks.id });
  (await cookies()).set(ACTING_COOKIE, link.id, COOKIE);
  revalidatePath("/", "layout");
  redirect("/setup");
}

/** Switch to planning for someone this family cares for. */
export async function switchToCaredFor(linkId: string) {
  const link = await myLink(linkId);
  if (!link) return { error: "That person isn't on your list." };
  (await cookies()).set(ACTING_COOKIE, link.id, COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}

/** Back to planning for your own family. */
export async function switchToMyFamily() {
  (await cookies()).delete(ACTING_COOKIE);
  revalidatePath("/", "layout");
  redirect("/");
}

/** Stop planning for someone. Nothing is deleted: their recipes and plans stay, and you can be added back. */
export async function removeCaredFor(linkId: string) {
  const link = await myLink(linkId);
  if (!link) return;
  const db = await getDb();
  await db.update(careLinks).set({ archivedAt: new Date() }).where(eq(careLinks.id, link.id));
  if ((await actingFor())?.linkId === link.id) (await cookies()).delete(ACTING_COOKIE);
  revalidatePath("/", "layout");
}

/** Invite the person you care for to sign in and see their own plan (they join their household). */
export async function inviteCaredFor(linkId: string): Promise<{ code?: string; error?: string }> {
  if (!loginRequired) return { error: "Turn on sign-in first, so they can have their own account." };
  const link = await myLink(linkId);
  if (!link) return { error: "That person isn't on your list." };
  const me = await currentAccount();
  if (!(await under("invite", me.accountId))) return { error: TOO_MANY };
  const code = randomBytes(9).toString("base64url");
  const db = await getDb();
  await db.insert(householdInvites).values({ code, householdId: link.householdId, createdBy: me.accountId, expiresAt: new Date(Date.now() + 7 * 24 * 3600_000) });
  return { code };
}
