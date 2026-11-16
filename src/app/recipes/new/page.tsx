import Link from "next/link";
import { claudeEnabled } from "@/lib/claude";
import { NewRecipe } from "./NewRecipe";

// Planning, approving and importing can take a while (the AI, store prices): give them a minute.
export const maxDuration = 60;

export default function NewRecipePage() {
  return (
    <div>
      <Link href="/recipes" className="inline-flex items-center gap-1 font-bold text-olive-dark hover:underline">← All recipes</Link>
      <h1 className="mb-5 mt-3 text-3xl font-bold">Add your own recipe</h1>
      <NewRecipe importEnabled={claudeEnabled()} />
    </div>
  );
}
