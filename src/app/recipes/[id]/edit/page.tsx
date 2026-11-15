import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { getRecipe } from "@/lib/data";
import { RecipeForm } from "@/components/RecipeForm";

export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getRecipe(userId, id);
  if (!r || r.ownerId !== userId) notFound();
  return (
    <div>
      <h1 className="mb-5 text-3xl font-bold">Edit recipe</h1>
      <RecipeForm id={r.id} initial={r} />
    </div>
  );
}
