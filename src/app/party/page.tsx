import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { parties } from "@/db/schema";
import { partyKind } from "@/lib/party";
import { addDays, today } from "@/lib/week";
import { NewParty } from "./NewParty";
import { niceDate } from "./dates";

export const metadata = { title: "Plan a party · Ladle" };

/** Parties: birthdays, graduations, celebrations of life, holidays. Food for the crowd, a shopping list and a timeline. */
export default async function PartyPage() {
  const userId = await requireUserId();
  const db = await getDb();
  const mine = await db.select().from(parties).where(and(eq(parties.userId, userId), isNull(parties.archivedAt))).orderBy(asc(parties.date));
  const upcoming = mine.filter((p) => p.date >= today());
  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">Parties and get-togethers</p>
        <h1 className="text-3xl font-semibold">🎉 Plan a party</h1>
        <p className="mt-1 text-lg text-muted">
          Birthdays, graduations, a celebration of life, the holidays. Pick the kind of party and how many are coming, and Ladle
          suggests the food (boards, trays, bites, sweets and drinks), sizes it for the crowd, and makes the shopping list and a timeline.
        </p>
      </div>

      {upcoming.length > 0 && (
        <section aria-labelledby="upcoming-title" className="space-y-2">
          <h2 id="upcoming-title" className="text-xl font-semibold">Coming up</h2>
          <ul className="space-y-2">
            {upcoming.map((p) => (
              <li key={p.id}>
                <Link href={`/party/${p.id}`} className="card flex items-center gap-3 p-4 hover:shadow-lift">
                  <span className="text-3xl" aria-hidden="true">{partyKind(p.kind).icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{p.title}</span>
                    <span className="text-muted">{niceDate(p.date)} · {p.guests} guests</span>
                  </span>
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <NewParty defaultDate={addDays(today(), 14)} min={today()} />
    </div>
  );
}
