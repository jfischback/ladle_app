import Link from "next/link";
import { requireUserId } from "@/auth";
import { activePlans, getSettings, myExtras } from "@/lib/data";
import { ExtrasEditor } from "./ExtrasEditor";
import { storeBrand, yourStore } from "@/lib/stores";
import type { ExtraCategory } from "@/lib/types";

export default async function ExtrasPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const userId = await requireUserId();
  const c = (await searchParams).c;
  const category: ExtraCategory = c === "sweets" || c === "drinks" || c === "baby" ? c : "snacks";
  const [items, { data: settings }, plans] = await Promise.all([myExtras(userId), getSettings(userId), activePlans(userId)]);
  // Sale and price info from the newest planned week.
  const lines = plans.find((p) => p.extras?.length)?.extras ?? [];
  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <p className="eyebrow mt-3">Beyond dinner</p>
        <h1 className="text-4xl font-semibold">Snacks &amp; more</h1>
        <p className="mt-1 text-lg text-muted">Snacks, sweets, drinks and baby items you buy. Give each a rule, and they&apos;re added to the week&apos;s list, checked for sales at {yourStore(storeBrand(settings.storeName))}.</p>
      </div>
      <ExtrasEditor
        category={category}
        items={items.map((i) => ({ id: i.id, category: i.category, name: i.name, mode: i.mode, qty: i.qty, saleQty: i.saleQty, anyBrand: i.anyBrand, servings: i.servings, status: i.status }))}
        rules={settings.extras}
        thisWeek={lines.map((l) => ({ category: l.category, item: l.item, quantity: l.quantity, reason: l.reason, sale: l.sale ? `${l.sale.pctOff}% off` : null }))}
      />
    </div>
  );
}
