import type { PlanDay, SaleItem } from "./types";
import { addDays, dayName, upcomingWeekStart, weekday } from "./week";
import { partyTimeline } from "./party";
import { saleEnds } from "./sale-dates";

/** How much Ladle tells a family: nothing, just what needs them, or everything helpful. */
export const NOTIFY_LEVELS = [
  { key: "off", label: "Off", blurb: "No alerts. Everything's still on Home when you look." },
  { key: "essentials", label: "Just the essentials", blurb: "Time to plan, a week waiting for your OK, shopping day, and party to-dos." },
  { key: "everything", label: "Everything", blurb: "The essentials, plus tonight's dinner, what to prep the night before, and sales ending soon." },
] as const;
export type NotifyLevel = (typeof NOTIFY_LEVELS)[number]["key"];

export type Alert = { key: string; level: "essential" | "extra"; icon: string; title: string; text: string; href: string };

type PlanLike = { id: string; weekOf: string; status: string; days: PlanDay[]; saleItems: (string | SaleItem)[]; groceryList?: unknown; cart?: { sentAt?: string | null } | null };
type PartyLike = { id: string; title: string; date: string; guests: number; meal: boolean; dishes: string[] };
type RecipeLike = { id: string; name: string; prepAhead: string | null; totalMinutes: number | null };

/**
 * What's worth telling the family today. Each alert has a stable key, so once they dismiss it, it stays gone
 * (and a phone gets it once). Essentials need them; extras are just helpful.
 */
export function alertsFor(input: {
  today: string;
  shoppingDay: number;
  level: NotifyLevel;
  plans: PlanLike[];
  parties?: PartyLike[];
  recipes?: Map<string, RecipeLike>;
  dismissed?: string[];
}): Alert[] {
  const { today, shoppingDay, level, plans } = input;
  if (level === "off") return [];
  const out: Alert[] = [];
  const upcoming = upcomingWeekStart(shoppingDay, addDays(today, 1)); // the next shopping day after today
  const daysToShop = Math.round((Date.parse(upcoming) - Date.parse(today)) / 86400000);
  const forUpcoming = plans.filter((p) => p.weekOf === upcoming);
  const covering = plans.filter((p) => p.days.some((d) => d.date === today));
  const live = covering.find((p) => p.status === "approved") ?? covering[0];

  // Essentials
  if (!forUpcoming.length && daysToShop <= 2) {
    out.push({ key: `plan:${upcoming}`, level: "essential", icon: "🗓", title: "Time to plan next week", text: `Shopping day is ${daysToShop === 1 ? "tomorrow" : dayName(upcoming)}. A quick check-in and Ladle plans it.`, href: "/plan" });
  }
  const draft = plans.find((p) => p.status === "draft" && p.weekOf >= addDays(today, -6));
  if (draft) out.push({ key: `approve:${draft.weekOf}`, level: "essential", icon: "👍", title: "Your week is ready for your OK", text: "Look over the dinners, swap any you don't like, and approve to get the grocery list.", href: `/?week=${draft.weekOf}#dinners` });
  if (weekday(today) === shoppingDay && live?.status === "approved" && !live.cart?.sentAt) {
    out.push({ key: `shop:${today}`, level: "essential", icon: "🛒", title: "It's shopping day", text: "Your grocery list is ready. Send it to your store cart, or shop from the list.", href: `/?week=${live.weekOf}#grocery-print` });
  }
  for (const party of input.parties ?? []) {
    partyTimeline(party).forEach((t, n) => {
      if (t.date !== today && t.date !== addDays(today, 1)) return;
      out.push({ key: `party:${party.id}:${t.date}:${n}`, level: "essential", icon: "🎉", title: `${party.title}: ${t.date === today ? "today" : "tomorrow"}`, text: t.what, href: `/party/${party.id}` });
    });
  }

  if (level === "everything" && live) {
    const tonight = live.days.find((d) => d.date === today);
    if (tonight?.recipeName && !tonight.leftoverOf && tonight.recipeId) {
      const r = input.recipes?.get(tonight.recipeId);
      out.push({ key: `tonight:${today}`, level: "extra", icon: "🍲", title: `Tonight: ${tonight.recipeName}`, text: r?.totalMinutes ? `About ${r.totalMinutes} minutes.${tonight.dessert ? ` Dessert: ${tonight.dessert.name}.` : ""}` : tonight.dessert ? `Dessert: ${tonight.dessert.name}.` : "Tap for the recipe.", href: `/recipes/${tonight.recipeId}?cook=1` });
    }
    const tomorrow = plans.flatMap((p) => (p.status === "approved" ? p.days : [])).find((d) => d.date === addDays(today, 1));
    const ahead = tomorrow?.recipeId && !tomorrow.leftoverOf ? input.recipes?.get(tomorrow.recipeId) : null;
    if (ahead?.prepAhead) out.push({ key: `prep:${today}`, level: "extra", icon: "⏰", title: `Tonight, for tomorrow's ${ahead.name}`, text: ahead.prepAhead, href: `/recipes/${ahead.id}` });
    const ending = live.saleItems.filter((s): s is SaleItem => typeof s === "object" && (s.endsOn === today || s.endsOn === addDays(today, 1)));
    if (ending.length && !live.cart?.sentAt) {
      out.push({ key: `sale:${today}`, level: "extra", icon: "🏷️", title: "Sales ending soon", text: ending.slice(0, 3).map((s) => `${s.item} $${s.salePrice.toFixed(2)} (${saleEnds(s.endsOn)})`).join(", "), href: `/?week=${live.weekOf}#grocery-print` });
    }
  }
  const gone = new Set(input.dismissed ?? []);
  return out.filter((a) => !gone.has(a.key));
}
