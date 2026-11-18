import { test } from "node:test";
import assert from "node:assert/strict";
import { oneOfEachStarter } from "@/lib/data";

test("a starter copied twice shows once, keeping the rated copy; own recipes are never merged", () => {
  const rows = [
    { id: "1", name: "Bean and Rice Burritos", starterId: "s1", rating: null },
    { id: "2", name: "Bean and Rice Burritos", starterId: "s2", rating: 5 },
    { id: "3", name: "Mom's Chili", starterId: null, rating: null },
    { id: "4", name: "Mom's Chili", starterId: null, rating: null },
  ];
  assert.deepEqual(oneOfEachStarter(rows).map((r) => r.id), ["2", "3", "4"]);
});
