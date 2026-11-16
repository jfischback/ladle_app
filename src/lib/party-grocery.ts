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

type Section = GroceryList["sections"][number];

/** Is this section this party's? By its id; lists made before sections carried an id match on the name. */
export const isSectionOf = (s: Section, partyId: string, title: string) => (s.partyId ? s.partyId === partyId : s.name === partySection(title));

/** The list without this party's section. */
export function withoutParty(list: GroceryList, partyId: string, title: string): GroceryList {
  return { ...list, sections: list.sections.filter((s) => !isSectionOf(s, partyId, title)) };
}

/**
 * The week's list with this party's section added or brought up to date (it goes first, so it's easy to find).
 * The section belongs to the party by id. Another party with the same name keeps its own section: the newcomer's
 * is numbered ("Party: Birthday (2)"), since ticks are kept by section name.
 */
export function withPartySection(list: GroceryList, section: Section, partyId?: string, title?: string): GroceryList {
  if (!partyId) {
    const kept = list.sections.filter((s) => s.name !== section.name);
    return { ...list, sections: section.items.length ? [section, ...kept] : kept };
  }
  const mine = list.sections.find((s) => isSectionOf(s, partyId, title ?? section.name.replace(/^Party: /, "")));
  const kept = list.sections.filter((s) => s !== mine);
  if (!section.items.length) return { ...list, sections: kept };
  // Keep the name it already has (so ticks stay put); otherwise the first free one.
  let name = mine && mine.name.replace(/ \(\d+\)$/, "") === section.name ? mine.name : section.name;
  for (let n = 2; kept.some((s) => s.name === name); n++) name = `${section.name} (${n})`;
  return { ...list, sections: [{ ...section, name, partyId }, ...kept] };
}
