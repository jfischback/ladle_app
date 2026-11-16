import { test } from "node:test";
import assert from "node:assert/strict";
import { alertsFor } from "@/lib/alerts";
import type { PlanDay } from "@/lib/types";

// Shopping day is Saturday (6). Nov 19, 2026 is a Thursday; Nov 21 is the Saturday.
const day = (date: string, patch: Partial<PlanDay> = {}) => ({ date, recipeId: "r1", recipeName: "Tacos", estimatedCost: null, reason: "", saleItems: [], leftoverOf: null, ...patch }) as unknown as PlanDay;
const week = (start: string, patch: Partial<PlanDay> = {}) => Array.from({ length: 7 }, (_, i) => day(new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10), patch));

test("off means nothing", () => {
  assert.deepEqual(alertsFor({ today: "2026-11-19", shoppingDay: 6, level: "off", plans: [] }), []);
});

test("two days before shopping day with no plan: time to plan", () => {
  const a = alertsFor({ today: "2026-11-19", shoppingDay: 6, level: "essentials", plans: [] });
  assert.deepEqual(a.map((x) => x.key), ["plan:2026-11-21"]);
  assert.match(a[0].text, /Saturday/);
  assert.equal(alertsFor({ today: "2026-11-17", shoppingDay: 6, level: "essentials", plans: [] }).length, 0); // too early to nag
});

test("a draft week waiting for approval, and shopping day", () => {
  const draft = { id: "p1", weekOf: "2026-11-21", status: "draft", days: week("2026-11-21"), saleItems: [] };
  assert.ok(alertsFor({ today: "2026-11-20", shoppingDay: 6, level: "essentials", plans: [draft] }).some((x) => x.key === "approve:2026-11-21"));
  const approved = { ...draft, status: "approved", cart: null };
  const shop = alertsFor({ today: "2026-11-21", shoppingDay: 6, level: "essentials", plans: [approved] });
  assert.ok(shop.some((x) => x.key === "shop:2026-11-21"));
  assert.ok(!alertsFor({ today: "2026-11-21", shoppingDay: 6, level: "essentials", plans: [{ ...approved, cart: { sentAt: "2026-11-21T10:00:00Z" } }] }).some((x) => x.key.startsWith("shop:")));
});

test("party to-dos for today and tomorrow", () => {
  const party = { id: "x", title: "Sam's birthday", date: "2026-11-28", guests: 20, meal: false, dishes: ["sheet-cake", "pasta-salad"] };
  const a = alertsFor({ today: "2026-11-23", shoppingDay: 6, level: "essentials", plans: [], parties: [party] }); // tomorrow: order the cake
  assert.ok(a.some((x) => /cake/i.test(x.text) && /tomorrow/.test(x.title)));
});

test("everything adds tonight's dinner, prep for tomorrow and sales ending soon; dismissed alerts stay gone", () => {
  const days = week("2026-11-21");
  const plan = {
    id: "p", weekOf: "2026-11-21", status: "approved", days, cart: null,
    saleItems: [{ item: "chicken thighs", product: "x", size: "", regularPrice: 6, salePrice: 4, pctOff: 33, endsOn: "2026-11-24" }],
  };
  const recipes = new Map([["r1", { id: "r1", name: "Tacos", prepAhead: "Marinate the chicken overnight.", totalMinutes: 30 }]]);
  const all = alertsFor({ today: "2026-11-23", shoppingDay: 6, level: "everything", plans: [plan], recipes });
  assert.deepEqual(all.map((x) => x.key).sort(), ["prep:2026-11-23", "sale:2026-11-23", "tonight:2026-11-23"]);
  const essentials = alertsFor({ today: "2026-11-23", shoppingDay: 6, level: "essentials", plans: [plan], recipes });
  assert.equal(essentials.length, 0);
  const after = alertsFor({ today: "2026-11-23", shoppingDay: 6, level: "everything", plans: [plan], recipes, dismissed: ["tonight:2026-11-23"] });
  assert.ok(!after.some((x) => x.key === "tonight:2026-11-23"));
});
