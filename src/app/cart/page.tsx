import Link from "next/link";
import { eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { krogerAccounts } from "@/db/schema";
import { activePlans, getPlan, getSettings } from "@/lib/data";
import { krogerEnabled } from "@/lib/kroger";
import { CartReview } from "./CartReview";
import { storeBrand, storeWord, yourStore } from "@/lib/stores";

// Matching a whole grocery list at Fry's takes a little while.
export const maxDuration = 60;

const ERRORS: Record<string, string> = {
  declined: "No problem. Your store account wasn't connected. You can try again any time.",
  expired: "That sign-in took too long. Please try again.",
  failed: "The store sign-in didn't work. Please try again in a minute.",
  "not-set-up": "Store carts aren't set up for Ladle yet.",
};

export default async function CartPage({ searchParams }: { searchParams: Promise<{ plan?: string; error?: string; connected?: string }> }) {
  const userId = await requireUserId();
  const q = await searchParams;
  const db = await getDb();
  const [{ data: settings }, plans, [account]] = await Promise.all([
    getSettings(userId),
    activePlans(userId),
    db.select({ connectedAt: krogerAccounts.connectedAt }).from(krogerAccounts).where(eq(krogerAccounts.userId, userId)),
  ]);
  const brand = storeBrand(settings.storeName);
  const plan = q.plan ? await getPlan(userId, q.plan) : plans.find((p) => p.status === "approved") ?? null;

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <p className="eyebrow mt-3">Skip the aisles</p>
        <h1 className="text-4xl font-semibold">Fill my {brand.name ?? "store"} cart</h1>
        <p className="mt-1 text-lg text-muted">Ladle finds each thing on your list at {yourStore(brand)}, sale picks first. Check it over, then send it to your cart. You still review and check out on {storeWord(brand)}&apos;s site, so nothing is bought without you.</p>
      </div>

      {q.error && <p className="card bg-ochre-soft p-4 font-semibold">{ERRORS[q.error] ?? ERRORS.failed}</p>}
      {q.connected && <p className="card bg-olive-soft p-4 font-semibold text-olive-dark">🎉 Your {brand.name ?? "store"} account is connected.</p>}

      {!krogerEnabled() ? (
        <p className="card p-5 text-lg">Store carts aren&apos;t connected to Ladle yet, so carts can&apos;t be filled.</p>
      ) : !settings.storeLocationId ? (
        <div className="card space-y-3 p-5">
          <p className="text-lg">First, pick your store so we look up the right shelf and prices.</p>
          <Link href="/setup" className="btn-primary">Pick my store</Link>
        </div>
      ) : !plan || plan.status !== "approved" || !plan.groceryList ? (
        <div className="card space-y-3 p-5">
          <p className="text-lg">Approve this week&apos;s plan first. Its grocery list is what goes in the cart.</p>
          <Link href="/" className="btn-primary">Go to this week</Link>
        </div>
      ) : (
        <CartReview
          planId={plan.id}
          store={brand.name ?? "store"}
          site={brand.site}
          connected={!!account}
          fulfillment={settings.fulfillment}
          cart={plan.cart ?? null}
          pantryQuestions={plan.groceryList.sections.find((s) => s.name === "Pantry check")?.items.length ?? 0}
        />
      )}
    </div>
  );
}
