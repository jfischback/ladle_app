import { NextResponse, type NextRequest } from "next/server";
import { requireUserId } from "@/auth";
import { getPlan, getSettings, recipesByIds } from "@/lib/data";
import { toIcs, weekEvents } from "@/lib/calendar";
import { prepPlan } from "@/lib/prep";

/** The week's dinners as a calendar file (.ics) for iPhone, Google or Outlook calendars. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  const plan = await getPlan(userId, id);
  if (!plan) return new NextResponse("Not found", { status: 404 });
  const { data: settings } = await getSettings(userId);
  const ids = [...new Set(plan.days.map((d) => d.recipeId).filter((x): x is string => !!x))];
  const recipes = ids.length ? await recipesByIds(userId, ids) : [];
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const prep = settings.prepDay != null ? prepPlan(plan.days, byId, settings.prepDay, settings.prepMinutes) : null;
  const events = weekEvents(plan.id, plan.days, byId, req.nextUrl.origin, { prep: prep ? { date: prep.date, minutes: prep.minutes } : null });
  return new NextResponse(toIcs(events, "Ladle dinners"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="ladle-week-of-${plan.weekOf}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
