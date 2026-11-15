"use client";

import { useState } from "react";
import type { Ingredient } from "@/lib/types";
import { recipeText } from "@/lib/recipe-text";
import { useServingsFactor } from "./servings-store";

/** Text or copy the recipe (at the servings picked on the page) to send to someone. */
export function ShareRecipe({ recipe }: { recipe: { id: string; name: string; servings: number | null; totalMinutes: number | null; ingredients: Ingredient[]; steps: string[]; creditName: string | null; creditUrl: string | null } }) {
  const factor = useServingsFactor(recipe.id);
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = recipeText(recipe, factor);
    try {
      if (navigator.share) await navigator.share({ title: recipe.name, text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2500); }
    } catch { /* closed the share sheet */ }
  };
  return <button type="button" className="btn-quiet min-h-10 px-3 text-sm" onClick={share}>{copied ? "✓ Copied" : "📤 Share recipe"}</button>;
}
