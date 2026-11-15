import Link from "next/link";
import { requireUserId } from "@/auth";
import { getSettings } from "@/lib/data";
import { AthletesEditor } from "./AthletesEditor";

export default async function AthletesPage() {
  const userId = await requireUserId();
  const { data: settings } = await getSettings(userId);
  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <p className="eyebrow mt-3">For the ones who train</p>
        <h1 className="text-4xl font-semibold">Athlete mode</h1>
        <p className="mt-1 text-lg text-muted">
          Lifting, running or cutting? Give each athlete a calorie and protein goal. Ladle sizes their portions, leans toward high-protein dinners,
          and adds shakes and snacks to close the gap, with more carbs on training days and before a meet.
        </p>
      </div>
      <AthletesEditor initial={settings.athletes} />
      <p className="text-sm text-muted">
        Numbers are estimates from common rules of thumb and your recipes&apos; ingredients, not medical or dietary advice. A coach or dietitian&apos;s numbers always win: just type them in.
      </p>
    </div>
  );
}
