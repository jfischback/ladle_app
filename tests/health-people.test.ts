import { test } from "node:test";
import assert from "node:assert/strict";
import { householdHealth, normalizeHealthPerson } from "@/lib/health";
import { newAthlete } from "@/lib/athletes";

test("a health-only person reaches the planner's health needs, with no athlete added", () => {
  const dad = normalizeHealthPerson({ name: "Dad", conditions: ["diabetes"], carbsPerMeal: 50 });
  const n = householdHealth({ athletes: [], healthPeople: [dad] });
  assert.deepEqual(n.diabetes, [{ name: "Dad", carbsPerMeal: 50 }]);
  assert.equal(n.lowSodium.length, 0);
});

test("athletes' and health-only people's needs are combined", () => {
  const lifter = { ...newAthlete("Jake"), conditions: ["lowsodium" as const], sodiumPerDay: 2000 };
  const mom = normalizeHealthPerson({ name: "Mom", conditions: ["lowsodium", "keto"], sodiumPerDay: 1500 });
  const n = householdHealth({ athletes: [lifter], healthPeople: [mom] });
  assert.deepEqual(n.lowSodium.map((x) => x.name), ["Jake", "Mom"]);
  assert.deepEqual(n.keto, ["Mom"]);
});

test("saved data from before this list existed still loads", () => {
  assert.deepEqual(householdHealth({ athletes: [], healthPeople: undefined as never }).diabetes, []);
  // Unknown conditions are dropped, missing numbers get the starting values.
  const p = normalizeHealthPerson({ name: "X", conditions: ["pregnant" as never, "diabetes"] });
  assert.deepEqual(p.conditions, ["diabetes"]);
  assert.equal(p.carbsPerMeal, 45);
});
