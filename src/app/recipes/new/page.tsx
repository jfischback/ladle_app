import { claudeEnabled } from "@/lib/claude";
import { NewRecipe } from "./NewRecipe";

export default function NewRecipePage() {
  return (
    <div>
      <h1 className="mb-5 text-3xl font-bold">Add your own recipe</h1>
      <NewRecipe importEnabled={claudeEnabled()} />
    </div>
  );
}
