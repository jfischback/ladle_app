import { requireUserId } from "@/auth";
import { getSettings } from "@/lib/data";
import { krogerEnabled } from "@/lib/kroger";
import { SetupWizard } from "./SetupWizard";

export default async function SetupPage() {
  const userId = await requireUserId();
  const { data, complete } = await getSettings(userId);
  return <SetupWizard initial={data} isEdit={complete} krogerEnabled={krogerEnabled()} />;
}
