import { test } from "node:test";
import assert from "node:assert/strict";
import { compareBasket, mapPoints, milesBetween } from "@/lib/store-compare";

test("miles between two Phoenix-area points", () => {
  const d = milesBetween({ lat: 33.4484, lng: -112.074 }, { lat: 33.4152, lng: -111.8315 }); // Phoenix to Mesa
  assert.ok(d > 13 && d < 15, String(d));
});

test("map: north is up, east is right, far stores pinned to the edge", () => {
  const c = { lat: 33.45, lng: -112.07 };
  const pts = mapPoints(c, [
    { locationId: "n", name: "", address: "", chain: "", lat: 33.52, lng: -112.07 },
    { locationId: "e", name: "", address: "", chain: "", lat: 33.45, lng: -111.99 },
    { locationId: "far", name: "", address: "", chain: "", lat: 34.5, lng: -112.07 },
    { locationId: "nowhere", name: "", address: "", chain: "", lat: null, lng: null },
  ], 10);
  const by = Object.fromEntries(pts.map((p) => [p.id, p]));
  assert.ok(by.n.y < 0.5 && Math.abs(by.n.x - 0.5) < 0.01);
  assert.ok(by.e.x > 0.5 && Math.abs(by.e.y - 0.5) < 0.01);
  assert.equal(by.far.y, 0.03);
  assert.equal(pts.length, 3);
});

test("comparing a basket: fair totals over shared items, best store per item", () => {
  const c = compareBasket(
    [
      { item: "chicken thighs", prices: { a: { price: 7, onSale: false, product: "" }, b: { price: 5, onSale: true, product: "" } } },
      { item: "rice", prices: { a: { price: 2, onSale: false, product: "" }, b: { price: 2.5, onSale: false, product: "" } } },
      { item: "saffron", prices: { a: { price: 9, onSale: false, product: "" }, b: null } },
    ],
    ["a", "b"],
  );
  assert.equal(c.shared, 2);
  assert.deepEqual(c.totals.map((t) => t.total), [9, 7.5]);
  assert.equal(c.cheapest, "b");
  assert.deepEqual(c.rows.map((r) => r.best), ["b", "a", "a"]);
  assert.equal(c.totals[1].sales, 1);
});
