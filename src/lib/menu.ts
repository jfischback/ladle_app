import type { PlanDay } from "./types";
import { feastIcon, feastLabel } from "./feast";

/** What's for dinner on a day, in a few words, for the printed fridge menu. */
export function dinnerLabel(d: PlanDay): string {
  if (d.feast) return `${feastIcon(d.feast.holiday)} ${feastLabel(d.feast.holiday)} dinner`;
  if (d.leftoverOf) return `♻️ ${d.recipeName && !/leftovers$/i.test(d.recipeName) ? `Leftover ${d.recipeName}` : (d.recipeName ?? "Leftovers")}`;
  return d.recipeName ?? "🍕 Night off";
}
