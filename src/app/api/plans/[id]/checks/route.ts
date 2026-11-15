import { NextResponse } from "next/server";
import { requireUserId } from "@/auth";
import { getPlan } from "@/lib/data";

/** The grocery list ticks for a week, so everyone's phone stays in step while shopping. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const plan = await getPlan(userId, id);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ checked: plan.groceryChecked ?? {} }, { headers: { "Cache-Control": "private, no-store" } });
}
