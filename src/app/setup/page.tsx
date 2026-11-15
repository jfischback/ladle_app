import Link from "next/link";
import { actingFor, requireUserId } from "@/auth";
import { getSettings, myCooks } from "@/lib/data";
import { FeatureCards } from "@/components/FeatureCards";
import { krogerEnabled } from "@/lib/kroger";
import { claudeEnabled } from "@/lib/claude";
import { SetupWizard } from "./SetupWizard";

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const userId = await requireUserId();
  const stepParam = Number((await searchParams).step);
  const { data, complete } = await getSettings(userId);
  const creators = complete ? (await myCooks(userId)).map((c) => c.name) : [];
  return (
    <>
      {complete && (
        <div className="mb-6">
          <FeatureCards creators={creators} athletes={data.athletes.length} title="Make Ladle yours" />
        </div>
      )}
      <SetupWizard forName={(await actingFor())?.label ?? null} initial={data} isEdit={complete} krogerEnabled={krogerEnabled()} startStep={Number.isInteger(stepParam) ? stepParam : null} />
      {complete && (
        <p className="mt-6 text-center">
          <Link href="/whats-new" className="font-bold text-olive-dark underline">✨ What&apos;s new in Ladle</Link>
        </p>
      )}
      {complete && (!claudeEnabled() || !krogerEnabled()) && (
        // Behind-the-scenes status, kept off the everyday screens.
        <p className="mx-auto mt-8 max-w-xl text-center text-xs text-muted">
          {!claudeEnabled() && "Smart planning is off (no Claude API key), so plans are random picks without prices. "}
          {!krogerEnabled() && "Store prices aren't connected yet, so there are no sale prices."}
        </p>
      )}
    </>
  );
}
