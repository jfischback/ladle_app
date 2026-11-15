import { pgTable, uuid, text, timestamp, jsonb, integer, real, index, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import type { Settings } from "@/lib/settings";
import type { Ingredient, PlanDay, GroceryList, SaleItem, SaleCheck, StapleLine } from "@/lib/types";

// Nothing is ever deleted: recipes and plans are archived via archivedAt.

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  passwordHash: text("password_hash"), // null for Google-only accounts
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const settings = pgTable("settings", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  data: jsonb("data").$type<Settings>().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // null owner = shared starter set; otherwise the user's private copy
    ownerId: uuid("owner_id").references(() => users.id),
    // when a user adds a starter recipe, their copy points back to it
    starterId: uuid("starter_id"),
    meal: text("meal").notNull().default("dinner"), // dinner | breakfast | lunch
    name: text("name").notNull(),
    protein: text("protein"),
    servings: integer("servings"),
    totalMinutes: integer("total_minutes"),
    ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull().default([]),
    steps: jsonb("steps").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    rating: integer("rating"), // 1-5, set by the user
    ease: integer("ease"), // 1-5
    prepAhead: text("prep_ahead"), // e.g. "Marinate the steak overnight"
    // A new recipe from a followed cook that the planner put in a draft week. It joins the
    // user's list when they approve that week; until then it stays out of My Recipes.
    trial: boolean("trial").notNull().default(false),
    creditName: text("credit_name"), // "Inspired by [name]"
    creditUrl: text("credit_url"),
    sourceDocUrl: text("source_doc_url"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recipes_owner_idx").on(t.ownerId)],
);

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    weekOf: text("week_of").notNull(), // YYYY-MM-DD, first day of the plan week
    status: text("status").notNull().default("draft"), // draft | approved
    days: jsonb("days").$type<PlanDay[]>().notNull(),
    // Older plans stored plain names; newer ones store the full sale with prices.
    saleItems: jsonb("sale_items").$type<(string | SaleItem)[]>().notNull().default([]),
    saleCheck: jsonb("sale_check").$type<SaleCheck>(),
    staples: jsonb("staples").$type<StapleLine[]>(), // weekly staples with this week's prices
    stockUp: jsonb("stock_up").$type<SaleItem[]>(), // "buy on sale" pantry items that are on sale and running low
    breakfastDeal: jsonb("breakfast_deal").$type<SaleItem>(), // this week's breakfast-meat deal, if any
    summary: text("summary"),
    plannerSource: text("planner_source").notNull(), // claude | basic
    estimatedTotal: real("estimated_total"),
    groceryList: jsonb("grocery_list").$type<GroceryList>(),
    actualSpend: real("actual_spend"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("plans_user_week_idx").on(t.userId, t.weekOf)],
);

/** A food creator the user follows, e.g. Pinch of Yum. New recipes are read from their feed or sitemap. */
export const cooks = pgTable(
  "cooks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    siteUrl: text("site_url").notNull(),
    feedUrl: text("feed_url").notNull(),
    feedKind: text("feed_kind").$type<"rss" | "atom" | "sitemap">().notNull(),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    lastError: text("last_error"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("cooks_user_idx").on(t.userId)],
);

/** A recipe spotted on a followed cook's site. Only facts (title, ingredients, time) are kept until it's saved. */
export const foundRecipes = pgTable(
  "found_recipes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    cookId: uuid("cook_id")
      .notNull()
      .references(() => cooks.id),
    url: text("url").notNull(),
    title: text("title").notNull(),
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    ingredients: jsonb("ingredients").$type<Ingredient[]>().notNull().default([]),
    totalMinutes: integer("total_minutes"),
    servings: integer("servings"),
    status: text("status").notNull().default("new"), // new | saved | dismissed
    recipeId: uuid("recipe_id"), // the user's copy once saved or planned
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("found_user_url_idx").on(t.userId, t.url)],
);

/**
 * What a household has on hand. Long-lasting things only (pantry, fridge, freezer); the grocery list skips what's
 * here, and "buy on sale" items are only bought when they're on sale and running low.
 */
export const pantryItems = pgTable(
  "pantry_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    place: text("place").$type<"pantry" | "fridge" | "freezer">().notNull().default("pantry"),
    status: text("status").$type<"have" | "low" | "out">().notNull().default("have"),
    onSaleOnly: boolean("on_sale_only").notNull().default(false), // premium stock-up: buy only on sale, only when low/out
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("pantry_user_name_idx").on(t.userId, t.name)],
);

export type User = typeof users.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type Plan = typeof plans.$inferSelect;
export type Cook = typeof cooks.$inferSelect;
export type FoundRecipe = typeof foundRecipes.$inferSelect;
export type PantryItem = typeof pantryItems.$inferSelect;
