import { test } from "node:test";
import assert from "node:assert/strict";
import { pickWeek, weekSteps, type WeekState } from "@/lib/home-week";

const THIS = "2026-11-14"; // the week in progress (last shopping day)
const NEXT = "2026-11-21"; // the next shopping day
const p = (id: string, weekOf: string, status: string) => ({ id, weekOf, status });

test("Home keeps the week being cooked up front after next week is planned", () => {
  const plans = [p("n", NEXT, "draft"), p("t", THIS, "approved")];
  const w = pickWeek(plans, THIS, NEXT);
  assert.equal(w.plan?.id, "t");
  assert.equal(w.other?.id, "n", "the other week is one tap away");
});

test("a brand-new family that planned next week sees that week", () => {
  assert.equal(pickWeek([p("n", NEXT, "draft")], THIS, NEXT).plan?.id, "n");
  assert.equal(pickWeek([], THIS, NEXT).plan, null);
});

test("a this-week draft doesn't hide an approved next week, but can be opened", () => {
  const plans = [p("t", THIS, "draft"), p("n", NEXT, "approved")];
  assert.equal(pickWeek(plans, THIS, NEXT).plan?.id, "n");
  assert.equal(pickWeek(plans, THIS, NEXT, THIS).plan?.id, "t");
});

test("?week= opens the week just planned; a week that isn't there falls back", () => {
  const plans = [p("t", THIS, "approved"), p("n", NEXT, "draft")];
  assert.equal(pickWeek(plans, THIS, NEXT, NEXT).plan?.id, "n");
  assert.equal(pickWeek(plans, THIS, NEXT, "next").plan?.id, "n");
  assert.equal(pickWeek(plans, THIS, NEXT, "2020-01-01").plan?.id, "t");
});

test("on shopping day there's one week, and no switcher", () => {
  const w = pickWeek([p("t", NEXT, "approved")], NEXT, NEXT, "next");
  assert.equal(w.plan?.id, "t");
  assert.equal(w.nextPlan, null);
  assert.equal(w.other, null);
});

test("an approved week wins over a leftover draft for the same week", () => {
  assert.equal(pickWeek([p("d", THIS, "draft"), p("a", THIS, "approved")], THIS, NEXT).plan?.id, "a");
});

const base: WeekState = { planId: "x", weekOf: NEXT, approved: true, firstDay: NEXT, today: "2026-11-19", pantryQuestions: 0, listTotal: 20, listLeft: 20, cartSent: false, cartReady: false, receiptIn: false, storeName: "Fry's", tonight: null, next: null };
const step = (over: Partial<WeekState>) => weekSteps({ ...base, ...over });

test("the next step follows the week in order", () => {
  assert.equal(step({ approved: false }).nextStep, "approve");
  assert.equal(step({ pantryQuestions: 3 }).nextStep, "pantry");
  assert.equal(step({}).nextStep, "shop");
  assert.equal(step({ listLeft: 0 }).nextStep, "receipt");
  assert.equal(step({ listLeft: 0, receiptIn: true }).nextStep, "done");
});

test("nothing counts as done before the week is approved", () => {
  const s = step({ approved: false, pantryQuestions: 0, listTotal: 0, listLeft: 0 });
  assert.deepEqual(s.steps.map((x) => x.done), [true, false, false, false, false]);
});

test("shopping: the cart when it's connected, the list when it isn't, checkout once it's sent", () => {
  assert.equal(step({ cartReady: true }).card.href, "/cart?plan=x");
  assert.equal(step({}).card.href, "#grocery-print");
  const sent = step({ cartReady: true, cartSent: true });
  assert.equal(sent.nextStep, "shop", "a filled cart still needs a person to check out");
  assert.match(sent.card.title, /Check out at Fry's/);
});

test("once the week's first day has passed, Ladle asks for the receipt instead of nagging to shop", () => {
  const s = step({ today: "2026-11-22" });
  assert.equal(s.nextStep, "receipt");
  assert.equal(s.card.href, "/history#week-x");
});

test("planning next week never waits on the receipt", () => {
  const s = step({ today: "2026-11-22", weekOf: THIS, firstDay: THIS, next: { weekOf: NEXT, status: "none" } });
  assert.equal(s.card.more?.href, "/plan");
  assert.equal(step({ listLeft: 0, receiptIn: true, next: { weekOf: NEXT, status: "none" } }).card.href, "/plan");
  assert.equal(step({ listLeft: 0, receiptIn: true, next: { weekOf: NEXT, status: "draft" } }).card.href, `/?week=${NEXT}`);
  assert.match(step({ listLeft: 0, receiptIn: true, next: { weekOf: NEXT, status: "approved" }, tonight: "Tacos" }).card.text, /Tonight: Tacos/);
});
