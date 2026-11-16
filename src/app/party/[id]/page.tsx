import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { getDb } from "@/db";
import { parties } from "@/db/schema";
import { getSettings } from "@/lib/data";
import { ruleProblems } from "@/lib/diet";
import { COURSES, PARTY_DISHES, partyDishes, partyKind, partyTimeline } from "@/lib/party";
import { partyGroceries } from "@/lib/party-grocery";
import { niceAmount } from "@/lib/scaling";
import { niceDate } from "../dates";
import { PartyEditor } from "./PartyEditor";
import { PartyActions } from "./PartyActions";

export const metadata = { title: "Party · Ladle" };

export default async function PartyDetail({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = await getDb();
  const [party] = await db.select().from(parties).where(and(eq(parties.id, id), eq(parties.userId, userId), isNull(parties.archivedAt)));
  if (!party) notFound();
  const { data: settings } = await getSettings(userId);
  const kind = partyKind(party.kind);
  // Every dish, with anything that breaks the family's food rules (allergies, vegetarian...).
  const options = PARTY_DISHES.map((d) => ({ key: d.key, name: d.name, icon: d.icon, course: d.course, problems: ruleProblems(d, settings.foodRules, settings.dislikes, settings.allowAnyway), shortcut: d.shortcut ?? null }));
  const chosen = partyDishes(party);
  const shopping = partyGroceries(party);
  const timeline = partyTimeline(party);
  return (
    <div className="space-y-6">
      <div>
        <Link href="/party" className="font-bold text-olive-dark underline">← All parties</Link>
        <p className="eyebrow mt-3">{kind.icon} {kind.label}</p>
        <h1 className="text-3xl font-semibold">{party.title}</h1>
        <p className="text-lg text-muted">{niceDate(party.date)} · {party.guests} guests · {party.meal ? "the food is the meal" : "snacks and bites"}</p>
      </div>

      <PartyActions id={party.id} />

      <section aria-labelledby="menu-title" className="space-y-3">
        <h2 id="menu-title" className="text-2xl font-semibold">The food</h2>
        {COURSES.map((c) => {
          const dishes = chosen.filter((d) => d.course === c.key);
          if (!dishes.length) return null;
          return (
            <div key={c.key} className="space-y-2">
              <h3 className="font-bold text-muted">{c.label}</h3>
              {dishes.map((d) => (
                <details key={d.key} className="card p-4">
                  <summary className="cursor-pointer list-none">
                    <span className="flex items-center gap-3">
                      <span className="text-2xl" aria-hidden="true">{d.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{d.name}</span>
                        <span className="text-sm text-muted">{d.times === 1 ? "One batch" : `${niceAmount(d.times)} batches`} · tap for what to buy and how</span>
                      </span>
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2 text-sm">
                    <ul className="list-disc pl-5">
                      {d.scaled.map((ing, n) => <li key={n}>{[ing.amount, ing.unit, ing.item].filter(Boolean).join(" ")}</li>)}
                    </ul>
                    <ol className="list-decimal space-y-1 pl-5">{d.steps.map((s, n) => <li key={n}>{s}</li>)}</ol>
                    {d.shortcut && <p className="rounded-xl bg-oat p-2"><span className="font-bold">Short on time? </span>{d.shortcut}</p>}
                  </div>
                </details>
              ))}
            </div>
          );
        })}
      </section>

      <PartyEditor
        id={party.id}
        initial={{ kind: party.kind, title: party.title, date: party.date, guests: party.guests, meal: party.meal, dishes: party.dishes }}
        options={options}
        courses={COURSES}
      />

      <section aria-labelledby="list-title" className="card space-y-2 p-5">
        <h2 id="list-title" className="text-2xl font-semibold">🛒 Shopping list</h2>
        <ul className="divide-y divide-line">
          {shopping.items.map((it) => (
            <li key={it.item} className="flex justify-between gap-3 py-1.5">
              <span>{it.item}</span>
              <span className="shrink-0 font-semibold">{it.quantity}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="when-title" className="card space-y-2 p-5">
        <h2 id="when-title" className="text-2xl font-semibold">🗓 When to do what</h2>
        <ol className="space-y-2">
          {timeline.map((t, n) => (
            <li key={n} className="flex gap-3">
              <span className="w-28 shrink-0 font-bold">{niceDate(t.date)}</span>
              <span>{t.what}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
