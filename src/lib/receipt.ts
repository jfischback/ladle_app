import "server-only";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { askClaude, claudeEnabled } from "./claude";

const ReceiptSchema = z.object({
  isReceipt: z.boolean().describe("True only if this is a store receipt (or an order summary) with a total"),
  total: z.number().nullable().describe("The final amount paid, after discounts and tax, in dollars; null if it can't be read"),
  saved: z.number().nullable().describe("Total savings shown on the receipt (coupons, sale and card savings), in dollars; null if none shown"),
  store: z.string().describe("The store's name as printed, or empty"),
});
export type ReceiptRead = z.infer<typeof ReceiptSchema>;

const SYSTEM =
  "You read grocery store receipts and online order summaries. Report the final total actually paid (the TOTAL or BALANCE line after discounts, including tax), never a subtotal, the amount tendered, or change. If the photo isn't a receipt or the total can't be read clearly, say so instead of guessing.";

/** Read the total (and savings) from a photo of a grocery receipt. */
export async function readReceipt(base64: string, mediaType: string): Promise<ReceiptRead> {
  if (!claudeEnabled()) throw new Error("Reading receipts needs Ladle's AI turned on. Type the total instead.");
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type Media = (typeof allowed)[number];
  if (!allowed.includes(mediaType as Media)) throw new Error("Please use a JPG, PNG, GIF or WebP photo.");
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    { type: "image", source: { type: "base64", media_type: mediaType as Media, data: base64 } },
    { type: "text", text: "What was the total paid on this receipt?" },
  ];
  return askClaude({ system: SYSTEM, content, schema: ReceiptSchema, effort: "low" });
}

/** A total we'd trust to save: a receipt, a readable amount, and a sane size. */
export function usableTotal(r: ReceiptRead): number | null {
  if (!r.isReceipt || r.total == null || !Number.isFinite(r.total) || r.total <= 0 || r.total > 5000) return null;
  return Math.round(r.total * 100) / 100;
}
