import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { cooks, foundRecipes, recipes, type Cook, type FoundRecipe } from "@/db/schema";
import type { Ingredient } from "./types";
import { claudeEnabled } from "./claude";
import { draftFromUrl, recipeJsonLd } from "./recipe-import";

/**
 * Favorite cooks: follow a food creator's website and pick up their new recipes.
 * We read their public feed (or sitemap) and each recipe page's standard recipe data, at a gentle pace,
 * as a clearly named app. Sites that block apps are left alone. Until a recipe is saved we keep only facts
 * (title, ingredients, time) and link back; saving rewrites the steps in plain words with the creator credited.
 */

const UA = "Mozilla/5.0 (compatible; LadleRecipeSaver/1.0)";

export type FeedKind = "rss" | "atom" | "sitemap";
export type CookSource = { name: string; siteUrl: string; feedUrl: string; feedKind: FeedKind };

/** Popular family-dinner cooks, checked to work. Shown as one-tap suggestions. */
export const SUGGESTED_COOKS: CookSource[] = [
  { name: "The Modern Proper", siteUrl: "https://themodernproper.com", feedUrl: "https://themodernproper.com/sitemaps-1-section-postEntries-1-sitemap-p1.xml", feedKind: "sitemap" },
  { name: "Half Baked Harvest", siteUrl: "https://www.halfbakedharvest.com", feedUrl: "https://www.halfbakedharvest.com/feed/", feedKind: "rss" },
  { name: "Feel Good Foodie", siteUrl: "https://feelgoodfoodie.net", feedUrl: "https://feelgoodfoodie.net/feed/", feedKind: "rss" },
  { name: "The Defined Dish", siteUrl: "https://thedefineddish.com", feedUrl: "https://thedefineddish.com/feed/", feedKind: "rss" },
  { name: "RecipeTin Eats", siteUrl: "https://www.recipetineats.com", feedUrl: "https://www.recipetineats.com/feed/", feedKind: "rss" },
  { name: "Carlsbad Cravings", siteUrl: "https://carlsbadcravings.com", feedUrl: "https://carlsbadcravings.com/feed/", feedKind: "rss" },
  { name: "Salt & Lavender", siteUrl: "https://www.saltandlavender.com", feedUrl: "https://www.saltandlavender.com/feed/", feedKind: "rss" },
  { name: "Cooking With Destiny", siteUrl: "https://cookingwithdestiny.com", feedUrl: "https://cookingwithdestiny.com/feed/", feedKind: "rss" },
  { name: "Pinch of Yum", siteUrl: "https://pinchofyum.com", feedUrl: "https://pinchofyum.com/feed/", feedKind: "rss" },
  { name: "Sammy Montgoms", siteUrl: "https://sammymontgoms.com", feedUrl: "https://sammymontgoms.com/feed/", feedKind: "rss" },
  { name: "The Cozy Cook", siteUrl: "https://thecozycook.com", feedUrl: "https://thecozycook.com/feed/", feedKind: "rss" },
  { name: "Gimme Some Oven", siteUrl: "https://www.gimmesomeoven.com", feedUrl: "https://www.gimmesomeoven.com/feed/", feedKind: "rss" },
  { name: "Natasha's Kitchen", siteUrl: "https://natashaskitchen.com", feedUrl: "https://natashaskitchen.com/feed/", feedKind: "rss" },
  { name: "Cafe Delites", siteUrl: "https://cafedelites.com", feedUrl: "https://cafedelites.com/feed/", feedKind: "rss" },
  { name: "Little Spice Jar", siteUrl: "https://littlespicejar.com", feedUrl: "https://littlespicejar.com/feed/", feedKind: "rss" },
  { name: "The Chunky Chef", siteUrl: "https://www.thechunkychef.com", feedUrl: "https://www.thechunkychef.com/feed/", feedKind: "rss" },
  { name: "Spend With Pennies", siteUrl: "https://www.spendwithpennies.com", feedUrl: "https://www.spendwithpennies.com/feed/", feedKind: "rss" },
  { name: "Chelsea's Messy Apron", siteUrl: "https://www.chelseasmessyapron.com", feedUrl: "https://www.chelseasmessyapron.com/feed/", feedKind: "rss" },
  { name: "The Recipe Critic", siteUrl: "https://therecipecritic.com", feedUrl: "https://therecipecritic.com/feed/", feedKind: "rss" },
  { name: "Jo Cooks", siteUrl: "https://www.jocooks.com", feedUrl: "https://www.jocooks.com/feed/", feedKind: "rss" },
  { name: "Magnolia Table", siteUrl: "https://magnolia.com/blogs/recipe", feedUrl: "https://magnolia.com/blogs/recipe.atom", feedKind: "atom" },
];

async function get(url: string, ms = 10000): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,application/atom+xml" },
    signal: AbortSignal.timeout(ms),
    redirect: "follow",
  });
  if (res.status === 401 || res.status === 403) throw new Error("This site doesn't let apps read it.");
  if (!res.ok) throw new Error(`The site answered ${res.status}.`);
  return (await res.text()).slice(0, 3_000_000);
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", frac12: "½", frac14: "¼", frac34: "¾", deg: "°" };
export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+\d*);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Drop tracking bits so the same recipe isn't saved twice. */
function cleanUrl(u: string): string {
  try {
    const url = new URL(decode(u));
    [...url.searchParams.keys()].filter((k) => k.startsWith("utm_")).forEach((k) => url.searchParams.delete(k));
    url.hash = "";
    return url.toString();
  } catch {
    return u;
  }
}

const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1];

type FeedLink = { url: string; title: string | null; date: Date | null };

/** The newest posts from a cook's feed or sitemap. */
export async function latestLinks(src: Pick<CookSource, "feedUrl" | "feedKind">, max = 10, pages = 1): Promise<FeedLink[]> {
  let xml = await get(src.feedUrl);
  // WordPress feeds page with ?paged=N, Shopify blog feeds with ?page=N. Extra pages are a bonus; errors are ignored.
  if (pages > 1 && src.feedKind !== "sitemap") {
    const param = src.feedKind === "rss" ? "paged" : "page";
    for (let n = 2; n <= pages; n++) {
      const u = new URL(src.feedUrl);
      u.searchParams.set(param, String(n));
      xml += await get(u.toString()).catch(() => "");
    }
  }
  const toDate = (s?: string) => (s && !Number.isNaN(Date.parse(decode(s))) ? new Date(decode(s)) : null);
  let links: FeedLink[] = [];
  if (src.feedKind === "rss") {
    links = [...xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)].map(([item]) => ({
      url: cleanUrl(tag(item, "link") ?? ""),
      title: tag(item, "title") ? decode(tag(item, "title")!) : null,
      date: toDate(tag(item, "pubDate")),
    }));
  } else if (src.feedKind === "atom") {
    links = [...xml.matchAll(/<entry[\s>][\s\S]*?<\/entry>/gi)].map(([e]) => ({
      url: cleanUrl(e.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)/i)?.[1] ?? e.match(/<link[^>]*href=["']([^"']+)/i)?.[1] ?? ""),
      title: tag(e, "title") ? decode(tag(e, "title")!) : null,
      date: toDate(tag(e, "published") ?? tag(e, "updated")),
    }));
  } else {
    links = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map(([, u]) => ({
      url: cleanUrl(tag(u, "loc") ?? ""),
      title: null,
      date: toDate(tag(u, "lastmod")),
    }));
  }
  return links
    .filter((l) => /^https?:\/\//.test(l.url))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, max);
}

/** Work out how to follow a site from the address someone typed. */
export async function findSource(input: string): Promise<CookSource> {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
  } catch {
    throw new Error("That doesn't look like a website address.");
  }
  const host = url.hostname.replace(/^www\./, "");
  const known = SUGGESTED_COOKS.find((c) => new URL(c.siteUrl).hostname.replace(/^www\./, "") === host);
  if (known) return known;

  const origin = url.origin;
  // Most food blogs run WordPress, which has a feed at /feed/.
  try {
    const xml = await get(`${origin}/feed/`);
    if (/<rss[\s>]|<channel[\s>]/i.test(xml) && /<item[\s>]/i.test(xml)) {
      const channel = tag(xml, "channel") ?? "";
      const name = decode(tag(channel, "title") ?? host).replace(/\s*[-|–].*$/, "") || host;
      return { name, siteUrl: origin, feedUrl: `${origin}/feed/`, feedKind: "rss" };
    }
  } catch (e) {
    if ((e as Error).message.includes("doesn't let apps")) throw e;
  }
  // Otherwise look for a sitemap of posts or recipes.
  try {
    const robots = await get(`${origin}/robots.txt`);
    const sitemap = robots.match(/^sitemap:\s*(\S+)/im)?.[1] ?? `${origin}/sitemap.xml`;
    const index = await get(sitemap);
    const children = [...index.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((m) => decode(m[1]));
    const posts = children.find((c) => /recipe/i.test(c)) ?? children.find((c) => /post/i.test(c));
    if (posts) return { name: host, siteUrl: origin, feedUrl: posts, feedKind: "sitemap" };
  } catch {
    /* fall through */
  }
  throw new Error("We couldn't find a list of new recipes on that site.");
}

// ---------- reading one recipe page ----------

const NOT_DINNER = /dessert|cookie|cake|brownie|blondie|\bbars?\b|\bpie\b|tart\b|drinks?\b|cocktail|punch\b|smoothie|breakfast|brunch|appetizer|snack|\bdips?\b|dressing|\bsides?\b|side dish|bread|muffin|frosting|candy|fudge|pinwheel|bites\b|puffs\b|cheese board|charcuterie|granola|pancake|waffle|meal plan|menu|gift guide|round-?up|marshmallow|stuffing|gravy|cranberry sauce|mashed potatoes|seasoning|spice blend|dukkah|condiment|cider\b|lemonade|latte|cocoa|hot chocolate|eggnog|sangria|margarita|mocktail|twice baked|mashed|potato casserole|roasted vegetables|coleslaw|rolls\b|biscuits\b|cornbread|\bcrisp\b|cobbler|crumble\b|pur[eé]e|^how to\b/i;
const DINNER = /main|dinner|entr[eé]e|soup|stew|chili|pasta|casserole|curry|skillet|sheet pan|slow cooker|instant pot|tacos?/i;

function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(text).join(", ");
  return "";
}

/** "PT1H30M" -> 90 */
export function isoMinutes(v: unknown): number | null {
  const m = typeof v === "string" ? v.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i) : null;
  if (!m) return null;
  const mins = Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  return mins > 0 ? mins : null;
}

const UNITS = "cups?|c\\.|tablespoons?|tbsps?|tbs|teaspoons?|tsps?|pounds?|lbs?|ounces?|oz|grams?|g|kg|ml|liters?|l|cloves?|cans?|jars?|packages?|pkgs?|bunch(?:es)?|heads?|sticks?|slices?|pinch(?:es)?|dash(?:es)?|large|medium|small|whole|quarts?|pints?|sprigs?|stalks?|bags?|boxes?|containers?";
const AMOUNT = "(?:\\d+\\s+)?\\d+(?:[./]\\d+)?|[½¼¾⅓⅔⅛]|\\d+\\s*[½¼¾⅓⅔⅛]";

/** "1 1/2 lb boneless chicken thighs, trimmed" -> { amount: "1 1/2", unit: "lb", item: "boneless chicken thighs, trimmed" } */
export function parseIngredient(raw: string): Ingredient {
  const s = decode(raw);
  const m = s.match(new RegExp(`^((?:${AMOUNT})(?:\\s*(?:-|to)\\s*(?:${AMOUNT}))?)\\s*(?:\\(([^)]*)\\)\\s*)?(?:(${UNITS})\\b\\.?\\s+)?(.*)$`, "i"));
  if (!m) return { amount: "", unit: "", item: s };
  const unit = [m[3] ?? "", m[2] ? `(${m[2]})` : ""].filter(Boolean).join(" ");
  return { amount: m[1].trim(), unit, item: (m[4] || s).trim() };
}

export type PageRecipe = {
  title: string;
  imageUrl: string | null;
  ingredients: Ingredient[];
  totalMinutes: number | null;
  servings: number | null;
  isDinner: boolean;
};

/** Pull the recipe facts from a page's standard recipe data. Null when the page has none. */
export function pageRecipe(html: string): PageRecipe | null {
  const r = recipeJsonLd(html);
  if (!r) return null;
  const title = decode(text(r.name));
  const img = r.image;
  const imageUrl =
    typeof img === "string" ? img
    : Array.isArray(img) ? (typeof img[0] === "string" ? img[0] : ((img[0] as { url?: string })?.url ?? null))
    : ((img as { url?: string } | undefined)?.url ?? null);
  const ingredients = (Array.isArray(r.recipeIngredient) ? r.recipeIngredient : []).map((i) => parseIngredient(String(i))).filter((i) => i.item);
  const yieldNum = Number(String(text(r.recipeYield) || "").match(/\d+/)?.[0]);
  const category = text(r.recipeCategory);
  const keywords = text(r.keywords);
  const isDinner =
    !NOT_DINNER.test(`${category} ${title}`) &&
    (DINNER.test(category) || (!category.trim() && (DINNER.test(keywords) || ingredients.length >= 5)));
  return {
    title,
    imageUrl: imageUrl && /^https:\/\//.test(imageUrl) ? imageUrl : null,
    ingredients,
    totalMinutes: isoMinutes(r.totalTime) ?? ((isoMinutes(r.prepTime) ?? 0) + (isoMinutes(r.cookTime) ?? 0) || null),
    servings: Number.isFinite(yieldNum) && yieldNum > 0 && yieldNum < 50 ? yieldNum : null,
    isDinner,
  };
}

// ---------- checking for new recipes ----------

/** The main protein: the title decides first; broth and stock don't count. */
export function proteinOf(title: string, ingredients: Ingredient[]): string | null {
  const list: [RegExp, string][] = [
    [/turkey/, "Turkey"], [/sausage|chorizo|kielbasa/, "Sausage"], [/chicken/, "Chicken"],
    [/ground beef|steak|beef|brisket|chuck|oxtail|meatball|salisbury/, "Beef"], [/pork|bacon|\bham\b|carnitas|pancetta|prosciutto/, "Pork"],
    [/shrimp|salmon|\bcod\b|tilapia|fish|tuna|scallop/, "Fish"],
  ];
  const t = title.toLowerCase();
  const fromTitle = list.find(([re]) => re.test(t))?.[1];
  if (fromTitle) return fromTitle;
  const hay = ingredients.map((i) => i.item.toLowerCase()).filter((i) => !/broth|stock|bouillon|base\b/.test(i)).join(" ");
  return list.find(([re]) => re.test(hay))?.[1] ?? null;
}

async function inPool<T>(items: T[], size: number, stopAt: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (i < items.length && Date.now() < stopAt) await fn(items[i++]).catch(() => {});
    }),
  );
}

/**
 * Look for new recipes from the cooks this user follows.
 * Cooks checked in the last `minHours` are skipped. Stops starting new work after `budgetMs`.
 */
export async function refreshCooks(userId: string, opts: { budgetMs?: number; minHours?: number } = {}) {
  const stopAt = Date.now() + (opts.budgetMs ?? 20000);
  const minHours = opts.minHours ?? 12;
  const db = await getDb();
  const mine = await db.select().from(cooks).where(and(eq(cooks.userId, userId), isNull(cooks.archivedAt)));
  const due = mine.filter((c) => !c.lastCheckedAt || Date.now() - c.lastCheckedAt.getTime() > minHours * 3600_000);
  if (!due.length) return { checked: 0, found: 0 };
  const known = new Set((await db.select({ url: foundRecipes.url }).from(foundRecipes).where(eq(foundRecipes.userId, userId))).map((r) => r.url));
  let found = 0;

  await inPool(due, 4, stopAt, async (cook) => {
    try {
      // The first time, read a few pages back so there's a good choice to start with.
      const first = !cook.lastCheckedAt;
      const links = (await latestLinks(cook, first ? 30 : 10, first ? 3 : 1)).filter((l) => !known.has(l.url)).slice(0, first ? 15 : 8);
      for (const link of links) {
        if (Date.now() > stopAt) break;
        known.add(link.url);
        let page: PageRecipe | null = null;
        try {
          page = pageRecipe(await get(link.url, 9000));
        } catch {
          continue; // try again next time
        }
        // Pages without recipe data (e.g. Magnolia) keep the feed title; they can still be saved by reading the page.
        const title = page?.title || link.title;
        if (!title) continue;
        const isDinner = page ? page.isDinner : !NOT_DINNER.test(title);
        await db
          .insert(foundRecipes)
          .values({
            userId,
            cookId: cook.id,
            url: link.url,
            title,
            imageUrl: page?.imageUrl ?? null,
            publishedAt: link.date,
            ingredients: page?.ingredients ?? [],
            totalMinutes: page?.totalMinutes ?? null,
            servings: page?.servings ?? null,
            // Non-dinners are remembered (so we don't read them again) but never shown.
            status: isDinner ? "new" : "skipped",
          })
          .onConflictDoNothing();
        if (isDinner) found++;
      }
      await db.update(cooks).set({ lastCheckedAt: new Date(), lastError: null }).where(eq(cooks.id, cook.id));
    } catch (e) {
      await db.update(cooks).set({ lastCheckedAt: new Date(), lastError: (e as Error).message }).where(eq(cooks.id, cook.id));
    }
  });
  return { checked: due.length, found };
}

/**
 * Turn a found recipe into the user's own recipe. With Claude, the page is read in full and the steps are
 * rewritten in plain words; without it, we keep the ingredients and link to the original for the steps.
 * `trial` recipes stay out of My Recipes until the week that uses them is approved.
 */
export async function adoptFoundRecipe(userId: string, found: FoundRecipe, cook: Pick<Cook, "name">, trial: boolean): Promise<string> {
  const db = await getDb();
  if (found.recipeId) {
    if (!trial) await db.update(recipes).set({ trial: false, updatedAt: new Date() }).where(and(eq(recipes.id, found.recipeId), eq(recipes.ownerId, userId)));
    return found.recipeId;
  }
  let values: typeof recipes.$inferInsert = {
    ownerId: userId,
    name: found.title,
    protein: proteinOf(found.title, found.ingredients),
    servings: found.servings,
    totalMinutes: found.totalMinutes,
    ingredients: found.ingredients,
    steps: [],
    tags: [],
    creditName: cook.name,
    creditUrl: found.url,
    trial,
  };
  if (claudeEnabled()) {
    try {
      const d = await draftFromUrl(found.url);
      values = {
        ...values,
        name: d.name || found.title,
        protein: d.protein || values.protein,
        servings: d.servings ?? values.servings,
        totalMinutes: d.totalMinutes ?? values.totalMinutes,
        ingredients: d.ingredients.length ? d.ingredients : values.ingredients,
        steps: d.steps,
        tags: d.tags,
        prepAhead: d.prepAhead || null,
      };
    } catch {
      /* keep the facts we have; the recipe page links to the original for steps */
    }
  }
  const [row] = await db.insert(recipes).values(values).returning({ id: recipes.id });
  await db
    .update(foundRecipes)
    .set({ recipeId: row.id, status: trial ? found.status : "saved" })
    .where(eq(foundRecipes.id, found.id));
  return row.id;
}
