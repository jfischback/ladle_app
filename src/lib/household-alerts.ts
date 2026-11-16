import "server-only";
import { and, eq, gte, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { parties } from "@/db/schema";
import { activePlans, recipesByIds } from "./data";
import { alertsFor, type Alert } from "./alerts";
import type { Settings } from "./settings";
import { today } from "./week";

/** Today's alerts for a household, at their chosen level, minus the ones they closed. */
export async function householdAlerts(userId: string, settings: Settings): Promise<Alert[]> {
  if (settings.notifyLevel === "off") return [];
  const now = today();
  const db = await getDb();
  const [plans, myParties] = await Promise.all([
    activePlans(userId),
    db.select().from(parties).where(and(eq(parties.userId, userId), isNull(parties.archivedAt), gte(parties.date, now))),
  ]);
  const ids = [...new Set(plans.flatMap((p) => p.days.map((d) => d.recipeId)).filter((x): x is string => !!x))];
  const recipes = new Map((await recipesByIds(userId, ids)).map((r) => [r.id, r]));
  return alertsFor({ today: now, shoppingDay: settings.shoppingDay, level: settings.notifyLevel, plans, parties: myParties, recipes, dismissed: settings.dismissedAlerts });
}
