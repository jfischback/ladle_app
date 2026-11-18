import Link from "next/link";
import { requireUserId } from "@/auth";
import { getSettings } from "@/lib/data";
import { HealthEditor } from "./HealthEditor";

export const metadata = { title: "Health needs · Ladle" };

export default async function HealthPage() {
  const userId = await requireUserId();
  const { data: settings } = await getSettings(userId);
  return (
    <div className="space-y-5">
      <div>
        <Link href="/" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← This week</Link>
        <h1 className="mt-3 text-4xl font-semibold">🩺 Health needs</h1>
        <p className="mt-1 text-lg text-muted">
          Anyone with diabetes, watching their salt, or eating low-carb? Add them here. Ladle steers the family&apos;s dinners around it and
          gives simple tips like &ldquo;have half the rice tonight.&rdquo; Portions stay the same.
        </p>
      </div>
      <HealthEditor initial={settings.healthPeople} />
      <p className="text-sm text-muted">
        Numbers are estimates from your recipes&apos; ingredients, not medical advice. Your doctor or dietitian&apos;s numbers always win: just type them in.
        Training or eating for two? Use <Link href="/athletes" className="font-bold underline">athlete mode</Link> instead.
      </p>
    </div>
  );
}
