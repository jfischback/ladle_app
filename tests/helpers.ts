import type { Recipe } from "@/db/schema";
import starters from "@/data/starter-recipes.json";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/settings";

/** The starter recipes as if they were in a family's recipe box. */
export function starterBox(meal = "dinner"): Recipe[] {
  return (starters as unknown as Recipe[])
    .filter((r) => r.meal === meal)
    .map((r, i) => ({
      ...r,
      id: `${meal}-${i}`,
      ownerId: "u1",
      starterId: null,
      rating: null,
      kidVotes: null,
      trial: false,
      archivedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as Recipe);
}

export const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });
