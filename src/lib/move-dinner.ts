import type { PlanDay, PlanLunch } from "./types";
import { dayName } from "./week";

// What belongs to the dinner (and moves with it); the date, lunch, breakfast and holiday stay with the day.
const DINNER_KEYS = ["recipeId", "recipeName", "estimatedCost", "reason", "saleItems", "alternatives", "ratedAt", "fromCook", "leftoverOf", "batches"] as const;

/** Nights that can still change: not past, and not already rated as cooked. */
export const movable = (d: PlanDay, today: string) => d.date >= today && !d.ratedAt;

function swapDinner(a: PlanDay, b: PlanDay): [PlanDay, PlanDay] {
  const na = { ...a };
  const nb = { ...b };
  for (const k of DINNER_KEYS) {
    (na as Record<string, unknown>)[k] = b[k];
    (nb as Record<string, unknown>)[k] = a[k];
  }
  return [na, nb];
}

const lunchContent = (l: PlanLunch) => ({ kind: l.kind, recipeId: l.recipeId, name: l.name, reason: l.reason });

/**
 * Trade two nights' dinners in a week that's already shopped for ("soccer ran late, do Tuesday's on Thursday").
 * The groceries don't change. Leftovers nights follow their dinner and must still come after it, and a
 * next-day leftovers lunch follows its dinner when it can.
 */
export function moveDinner(days: PlanDay[], from: number, to: number, today: string): { days: PlanDay[] } | { error: string } {
  const a = days[from];
  const b = days[to];
  if (!a || !b || from === to) return { error: "Pick another night." };
  if (!movable(a, today) || !movable(b, today)) return { error: "Only tonight and the nights ahead can change." };
  if (a.recipeId === b.recipeId && !a.leftoverOf === !b.leftoverOf) return { error: "Those nights already have the same dinner." };

  const next = days.map((d) => ({ ...d }));
  [next[from], next[to]] = swapDinner(a, b);
  // A leftovers night points at the date its dinner is cooked; that dinner may have just moved.
  for (const d of next) {
    if (d.leftoverOf === a.date) d.leftoverOf = b.date;
    else if (d.leftoverOf === b.date) d.leftoverOf = a.date;
  }
  for (const d of next) {
    if (!d.leftoverOf) continue;
    const origin = next.find((x) => x.date === d.leftoverOf);
    if (!origin || d.leftoverOf >= d.date || origin.recipeId !== d.recipeId) {
      return { error: `${d.recipeName ?? "That dinner"}'s leftovers night has to come after the night it's cooked. Move the leftovers night too, or pick another night.` };
    }
  }

  // Next-day leftovers lunches: if the dinner they came from moved, trade those lunches too (the extra was bought with that dinner).
  const isStale = (i: number) => {
    const l = next[i]?.lunch;
    return !!l && l.kind === "leftovers" && i > 0 && next[i - 1].recipeId !== l.recipeId;
  };
  const la = from + 1;
  const lb = to + 1;
  if ((isStale(la) || isStale(lb)) && next[la]?.lunch && next[lb]?.lunch) {
    const ca = lunchContent(next[la].lunch!);
    const cb = lunchContent(next[lb].lunch!);
    next[la] = { ...next[la], lunch: { ...next[la].lunch!, ...cb } };
    next[lb] = { ...next[lb], lunch: { ...next[lb].lunch!, ...ca } };
  }
  // Any leftovers lunch still out of step: fine if its dinner is cooked earlier, otherwise say what to do.
  for (let i = 1; i < next.length; i++) {
    const l = next[i].lunch;
    if (!l || l.kind !== "leftovers" || next[i - 1].recipeId === l.recipeId) continue;
    const cooked = next.find((d) => d.recipeId === l.recipeId && !d.leftoverOf);
    if (cooked && cooked.date < next[i].date) {
      next[i] = { ...next[i], lunch: { ...l, reason: `From ${dayName(cooked.date)}'s dinner, cooked with extra` } };
    } else {
      next[i] = {
        ...next[i],
        lunch: { ...l, kind: "open", recipeId: null, name: "Lunch: your pick", reason: cooked ? `${l.name.replace(/^Leftover /, "")} moved to ${dayName(cooked.date)}: cook it with extra and have the leftovers the day after` : "The dinner these leftovers came from moved" },
      };
    }
  }
  return { days: next };
}

/** The nights a dinner can trade with: only the ones where the move works (leftovers still after their dinner). */
export function moveTargets(days: PlanDay[], from: number, today: string): { index: number; label: string }[] {
  if (!days[from] || !movable(days[from], today)) return [];
  return days.flatMap((o, j) =>
    j !== from && "days" in moveDinner(days, from, j, today)
      ? [{ index: j, label: `${dayName(o.date)} ${Number(o.date.slice(8))} · ${o.leftoverOf ? `${o.recipeName} leftovers` : (o.recipeName ?? "night off")}` }]
      : [],
  );
}
