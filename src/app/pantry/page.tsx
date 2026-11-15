import Link from "next/link";
import { requireUserId } from "@/auth";
import { myPantry } from "@/lib/data";
import { PantryEditor } from "./PantryEditor";

export default async function PantryPage() {
  const userId = await requireUserId();
  const items = await myPantry(userId);
  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <p className="eyebrow mt-3">What you have on hand</p>
        <h1 className="text-4xl font-semibold">Pantry</h1>
        <p className="mt-1 text-lg text-muted">
          Things that last: spices, sauces, rice, tortillas, butter, the freezer. Your grocery list skips what you have, and ⭐ items are only bought when they&apos;re on sale and you&apos;re running low.
        </p>
        <Link href="/recipes?f=have" className="btn-secondary mt-3">🥫 What can I make with what I have?</Link>
      </div>
      <PantryEditor items={items.map((i) => ({ id: i.id, name: i.name, place: i.place, status: i.status, onSaleOnly: i.onSaleOnly }))} />
    </div>
  );
}
