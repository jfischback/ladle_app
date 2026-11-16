import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublicUrl, isPrivateAddress } from "@/lib/safe-fetch";

test("private and reserved addresses are refused", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "224.0.0.1"]) {
    assert.ok(isPrivateAddress(ip), ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "151.101.1.69", "2606:4700::1111"]) assert.ok(!isPrivateAddress(ip), ip);
});

test("only normal public web links get through", async () => {
  const refused = ["http://127.0.0.1/", "http://169.254.169.254/latest/meta-data/", "http://[::1]/", "http://localhost/", "http://printer.local/",
    "file:///etc/passwd", "ftp://example.com/", "https://user:pass@example.com/", "http://8.8.8.8:8080/", "http://10.0.0.5/admin"];
  for (const u of refused) await assert.rejects(assertPublicUrl(u), u);
  assert.equal((await assertPublicUrl("https://8.8.8.8/recipe")).hostname, "8.8.8.8");
});

test("an IPv4 address inside an IPv6 one is judged as the IPv4 address, however it's written", async () => {
  // The URL parser rewrites "::ffff:127.0.0.1" as "::ffff:7f00:1": both spellings must be caught.
  for (const ip of ["::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:a9fe:a9fe", "::ffff:169.254.169.254", "0:0:0:0:0:ffff:c0a8:1", "::127.0.0.1", "64:ff9b::7f00:1", "2002:7f00:1::", "fec0::1", "fe80::1%eth0", "not-an-address::1::2"]) {
    assert.ok(isPrivateAddress(ip), ip);
  }
  for (const ip of ["::ffff:8.8.8.8", "::ffff:808:808", "2606:4700:4700::1111", "2001:4860:4860::8888"]) assert.ok(!isPrivateAddress(ip), ip);
  assert.equal(new URL("http://[::ffff:127.0.0.1]/").hostname, "[::ffff:7f00:1]");
  await assert.rejects(assertPublicUrl("http://[::ffff:127.0.0.1]/"));
  await assert.rejects(assertPublicUrl("http://[::ffff:169.254.169.254]/latest/meta-data"));
});
