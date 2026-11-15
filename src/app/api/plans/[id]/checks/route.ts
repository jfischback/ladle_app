import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { getPlan } from "@/lib/data";
import { ADDED_SECTION } from "@/lib/grocery-add";

/** The grocery list ticks for a week, so everyone's phone stays in step while shopping. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const plan = await getPlan(userId, id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // What the family added, so other phones know to reload the list.
  const added = plan.groceryList?.sections.find((s) => s.name === ADDED_SECTION)?.items.map((i) => `${i.quantity} ${i.item}`) ?? [];
  return NextResponse.json({ checked: plan.groceryChecked ?? {}, added }, { headers: { "Cache-Control": "private, no-store" } });
}
