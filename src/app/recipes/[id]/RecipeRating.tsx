"use client";

import { useOptimistic, useTransition } from "react";
import { rateRecipe } from "@/app/actions/recipes";
import { StarPicker } from "@/components/Stars";

export function RecipeRating({ id, rating }: { id: string; rating: number | null }) {
  const [value, setValue] = useOptimistic(rating);
  const [, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <span className="font-semibold">Your rating</span>
      <StarPicker
        value={value}
        onPick={(n) =>
          start(async () => {
            setValue(n);
            await rateRecipe(id, n);
          })
        }
      />
    </div>
  );
}
