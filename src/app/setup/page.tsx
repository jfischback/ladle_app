import Link from "next/link";
import { requireUserId } from "@/auth";
import { getSettings } from "@/lib/data";
import { krogerEnabled } from "@/lib/kroger";
import { claudeEnabled } from "@/lib/claude";
import { SetupWizard } from "./SetupWizard";

export default async function SetupPage() {
  const userId = await requireUserId();
  const { data, complete } = await getSettings(userId);
  return (
    <>
      <SetupWizard initial={data} isEdit={complete} krogerEnabled={krogerEnabled()} />
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
