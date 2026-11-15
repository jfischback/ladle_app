"use server";

import { requireUserId } from "@/auth";
import { readFridge } from "@/lib/fridge";
import { TOO_MANY, under } from "@/lib/rate-limit";

/** "Snap my fridge": a photo of the fridge (or freezer, or pantry) becomes the list for "Use what I have". */
export async function fridgePhoto(form: FormData): Promise<{ items?: string[]; error?: string }> {
  const userId = await requireUserId();
  const file = form.get("photo");
  if (!(file instanceof File) || !file.size) return { error: "Take or choose a photo of your fridge." };
  // The AI takes images up to 5 MB once encoded (about a third bigger than the file).
  if (file.size > 3.7 * 1024 * 1024) return { error: "That photo is too big. Try a smaller one (under about 3.5 MB)." };
  if (!(await under("fridge", userId))) return { error: TOO_MANY };
  try {
    const items = await readFridge(Buffer.from(await file.arrayBuffer()).toString("base64"), file.type);
    if (!items.length) return { error: "We couldn't make out any food. Try a closer, brighter photo." };
    return { items };
  } catch (e) {
    const msg = (e as Error).message ?? "";
    return { error: /^(Reading photos|Please use|That doesn't look)/.test(msg) ? msg : "We couldn't read that photo just now. Try again, or type what you have." };
  }
}
