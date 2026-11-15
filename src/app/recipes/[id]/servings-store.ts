"use client";

import { useSyncExternalStore } from "react";

// The servings someone picked on a recipe page, shared by the ingredient list and cooking mode (per recipe).
const factors = new Map<string, number>();
const listeners = new Set<() => void>();

export function setServingsFactor(recipeId: string, factor: number) {
  factors.set(recipeId, factor);
  listeners.forEach((l) => l());
}

export function useServingsFactor(recipeId: string): number {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => factors.get(recipeId) ?? 1,
    () => 1,
  );
}
