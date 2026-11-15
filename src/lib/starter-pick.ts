import type { Ingredient } from "./types";
import type { Settings } from "./settings";
import { ruleProblems } from "./diet";
import { canCook } from "./prep";

type Starter = { id: string; name: string; meal: string; servings: number | null; tags: string[]; ingredients: Ingredient[]; steps?: string[] };

/**
 * The starter recipes that make sense for this household's first recipe box: nothing that breaks their food
 * rules or needs a kitchen they don't have, and single-serving mug meals only for someone cooking alone
 * (or with just a microwave).
 */
export function pickStarters<T extends Starter>(starters: T[], s: Pick<Settings, "adults" | "kids" | "foodRules" | "dislikes" | "allowAnyway" | "equipment">): T[] {
  const solo = s.adults + s.kids <= 1;
  const tinyKitchen = s.equipment.length > 0 && !s.equipment.includes("oven") && !s.equipment.includes("stovetop");
  return starters.filter((r) => {
    if (ruleProblems(r, s.foodRules, s.dislikes, s.allowAnyway).length) return false;
    if (!canCook(r, s.equipment)) return false;
    const singleServing = r.servings === 1 || r.tags.includes("for-one");
    if (singleServing && r.meal === "dinner" && !solo && !tinyKitchen) return false;
    return true;
  });
}
