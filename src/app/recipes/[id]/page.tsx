import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUserId } from "@/auth";
import { getRecipe } from "@/lib/data";
import { addStarter, archiveRecipe } from "@/app/actions/recipes";
import { RecipeRating } from "./RecipeRating";
import { formatMinutes } from "@/lib/format";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const userId = await requireUserId();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await getRecipe(userId, id);
  if (!r) notFound();
  const mine = r.ownerId === userId;

  return (
    <article className="space-y-6">
      <div>
        <Link href={mine ? "/recipes" : "/recipes?tab=browse"} className="text-olive-dark underline">← Recipes</Link>
        <h1 className="mt-2 text-3xl font-bold leading-tight">{r.name}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {r.protein && <span className="tag">{r.protein}</span>}
          {r.totalMinutes && <span className="tag">{formatMinutes(r.totalMinutes)}</span>}
          {r.servings && <span className="tag">Serves {r.servings}</span>}
          {r.ease && <span className="tag">Ease {r.ease}/5</span>}
          {r.tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
        {r.creditName && (
          <p className="mt-3 text-muted">
            {r.creditUrl ? <a href={r.creditUrl} target="_blank" rel="noopener noreferrer" className="underline">{r.creditName}</a> : r.creditName}
          </p>
        )}
      </div>

      {mine ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
          <RecipeRating id={r.id} rating={r.rating} />
          <div className="flex gap-2">
            <Link href={`/recipes/${r.id}/edit`} className="btn-secondary">Edit</Link>
            <form action={archiveRecipe.bind(null, r.id)}>
              <button className="btn-quiet">Remove from my list</button>
            </form>
          </div>
        </div>
      ) : (
        <form action={addStarter.bind(null, r.id)}>
          <button className="btn-primary">Add to My Recipes</button>
        </form>
      )}

      {r.prepAhead && (
        <p className="rounded-2xl bg-ochre-soft p-4"><span className="font-bold">Day before:</span> {r.prepAhead}</p>
      )}

      <section>
        <h2 className="mb-3 text-xl font-bold">Ingredients</h2>
        {r.ingredients.length ? (
          <ul className="card divide-y divide-line">
            {r.ingredients.map((i, n) => (
              <li key={n} className="flex gap-3 px-4 py-2">
                <span className="w-28 shrink-0 font-semibold">{[i.amount, i.unit].filter(Boolean).join(" ")}</span>
                <span>{i.item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No ingredients yet.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Steps</h2>
        {r.steps.length ? (
          <ol className="space-y-3">
            {r.steps.map((s, n) => (
              <li key={n} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-olive font-bold text-cream">{n + 1}</span>
                <p className="pt-0.5 text-lg leading-relaxed">{s}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-muted">No steps yet.</p>
        )}
      </section>
    </article>
  );
}
