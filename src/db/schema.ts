import { pgTable, uuid, text, timestamp, jsonb, integer, real, index } from "drizzle-orm/pg-core";
import type { Settings } from "@/lib/settings";
import type { Ingredient, PlanDay, GroceryList } from "@/lib/types";

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
    saleItems: jsonb("sale_items").$type<string[]>().notNull().default([]),
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

export type User = typeof users.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
export type Plan = typeof plans.$inferSelect;
