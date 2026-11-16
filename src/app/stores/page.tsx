import Link from "next/link";
import { requireUserId } from "@/auth";
import { getSettings } from "@/lib/data";
import { krogerEnabled } from "@/lib/kroger";
import { StoresClient } from "./StoresClient";

export const metadata = { title: "Nearby stores · Ladle" };

/** Pick other Kroger-family stores nearby and see where this week's list is cheapest. */
export default async function StoresPage() {
  const userId = await requireUserId();
  const { data: s } = await getSettings(userId);
  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <p className="eyebrow mt-3">Shop around</p>
        <h1 className="text-3xl font-semibold">📍 Nearby stores</h1>
        <p className="mt-1 text-lg text-muted">
          Pick up to four more stores near you and Ladle compares this week&apos;s list across them: where each thing is cheapest, and which store wins overall.
        </p>
        <p className="mt-1 text-sm text-muted">
          Ladle can see prices at Kroger-family stores (Fry&apos;s, Smith&apos;s, King Soopers, Ralphs, Kroger and the rest). Other chains don&apos;t share their prices, so they aren&apos;t here.
        </p>
      </div>
      {krogerEnabled() ? (
        <StoresClient
          zip={s.zip}
          home={s.storeLocationId ? { locationId: s.storeLocationId, name: s.storeName } : null}
          initial={s.extraStores}
        />
      ) : (
        <p className="card p-4">Store prices aren&apos;t connected yet, so nearby stores can&apos;t be compared. Your list still works at any store.</p>
      )}
      <p><Link href="/setup?step=3" className="font-bold text-olive-dark underline">Change your own store</Link></p>
    </div>
  );
}
