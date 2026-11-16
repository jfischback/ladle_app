import "server-only";
import type { Recipe } from "@/db/schema";
import type { GroceryList, SaleItem } from "./types";
import { basicGroceryList } from "./grocery";
import { addQuantities } from "./grocery-merge";
import { sameVolume, wholePackages } from "./feast-grocery";
import { partyDishes, type PartyPlan } from "./party";

// The section keeps its name when the guest count changes, so ticks made while shopping stay put.
export const partySection = (title: string) => `Party: ${title}`;
export const isPartySection = (name: string) => /^Party: /.test(name);

/** The party's groceries as one section, things to buy merged, with this week's sale prices where we found them. */
export function partyGroceries(p: Pick<PartyPlan, "title" | "guests" | "meal" | "dishes">, sales: SaleItem[] = []): GroceryList["sections"][number] {
  const pseudo = partyDishes(p).map((d) => ({ id: `party-${d.key}`, name: d.name, ingredients: d.scaled }) as unknown as Recipe);
  const list = basicGroceryList(pseudo, sales);
  const byThing = new Map<string, GroceryList["sections"][number]["items"][number] & { parts: string[] }>();
  for (const it of list.sections.flatMap((s) => s.items)) {
    const thing = it.item.split(",")[0].trim();
    const key = thing.toLowerCase();
    const had = byThing.get(key);
    if (had) {
      had.parts.push(it.quantity);
      had.forRecipes = [...new Set([...had.forRecipes, ...it.forRecipes])];
      had.note = had.note || it.note;
    } else byThing.set(key, { ...it, item: thing, parts: [it.quantity] });
  }
  const items = [...byThing.values()].map(({ parts, ...it }) => {
    const each = parts.filter(Boolean).flatMap((x) => x.split(/\s*\+\s*/));
    return { ...it, quantity: wholePackages(each.length > 1 ? addQuantities(sameVolume(each)) : (parts[0] ?? "")) };
  });
  return { name: partySection(p.title), items };
}

/** The week's list with this party's section added or brought up to date (it goes first, so it's easy to find). */
export function withPartySection(list: GroceryList, section: GroceryList["sections"][number]): GroceryList {
  const kept = list.sections.filter((s) => s.name !== section.name);
  return { ...list, sections: section.items.length ? [section, ...kept] : kept };
}
