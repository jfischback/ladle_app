import { test } from "node:test";
import assert from "node:assert/strict";
import { toIcs, weekEvents } from "@/lib/calendar";
import type { PlanDay } from "@/lib/types";

test("the week becomes calendar events", () => {
  const days = [
    { date: "2026-11-23", recipeId: "a", recipeName: "Chili, the big pot", reason: "Beans are on sale; cheap" },
    { date: "2026-11-24", recipeId: "a", recipeName: "Chili, the big pot", leftoverOf: "2026-11-23", reason: "" },
    { date: "2026-11-25", recipeId: null, recipeName: null, reason: "No-cook night" },
    { date: "2026-11-26", recipeId: "b", recipeName: "Fajitas", reason: "" },
  ] as PlanDay[];
  const recipes = new Map([["a", { totalMinutes: 60, prepAhead: null }], ["b", { totalMinutes: 30, prepAhead: "Marinate the steak overnight." }]]);
  const ev = weekEvents("p1", days, recipes, "https://ladle.example");
  assert.deepEqual(ev.map((e) => [e.date, e.startMinutes, e.title]), [
    ["2026-11-23", 17 * 60, "🍲 Cook: Chili, the big pot"],
    ["2026-11-24", 17 * 60 + 45, "♻️ Leftovers: Chili, the big pot"],
    ["2026-11-25", 19 * 60, "⏰ Prep for tomorrow: Fajitas"],
    ["2026-11-26", 17 * 60 + 30, "🍲 Cook: Fajitas"],
  ]);
  const ics = toIcs(ev);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART:20261123T170000\r\n/);
  assert.match(ics, /DTEND:20261123T180000\r\n/);
  assert.match(ics, /SUMMARY:🍲 Cook: Chili\\, the big pot/, "commas are escaped");
  assert.ok(ics.includes("DESCRIPTION:Beans are on sale\\; cheap\\nRecipe:"), "semicolons and new lines are escaped");
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line, "utf8") <= 75, `line too long: ${line}`);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 4);
});

test("Thanksgiving's countdown goes on the calendar", async () => {
  const { weekEvents } = await import("@/lib/calendar");
  const days = [
    { date: "2026-11-26", recipeId: null, recipeName: "Thanksgiving dinner", estimatedCost: null, reason: "", saleItems: [], alternatives: [], feast: { holiday: "Thanksgiving", guests: 10, dishes: ["turkey", "pumpkin-pie"], frozen: true } },
    { date: "2026-11-27", recipeId: null, recipeName: "Thanksgiving leftovers", estimatedCost: 0, reason: "", saleItems: [], alternatives: [], leftoverOf: "2026-11-26" },
  ];
  const ev = weekEvents("p1", days, new Map(), "https://x");
  const titles = ev.map((e) => `${e.date} ${e.title}`);
  assert.ok(titles.includes("2026-11-22 🦃 Move the turkey to the fridge"), titles.join(" | "));
  assert.ok(titles.includes("2026-11-25 🦃 Get ahead for Thanksgiving"));
  assert.ok(titles.includes("2026-11-26 🦃 Turkey in the oven"));
  assert.ok(titles.includes("2026-11-26 🦃 Thanksgiving dinner for 10"));
  assert.ok(titles.includes("2026-11-27 ♻️ Thanksgiving leftovers"));
  assert.equal(new Set(ev.map((e) => e.uid)).size, ev.length, "every event has its own id");
});
