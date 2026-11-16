import Link from "next/link";
import { auth, loginRequired, requireUserId } from "@/auth";
import { getSettings } from "@/lib/data";
import { Wordmark } from "@/components/Logo";

export const metadata = { title: "How Ladle works", description: "Ladle plans your family's dinners around what's on sale, builds the grocery list, and fills your Fry's cart." };

// The loop Ladle runs every week, in order.
const STEPS = [
  { icon: "👨‍👩‍👧", title: "Tell us about your family", text: "Who's eating, food rules and allergies, your budget and your Fry's store. About two minutes." },
  { icon: "🏷️", title: "Ladle plans the week around sales", text: "It checks this week's prices and picks dinners your family likes that use what's on sale and what's in your pantry." },
  { icon: "👍", title: "You approve or swap", text: "Don't like a night? Swap it, move it, or mark it as a night off. Nothing happens until you say so." },
  { icon: "📝", title: "One grocery list for the whole family", text: "Merged, sorted by aisle, shared on everyone's phone, with your usual extras like snacks and pet food." },
  { icon: "🛒", title: "Straight into your Fry's cart", text: "Ladle fills your cart with the best-value products. You check out yourself, for pickup or delivery." },
  { icon: "💵", title: "See what you saved", text: "Sales, your budget and receipts add up week by week, so you know it's working." },
];

const MORE = [
  { icon: "✨", title: "Your favorite food creators", text: "Their newest dinners land in your week." },
  { icon: "💪", title: "Athlete mode", text: "Portions and protein for whoever's training." },
  { icon: "💰", title: "Cost Cutting mode", text: "Every dollar counts, and it shows the savings." },
  { icon: "🎉", title: "Parties and holidays", text: "Birthdays, graduations, Thanksgiving: sized for the crowd." },
  { icon: "📷", title: "Use what you have", text: "Snap the fridge and get dinners that use it up." },
  { icon: "🤝", title: "Plan for a parent", text: "Run Mom's week from your phone too." },
];

/** What Ladle does, before anyone signs up, so it isn't mistaken for just another recipe app. */
export default async function WelcomePage() {
  const signedIn = loginRequired ? !!(await auth())?.user : true;
  // Someone who's already set up (they opened this from Settings) goes back to their week, not through setup again.
  const setUp = signedIn ? await requireUserId().then(getSettings).then((x) => x.complete).catch(() => false) : false;
  const start = setUp ? { href: "/", label: "Back to my week" } : signedIn ? { href: "/setup", label: "Set up my family" } : { href: "/signup", label: "Create my free account" };
  return (
    <div className="space-y-10">
      {!signedIn && (
        <div className="flex items-center justify-between">
          <Wordmark className="h-10 w-auto" />
          <Link href="/login" className="btn-quiet min-h-10 px-4">Sign in</Link>
        </div>
      )}

      <section className="space-y-3 text-center">
        <p className="eyebrow">Not just another recipe app</p>
        <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">Dinner planned, list made, cart filled.</h1>
        <p className="mx-auto max-w-xl text-lg text-muted">
          Ladle plans your family&apos;s week around what&apos;s on sale at Fry&apos;s, builds one grocery list, and puts it in your cart. You just approve it.
        </p>
        <Link href={start.href} className="btn-primary inline-flex">{start.label} →</Link>
      </section>

      <section aria-labelledby="how-title" className="space-y-4">
        <h2 id="how-title" className="text-center text-2xl font-semibold">How a week with Ladle works</h2>
        <ol className="relative mx-auto max-w-xl space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex gap-3">
              <div className="flex flex-col items-center">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-olive text-lg font-bold text-cream" aria-hidden="true">{i + 1}</span>
                {i < STEPS.length - 1 && <span className="mt-1 w-0.5 flex-1 bg-olive/30" aria-hidden="true" />}
              </div>
              <div className="card mb-1 flex-1 p-4">
                <p className="font-bold"><span aria-hidden="true">{s.icon} </span>{s.title}</p>
                <p className="text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="text-center text-sm text-muted">Then it does it again next week, learning what your family loves.</p>
      </section>

      <section aria-labelledby="more-title" className="space-y-4">
        <h2 id="more-title" className="text-center text-2xl font-semibold">And it fits your family</h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {MORE.map((m) => (
            <li key={m.title} className="card flex items-start gap-3 p-4">
              <span className="text-2xl" aria-hidden="true">{m.icon}</span>
              <span>
                <span className="block font-bold">{m.title}</span>
                <span className="text-muted">{m.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-olive p-6 text-center text-cream">
        <p className="text-2xl font-semibold">{setUp ? "That's the whole loop" : "Ready for an easier week?"}</p>
        <p className="mt-1">{setUp ? "Your week is waiting." : "Free to try. You always check out yourself."}</p>
        <Link href={start.href} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-cream px-5 font-bold text-olive-dark hover:bg-oat">{start.label} →</Link>
      </section>
    </div>
  );
}
