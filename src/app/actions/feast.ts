"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { plans } from "@/db/schema";
import { getPlan } from "@/lib/data";
import { feastMenu, withFeast, withoutFeast } from "@/lib/feast";
import { withFeastSections } from "@/lib/feast-grocery";
import { today } from "@/lib/week";
import type { PlanDay, SaleItem } from "@/lib/types";

async function save(userId: string, planId: string, days: PlanDay[], approved: boolean, groceryList: Parameters<typeof withFeastSections>[0] | null, sales: SaleItem[]) {
  const db = await getDb();
  // After shopping is planned, the feast's groceries go on the list right away (in their own section).
  const list = approved && groceryList ? withFeastSections(groceryList, days, sales) : groceryList;
  await db.update(plans).set({ days, ...(approved ? { groceryList: list } : {}) }).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  revalidatePath("/");
}

/** Plan the holiday dinner (Thanksgiving) on its day: the guest count, the dishes, and whether the turkey is frozen. */
export async function setFeast(planId: string, dayIndex: number, input: { guests: number; dishes: string[]; frozen: boolean }): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return { error: "Plan not found." };
  const plan = await getPlan(userId, planId);
  const day = plan?.days[dayIndex];
  if (!plan || !day) return { error: "Plan not found." };
  const menu = day.holiday ? feastMenu(day.holiday) : null;
  if (!menu) return { error: "There's no holiday menu for this day." };
  if (day.date < today()) return { error: "That day has passed." };
  const guests = Math.round(Number(input.guests));
  if (!Number.isFinite(guests) || guests < 2 || guests > 40) return { error: "Choose between 2 and 40 people." };
  const dishes = menu.map((d) => d.key).filter((k) => Array.isArray(input.dishes) && input.dishes.includes(k));
  if (!dishes.length) return { error: "Pick at least one dish." };
  const days = withFeast(plan.days, dayIndex, { holiday: day.holiday!, guests, dishes, frozen: !!input.frozen, replaced: day.feast?.replaced });
  const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
  await save(userId, planId, days, plan.status === "approved", plan.groceryList, sales);
  return {};
}

/** Take the holiday dinner off: the day (and its leftovers night) become nights off. */
export async function removeFeast(planId: string, dayIndex: number): Promise<{ error?: string }> {
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/i.test(planId)) return { error: "Plan not found." };
  const plan = await getPlan(userId, planId);
  const day = plan?.days[dayIndex];
  if (!plan || !day?.feast) return {};
  const days = withoutFeast(plan.days, dayIndex);
  const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
  await save(userId, planId, days, plan.status === "approved", plan.groceryList, sales);
  return {};
}
