import { shortDate } from "./week";

/**
 * Home's sense of place: which week it shows, and where that week stands (plan, approve, pantry check, shop,
 * receipt) with the one next step. Kept apart from the page so the rules can be tested.
 */

type WeekPlan = { id: string; weekOf: string; status: string };

/**
 * Which plan Home shows. The week being cooked and shopped stays up front once it's approved, even after the next
 * one is planned; `asked` (from ?week=) opens a specific week, e.g. straight after planning it.
 */
export function pickWeek<P extends WeekPlan>(plans: P[], inProgress: string, upcoming: string, asked?: string): { plan: P | null; thisPlan: P | null; nextPlan: P | null; other: P | null } {
  // An approved week wins over a leftover draft for the same week.
  const forWeek = (w: string) => plans.find((p) => p.weekOf === w && p.status === "approved") ?? plans.find((p) => p.weekOf === w) ?? null;
  const thisPlan = forWeek(inProgress);
  const nextPlan = upcoming !== inProgress ? forWeek(upcoming) : null;
  const askedPlan = asked === "next" ? nextPlan ?? thisPlan : asked ? [thisPlan, nextPlan].find((p) => p?.weekOf === asked) ?? null : null;
  const plan = askedPlan ?? (thisPlan?.status === "approved" ? thisPlan : nextPlan ?? thisPlan);
  const other = plan && thisPlan && nextPlan ? (plan.id === thisPlan.id ? nextPlan : thisPlan) : null;
  return { plan, thisPlan, nextPlan, other };
}

export type StepKey = "plan" | "approve" | "pantry" | "shop" | "receipt";
export type WeekStep = { key: StepKey; label: string; done: boolean };
export type NextCard = { icon: string; title: string; text: string; cta: string; href: string; more?: { label: string; href: string } };

export type WeekState = {
  planId: string;
  weekOf: string;
  approved: boolean;
  firstDay: string; // the first day the plan covers
  today: string;
  pantryQuestions: number; // open "do you have these?" questions on the list
  listTotal: number; // things to buy
  listLeft: number; // things not ticked yet
  cartSent: boolean;
  cartReady: boolean; // store carts are connected and a store is picked
  receiptIn: boolean;
  storeName: string;
  tonight: string | null;
  /** The week after this one, when it's a different week: its start and whether it's planned. */
  next: { weekOf: string; status: "none" | "draft" | "approved" } | null;
};

/** The week's steps in order, and the card for the first one that isn't done. Hrefs starting with # are on Home. */
export function weekSteps(s: WeekState): { steps: WeekStep[]; nextStep: StepKey | "done"; card: NextCard } {
  // Shopped: everything's ticked, the receipt is in, or the week's first day has passed.
  const shopped = s.approved && ((s.listTotal > 0 && s.listLeft === 0) || s.receiptIn || s.today > s.firstDay);
  const steps: WeekStep[] = [
    { key: "plan", label: "Plan", done: true },
    { key: "approve", label: "Approve", done: s.approved },
    { key: "pantry", label: "Pantry", done: s.approved && s.pantryQuestions === 0 },
    { key: "shop", label: "Shop", done: shopped },
    { key: "receipt", label: "Receipt", done: s.approved && s.receiptIn },
  ];
  const nextStep = steps.find((x) => !x.done)?.key ?? "done";
  const things = (n: number) => `${n} thing${n === 1 ? "" : "s"}`;
  const openList = { label: "Open my list", href: "#grocery-print" };
  const planNext = s.next?.status === "none" ? { label: "Plan next week", href: "/plan" } : undefined;

  const card: NextCard =
    nextStep === "approve" ? { icon: "👀", title: "Look over the dinners", text: "Swap anything you don't like. When it looks good, tap \"Looks yummy, make my list!\" under the dinners.", cta: "See the dinners", href: "#dinners" }
    : nextStep === "pantry" ? { icon: "❓", title: "Do you already have these?", text: `${s.pantryQuestions} pantry question${s.pantryQuestions === 1 ? "" : "s"}. Answer ${s.pantryQuestions === 1 ? "it" : "them"} so your list only has what you need.`, cta: s.pantryQuestions === 1 ? "Answer it" : "Answer them", href: "#pantry-check" }
    : nextStep === "shop" ? (
        s.cartSent ? { icon: "🛒", title: `Check out at ${s.storeName}`, text: `Your cart is filled. Review it, pay and pick your time on ${s.storeName}'s site. Ladle never checks out for you.`, cta: "Review my cart", href: `/cart?plan=${s.planId}`, more: openList }
        : s.cartReady ? { icon: "🛒", title: "Time to shop", text: `${things(s.listLeft)} on your list. Send ${s.listLeft === 1 ? "it" : "them"} to your ${s.storeName} cart, or shop from the list.`, cta: `Send to my ${s.storeName} cart`, href: `/cart?plan=${s.planId}`, more: openList }
        : { icon: "🛒", title: "Time to shop", text: `${things(s.listLeft)} left on your list. Tick ${s.listLeft === 1 ? "it" : "them"} off as you go.`, cta: "Open my list", href: "#grocery-print" })
    // After shopping, the receipt is the only thing left for this week; planning the next one doesn't wait on it.
    : nextStep === "receipt" ? { icon: "🧾", title: "How did the shop go?", text: "Add the receipt total, or snap a photo of it, so Ladle can show what you spent and saved.", cta: "Add my receipt", href: `/history#week-${s.planId}`, more: planNext ?? (s.listLeft > 0 ? openList : undefined) }
    : s.next?.status === "none" ? { icon: "🗓", title: "This week is done. Plan the next one?", text: `The week of ${shortDate(s.next.weekOf)} isn't planned yet.`, cta: "Plan next week", href: "/plan" }
    : s.next?.status === "draft" ? { icon: "👀", title: "Next week is waiting for your OK", text: `Look over the dinners for the week of ${shortDate(s.next.weekOf)}.`, cta: "See next week", href: `/?week=${s.next.weekOf}` }
    : { icon: "✅", title: "This week is all set", text: s.tonight ? `Tonight: ${s.tonight}.` : "Nothing left to do. Enjoy dinner.", cta: "See the dinners", href: "#dinners" };
  return { steps, nextStep, card };
}
