import { activePlans, cookShelf, getSettings, myCooks } from "@/lib/data";
import { SUGGESTED_COOKS } from "@/lib/cooks";
import { recipeSales } from "@/lib/sales";
import { ruleProblems } from "@/lib/diet";
import { formatMinutes } from "@/lib/format";
import type { SaleItem } from "@/lib/types";
import { FoodArt } from "@/components/FoodArt";
import { CheckButton, FollowForm, ShelfActions, SuggestedCooks, UnfollowButton } from "./CooksClient";

function ago(d: Date | null): string {
  if (!d) return "not yet";
  const h = Math.round((Date.now() - d.getTime()) / 3600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const days = Math.round(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export async function CooksTab({ userId }: { userId: string }) {
  const [following, allShelf, plans, { data: settings }] = await Promise.all([myCooks(userId), cookShelf(userId, 150), activePlans(userId), getSettings(userId)]);
  // Recipes that break the household's food rules never show up.
  const fits = allShelf.filter(({ found }) => !ruleProblems(found, settings.foodRules, settings.dislikes, settings.allowAnyway).length);
  const hidden = allShelf.length - fits.length;
  const shelf = fits.slice(0, 60);
  // Sales from the newest plan, so the shelf can show what's on sale right now.
  const sales = (plans[0]?.saleItems ?? []).filter((x): x is SaleItem => typeof x !== "string");
  const followedFeeds = new Set(following.map((c) => c.feedUrl));
  const suggestions = SUGGESTED_COOKS.filter((c) => !followedFeeds.has(c.feedUrl)).map((c) => c.name);
  const lastChecked = following.reduce<Date | null>((a, c) => (c.lastCheckedAt && (!a || c.lastCheckedAt > a) ? c.lastCheckedAt : a), null);

  return (
    <div className="space-y-6">
      <section className="card space-y-4 p-5" aria-labelledby="cooks-title">
        <div>
          <h2 id="cooks-title" className="text-2xl font-semibold">Your favorite food creators</h2>
          <p className="text-muted">
            We check their websites for new dinners. {settings.newRecipesPerWeek > 0
              ? `Each week the planner can try ${settings.newRecipesPerWeek === 1 ? "one new recipe" : `${settings.newRecipesPerWeek} new recipes`}, especially when the ingredients are on sale.`
              : "New recipes are off in Settings, so the planner sticks to your saved recipes."}
          </p>
        </div>

        {following.length > 0 && (
          <details open={following.length <= 4} className="group">
          <summary className="cursor-pointer list-none font-bold text-olive-dark [&::-webkit-details-marker]:hidden">
            Following {following.length} cook{following.length === 1 ? "" : "s"} <span className="text-sm group-open:hidden">▸ show</span><span className="hidden text-sm group-open:inline">▾</span>
          </summary>
          <ul className="mt-2 flex flex-wrap gap-2">
            {following.map((c) => (
              <li key={c.id} className="flex items-center gap-1 rounded-full bg-olive-soft py-1 pl-3 pr-1 font-semibold text-olive-dark">
                <a href={c.siteUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">{c.name}</a>
                {c.lastError && <span className="text-xs font-bold text-terracotta-dark" title={c.lastError}>⚠︎</span>}
                <UnfollowButton id={c.id} name={c.name} />
              </li>
            ))}
          </ul>
          </details>
        )}
        {following.some((c) => c.lastError) && (
          <p className="text-sm text-terracotta-dark">⚠︎ We couldn&apos;t read {following.filter((c) => c.lastError).map((c) => c.name).join(", ")} last time. We&apos;ll try again.</p>
        )}

        <FollowForm />

        {following.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4">
            <p className="text-sm text-muted">Last checked {ago(lastChecked)}</p>
            <CheckButton />
          </div>
        )}
      </section>

      {/* Always rendered so its "Found N dinners" note survives the refresh after "Follow all". */}
      <SuggestedCooks names={suggestions} first={following.length === 0} />

      {following.length > 0 && (
        <section aria-labelledby="shelf-title">
          <h2 id="shelf-title" className="mb-1 text-2xl font-semibold">New from your food creators</h2>
          <p className="mb-4 text-muted">
            Save the ones that look good, or let the planner surprise you.
            {hidden > 0 && <> We hid {hidden} that don&apos;t fit your food rules.</>}
          </p>
          {shelf.length === 0 ? (
            <div className="card flex flex-col items-center gap-3 p-8 text-center">
              <FoodArt kind="soup" className="h-20 w-20" rounded="rounded-full" />
              <p className="text-lg text-muted">No new dinners yet. Tap &quot;Check for new recipes&quot;, or come back in a day or two.</p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {shelf.map(({ found: f, cookName }) => {
                const onSale = recipeSales(f, sales);
                return (
                  <li key={f.id} className="card flex flex-col overflow-hidden">
                    <a href={f.url} target="_blank" rel="noopener noreferrer" className="relative block" aria-label={`${f.title} on ${cookName}'s site`}>
                      {f.imageUrl ? (
                        // A preview of the creator's own photo, linking back to their post.
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={f.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-28 w-full object-cover sm:h-32" />
                      ) : (
                        <FoodArt name={f.title} className="h-28 w-full sm:h-32" rounded="rounded-none" />
                      )}
                      {onSale.length > 0 && (
                        <span className="absolute left-2 top-2 rounded-full bg-terracotta px-2 py-0.5 text-xs font-bold text-cream shadow-soft">🏷️ On sale</span>
                      )}
                    </a>
                    <div className="flex flex-1 flex-col gap-1.5 p-3">
                      <p className="text-xs font-extrabold text-terracotta">{cookName}</p>
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="font-bold leading-snug hover:underline">{f.title} <span aria-hidden="true" className="text-muted">↗</span></a>
                      <div className="flex flex-wrap gap-1 text-xs">
                        {f.totalMinutes && <span className="tag">⏱ {formatMinutes(f.totalMinutes)}</span>}
                        {onSale.slice(0, 2).map((s) => <span key={s} className="tag-sale text-xs">{s}</span>)}
                      </div>
                      <ShelfActions id={f.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
