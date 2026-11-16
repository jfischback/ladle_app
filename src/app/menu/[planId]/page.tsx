import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { getPlan } from "@/lib/data";
import { dinnerLabel } from "@/lib/menu";
import { dayName, shortDate } from "@/lib/week";
import { PrintButton } from "./PrintButton";

/** The week's menu on one page, to print and put on the fridge. */
export default async function MenuPage({ params }: { params: Promise<{ planId: string }> }) {
  const userId = await requireUserId();
  const { planId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(planId)) notFound();
  const plan = await getPlan(userId, planId);
  if (!plan) notFound();
  const lunches = plan.days.some((d) => d.lunch);
  const breakfasts = plan.days.some((d) => d.breakfast);
  return (
    <article className="space-y-5">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <PrintButton />
      </div>
      <div className="card p-5 print:shadow-none">
        <p className="eyebrow">Week of {shortDate(plan.weekOf)}</p>
        <h1 className="mb-4 text-4xl font-semibold">What&apos;s for dinner</h1>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-line text-sm text-muted">
              <th className="py-2 pr-3">Day</th>
              {breakfasts && <th className="py-2 pr-3">Breakfast</th>}
              {lunches && <th className="py-2 pr-3">Lunch</th>}
              <th className="py-2">Dinner</th>
            </tr>
          </thead>
          <tbody>
            {plan.days.map((d) => (
              <tr key={d.date} className="border-b border-line align-top">
                <td className="py-3 pr-3 font-bold text-terracotta-dark">{dayName(d.date)}<br /><span className="text-sm font-normal text-muted">{shortDate(d.date)}</span>{d.holiday && <><br /><span className="text-sm font-normal">{d.holiday}</span></>}</td>
                {breakfasts && <td className="py-3 pr-3">{d.breakfast?.name ?? ""}</td>}
                {lunches && <td className="py-3 pr-3">{d.lunch ? d.lunch.name.replace(/^Lunch: your pick$/, "Your pick") : ""}</td>}
                <td className="py-3 text-lg font-semibold">{dinnerLabel(d)}{d.dessert && <span className="block text-sm font-normal">🍰 {d.dessert.name}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-sm text-muted">Planned with Ladle</p>
      </div>
    </article>
  );
}
