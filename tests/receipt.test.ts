import { test } from "node:test";
import assert from "node:assert/strict";
import { usableTotal } from "@/lib/receipt";

test("only a clear receipt total is saved", () => {
  const r = (x: Partial<{ isReceipt: boolean; total: number | null; saved: number | null; store: string }>) => ({ isReceipt: true, total: 123.456, saved: null, store: "Fry's", ...x });
  assert.equal(usableTotal(r({})), 123.46);
  assert.equal(usableTotal(r({ isReceipt: false })), null);
  assert.equal(usableTotal(r({ total: null })), null);
  assert.equal(usableTotal(r({ total: 0 })), null);
  assert.equal(usableTotal(r({ total: 99999 })), null);
});
