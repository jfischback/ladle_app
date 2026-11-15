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
        <p className="eyebrow mt-3">Fitness, weight and health</p>
        <h1 className="text-4xl font-semibold">💪 Athlete mode &amp; health goals</h1>
        <p className="mt-1 text-lg text-muted">
          Training, losing weight, managing blood sugar or blood pressure, or eating for two? Add the people with a goal. Ladle sizes their portions,
          nudges the family&apos;s dinners toward what they need, adds the right snacks, and gives simple tips like &ldquo;have half the rice tonight.&rdquo;
        </p>
      </div>
      <AthletesEditor initial={settings.athletes} />
      <p className="text-sm text-muted">
        Numbers are estimates from common rules of thumb and your recipes&apos; ingredients, not medical or dietary advice. Your doctor, dietitian or coach&apos;s numbers always win: just type them in.
      </p>
    </div>
  );
}
