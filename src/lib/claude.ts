import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { AI_DAILY_LIMIT, underDailyAiCap } from "./rate-limit";

const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";

export function claudeEnabled(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

let client: Anthropic | null = null;
function getClient() {
  client ??= new Anthropic();
  return client;
}

type Content = Anthropic.Beta.Messages.BetaContentBlockParam[] | string;

/**
 * One Claude call that returns JSON validated against `schema`.
 * Server-side refusal fallbacks are on, so a declined request is retried on a fallback model.
 */
export async function askClaude<S extends z.ZodType>(opts: {
  system: string;
  content: Content;
  schema: S;
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  // Every Claude call in the app comes through here, so the daily ceiling covers all of them.
  if (!(await underDailyAiCap())) throw new Error(AI_DAILY_LIMIT);
  const response = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: opts.system,
    messages: [{ role: "user", content: opts.content }],
    output_config: { format: betaZodOutputFormat(opts.schema), effort: opts.effort ?? "medium" },
  });
  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined this request.");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude's answer was cut off. Try again.");
  }
  if (response.parsed_output == null) {
    throw new Error("Claude returned an answer we couldn't read. Try again.");
  }
  return response.parsed_output as z.infer<S>;
}
