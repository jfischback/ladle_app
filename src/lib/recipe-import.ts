import "server-only";
import { z } from "zod";
import { askClaude, claudeEnabled } from "./claude";
import type Anthropic from "@anthropic-ai/sdk";

export const RecipeDraftSchema = z.object({
  name: z.string(),
  protein: z.string().describe("Main protein, e.g. Chicken, Beef, Pork, Sausage, Turkey, Fish, Vegetarian, Beans (no meat)"),
  servings: z.number().nullable(),
  totalMinutes: z.number().nullable(),
  ingredients: z.array(z.object({ amount: z.string(), unit: z.string(), item: z.string() })),
  steps: z.array(z.string()),
  tags: z.array(z.string()).describe("Any of: quick, one-pot, kid-friendly, slow-cooker, sheet-pan, grill, make-ahead"),
  prepAhead: z.string().describe("Anything to do the day before (marinate, thaw, soak), or empty string"),
  creditName: z.string().describe("Name of the creator or source, or empty string"),
});
export type RecipeDraft = z.infer<typeof RecipeDraftSchema>;

const SYSTEM = `You turn a recipe source into Ladle's structured recipe format, for the user's private recipe list.

Rules:
- Capture the ingredients (amount, unit, item) and the method as structured data.
- Write every step fresh, in short plain words of your own. Do not copy the source's wording, stories, headnotes or tips word for word.
- Do not invent ingredients or amounts that aren't in the source. Leave servings or totalMinutes null if the source doesn't say.
- "quick" tag only if the total time is 30 minutes or less.
- creditName: the person or site the recipe comes from, if shown; otherwise empty.
- If the source is not a recipe at all, return name "" and empty lists.`;

function requireClaude() {
  if (!claudeEnabled()) throw new Error("Recipe import needs the Claude API key (ANTHROPIC_API_KEY) to be set.");
}

/** Save from link: one URL, user-initiated. */
export async function draftFromUrl(url: string): Promise<RecipeDraft & { creditUrl: string }> {
  requireClaude();
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error("That doesn't look like a web link.");
  const res = await fetch(u, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LadleRecipeSaver/1.0)", Accept: "text/html" },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Couldn't open that page (${res.status}).`);
  const html = (await res.text()).slice(0, 2_000_000);
  const source = extractRecipeSource(html);
  const draft = await askClaude({
    system: SYSTEM,
    content: `Source page: ${u.toString()}\n\n${source}`,
    schema: RecipeDraftSchema,
    effort: "low",
  });
  if (!draft.name) throw new Error("We couldn't find a recipe on that page.");
  return { ...draft, creditUrl: u.toString() };
}

/** Photo import: a cookbook page, recipe card or screenshot. */
export async function draftFromPhoto(base64: string, mediaType: string): Promise<RecipeDraft> {
  requireClaude();
  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
  type Media = (typeof allowed)[number];
  if (!allowed.includes(mediaType as Media)) throw new Error("Please use a JPG, PNG, GIF or WebP photo.");
  const content: Anthropic.Beta.Messages.BetaContentBlockParam[] = [
    { type: "image", source: { type: "base64", media_type: mediaType as Media, data: base64 } },
    { type: "text", text: "Read the recipe in this photo." },
  ];
  const draft = await askClaude({ system: SYSTEM, content, schema: RecipeDraftSchema, effort: "low" });
  if (!draft.name) throw new Error("We couldn't read a recipe in that photo.");
  return draft;
}

/** Prefer the page's schema.org Recipe JSON-LD; fall back to visible text. */
function extractRecipeSource(html: string): string {
  const blocks = [...html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const found = findRecipe(JSON.parse(b[1].trim()));
      if (found) return `Structured recipe data:\n${JSON.stringify(found).slice(0, 60000)}`;
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  const text = html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  return `Page text:\n${text.slice(0, 60000)}`;
}

/** The schema.org Recipe object in a page's JSON-LD, if the page has one. */
export function recipeJsonLd(html: string): Record<string, unknown> | null {
  const blocks = [...html.matchAll(/<script[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const found = findRecipe(JSON.parse(b[1].trim()));
      if (found) return found as Record<string, unknown>;
    } catch {
      /* ignore malformed JSON-LD */
    }
  }
  return null;
}

function findRecipe(node: unknown): unknown {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findRecipe(n);
      if (f) return f;
    }
    return null;
  }
  const obj = node as Record<string, unknown>;
  const type = obj["@type"];
  if (type === "Recipe" || (Array.isArray(type) && type.includes("Recipe"))) return obj;
  if (obj["@graph"]) return findRecipe(obj["@graph"]);
  return null;
}
