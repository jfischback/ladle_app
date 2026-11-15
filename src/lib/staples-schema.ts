import { z } from "zod";

/** Server-side check for a saved staples list (kept apart so the staples page doesn't ship zod). */
export const StaplesSchema = z
  .array(z.object({ item: z.string().trim().min(2).max(60), quantity: z.string().trim().max(30), active: z.boolean() }))
  .max(60);
