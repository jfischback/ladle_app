import type { Ingredient } from "./types";
import { scaleIngredient } from "./scaling";

type Shareable = { name: string; servings: number | null; totalMinutes: number | null; ingredients: Ingredient[]; steps: string[]; creditName?: string | null; creditUrl?: string | null };

/** A recipe as plain text, for texting it to Grandma or pasting it in notes (at the servings picked on the page). */
export function recipeText(r: Shareable, factor = 1): string {
  const serves = r.servings ? Math.round(r.servings * factor * 10) / 10 : null;
  const head = [r.name, [serves ? `Serves ${serves}` : "", r.totalMinutes ? `${r.totalMinutes} min` : ""].filter(Boolean).join(" · ")].filter(Boolean);
  const ingredients = r.ingredients.map((raw) => {
    const i = scaleIngredient(raw, factor);
    return `• ${[i.amount, i.unit, i.item].filter((x) => x && String(x).trim()).join(" ")}`;
  });
  const steps = r.steps.map((s, n) => `${n + 1}. ${s}`);
  const credit = r.creditUrl ? `From ${r.creditName ?? "the original"}: ${r.creditUrl}` : r.creditName ? `From ${r.creditName}` : "";
  return [
    ...head,
    ...(ingredients.length ? ["", "Ingredients", ...ingredients] : []),
    ...(steps.length ? ["", "Steps", ...steps] : []),
    ...(credit ? ["", credit] : []),
    "",
    "Planned with Ladle",
  ].join("\n");
}
