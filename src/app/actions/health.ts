"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { settings as settingsTable } from "@/db/schema";
import { getSettings } from "@/lib/data";
import type { HealthPerson } from "@/lib/health";

const PersonSchema = z.object({
  id: z.string().min(1).max(20),
  name: z.string().trim().max(40),
  conditions: z.array(z.enum(["diabetes", "lowsodium", "keto"])).max(3),
  carbsPerMeal: z.number().int().min(10).max(120),
  sodiumPerDay: z.number().int().min(500).max(5000),
});

/** Save the household's health needs (people who aren't in athlete mode). */
export async function saveHealthPeople(list: HealthPerson[]): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const parsed = z.array(PersonSchema).max(12).safeParse(list);
  if (!parsed.success) return { error: "Check the numbers: carbs 10 to 120 g a meal, sodium 500 to 5,000 mg a day." };
  // Someone with nothing ticked has no need to plan around.
  const healthPeople = parsed.data.filter((p) => p.conditions.length > 0);
  const { data: current, complete } = await getSettings(userId);
  const data = { ...current, healthPeople };
  const db = await getDb();
  const now = new Date();
  await db
    .insert(settingsTable)
    .values({ userId, data, updatedAt: now, completedAt: complete ? now : null })
    .onConflictDoUpdate({ target: settingsTable.userId, set: { data, updatedAt: now } });
  revalidatePath("/health");
  revalidatePath("/");
  return {};
}
