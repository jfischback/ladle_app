import Link from "next/link";
import { requireUserId } from "@/auth";
import { activePlans, getSettings } from "@/lib/data";
import { stapleTerm } from "@/lib/staples";
import { StaplesEditor } from "./StaplesEditor";

export default async function StaplesPage() {
  const userId = await requireUserId();
  const [{ data: settings }, plans] = await Promise.all([getSettings(userId), activePlans(userId)]);
  // Prices and sales from the most recent planned week, keyed by staple.
  const lines = plans.find((p) => p.staples?.length)?.staples ?? [];
  const priceInfo = Object.fromEntries(lines.map((l) => [stapleTerm(l.item), { price: l.price, sale: l.sale ? { pctOff: l.sale.pctOff, salePrice: l.sale.salePrice, regularPrice: l.sale.regularPrice } : null }]));

  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <p className="eyebrow mt-3">Bought every week</p>
        <h1 className="text-4xl font-semibold">Weekly staples</h1>
        <p className="mt-1 text-lg text-muted">
          Milk, eggs, the kids&apos; snacks: things you buy no matter what&apos;s for dinner. They&apos;re added to every grocery list, checked for sales at your Fry&apos;s, and counted in your budget.
        </p>
      </div>
      <StaplesEditor initial={settings.staples} priceInfo={priceInfo} />
    </div>
  );
}
