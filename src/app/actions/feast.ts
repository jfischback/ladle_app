"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { feastHolidayOn, feastMenu, withFeast, withoutFeast } from "@/lib/feast";
import { withFeastSections } from "@/lib/feast-grocery";
import { updatePlanLocked } from "@/lib/plan-list";
import { today } from "@/lib/week";
import type { PlanDay, SaleItem } from "@/lib/types";

const total = (days: PlanDay[]) => Math.round(days.reduce((a, d) => a + (d.recipeId && !d.leftoverOf ? d.estimatedCost ?? 0 : 0), 0) * 100) / 100;

function okIds(planId: unknown, dayIndex: unknown): string | null {
  if (typeof planId !== "string" || !/^[0-9a-f-]{36}$/i.test(planId)) return "Plan not found.";
  if (!Number.isInteger(dayIndex) || (dayIndex as number) < 0 || (dayIndex as number) > 13) return "Day not found.";
  return null;
}

/** Plan the holiday dinner (Thanksgiving) on its day: the guest count, the dishes, and whether the turkey is frozen. */
export async function setFeast(planId: string, dayIndex: number, input: { guests: number; dishes: string[]; frozen: boolean }): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const bad = okIds(planId, dayIndex);
  if (bad) return { error: bad };
  const guests = Math.round(Number(input?.guests));
  if (!Number.isFinite(guests) || guests < 2 || guests > 40) return { error: "Choose between 2 and 40 people." };
  const r = await updatePlanLocked(userId, planId, (plan) => {
    const day = plan.days[dayIndex];
    if (!day) return { error: "Day not found." };
    const holiday = feastHolidayOn(day.date, day.holiday);
    const menu = holiday ? feastMenu(holiday) : null;
    if (!menu) return { error: "There's no holiday menu for this day." };
    if (day.date < today()) return { error: "That day has passed." };
    const dishes = menu.map((d) => d.key).filter((k) => Array.isArray(input.dishes) && input.dishes.includes(k));
    if (!dishes.length) return { error: "Pick at least one dish." };
    const days = withFeast(plan.days, dayIndex, { holiday: holiday!, guests, dishes, frozen: !!input.frozen, replaced: day.feast?.replaced, replacedId: day.feast?.replacedId });
    const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
    // After approval the feast's groceries go on the list right away (in their own section).
    return { days, estimatedTotal: total(days), ...(plan.status === "approved" && plan.groceryList ? { groceryList: withFeastSections(plan.groceryList, days, sales) } : {}) };
  });
  if (!r.error) revalidatePath("/");
  return r;
}

/** Take the holiday dinner off: the dinner it replaced comes back (or a night off), its leftovers night becomes a night off. */
export async function removeFeast(planId: string, dayIndex: number): Promise<{ error?: string }> {
  const userId = await requireUserId();
  const bad = okIds(planId, dayIndex);
  if (bad) return { error: bad };
  const r = await updatePlanLocked(userId, planId, (plan) => {
    const day = plan.days[dayIndex];
    if (!day?.feast) return { error: "There's no holiday dinner on that day." };
    if (day.date < today()) return { error: "That day has passed." };
    const days = withoutFeast(plan.days, dayIndex);
    const sales = plan.saleItems.filter((x): x is SaleItem => typeof x !== "string");
    return { days, estimatedTotal: total(days), ...(plan.status === "approved" && plan.groceryList ? { groceryList: withFeastSections(plan.groceryList, days, sales) } : {}) };
  });
  if (!r.error) revalidatePath("/");
  return r;
}
