// A browser walk through the whole app, like a new family: set up, plan the week, approve it, shop the list,
// open a recipe and cook, and visit every page. Fails on any page error, server error or failed step.
// Run against a running app: BASE=http://localhost:3000 node tests/e2e/smoke.mjs
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const problems = [];
const step = async (name, fn) => {
  const t = Date.now();
  try {
    await fn();
    console.log(`ok   ${name} (${Date.now() - t} ms)`);
  } catch (e) {
    problems.push(`${name}: ${e.message.split("\n")[0]}`);
    console.log(`FAIL ${name}: ${e.message.split("\n")[0]}`);
  }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
page.setDefaultTimeout(60_000);
page.on("pageerror", (e) => problems.push(`page error on ${page.url()}: ${e.message}`));
page.on("response", (r) => { if (r.status() >= 500) problems.push(`${r.status()} from ${r.url()}`); });
const noCrash = async () => {
  if (await page.getByText("Application error").count()) throw new Error("the page crashed");
};

await step("first visit goes to setup", async () => {
  await page.goto(BASE + "/");
  await page.waitForURL(/\/setup/);
});

await step("setup: a store, then start with Ladle's recipes", async () => {
  // First time through there are no shortcuts: step through, answering what's required.
  for (let i = 0; i < 12 && !(await page.getByRole("button", { name: "Start with our recipes" }).count()); i++) {
    if (await page.locator("#storeName").count() && !(await page.inputValue("#storeName"))) await page.fill("#storeName", "Fry's on Main");
    const next = page.getByRole("button", { name: /Next/ });
    if (await next.isDisabled()) throw new Error(`stuck on setup step ${i + 1}: ${(await page.locator("main").innerText()).slice(0, 120)}`);
    await next.click();
  }
  await page.getByRole("button", { name: "Start with our recipes" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await noCrash();
});

await step("plan the week", async () => {
  await page.getByRole("button", { name: "Plan my week" }).click();
  await page.getByRole("button", { name: "Looks yummy, make my list!" }).waitFor();
  await noCrash();
});

await step("approve it: a grocery list", async () => {
  await page.getByRole("button", { name: "Looks yummy, make my list!" }).click();
  await page.locator("#grocery-print").waitFor();
  const items = await page.locator("#grocery-print input[type=checkbox]").count();
  if (items < 5) throw new Error(`only ${items} grocery items`);
});

await step("tick an item and add one", async () => {
  await page.locator("#grocery-print input[type=checkbox]").first().check({ force: true });
  await page.fill("input[name=item]", "2 paper towels");
  await page.getByRole("button", { name: "+ Add" }).click();
  await page.locator("#grocery-print h3", { hasText: "Added by you" }).waitFor();
  await page.locator("#grocery-print li", { hasText: "paper towels" }).first().waitFor();
});

await step("a recipe opens, and cooking mode", async () => {
  await page.goto(BASE + "/recipes");
  await page.locator('main ul a[href^="/recipes/"]').first().click();
  await page.getByRole("heading", { name: "Ingredients" }).waitFor();
  await page.getByRole("button", { name: /Start cooking/ }).click();
  await page.getByRole("dialog").waitFor();
  await noCrash();
});

for (const [name, path] of [["recipes: use what I have", "/recipes?f=have&have=chicken%2C+rice"], ["starters & packs", "/recipes?tab=browse"], ["pantry", "/pantry"], ["history", "/history"], ["settings", "/setup"], ["household", "/household"], ["staples", "/staples"], ["extras", "/extras"]]) {
  await step(`page: ${name}`, async () => {
    const r = await page.goto(BASE + path);
    if (!r || r.status() >= 400) throw new Error(`status ${r?.status()}`);
    await page.locator("main").waitFor();
    await noCrash();
  });
}

await step("the fridge menu", async () => {
  await page.goto(BASE + "/");
  await page.getByRole("link", { name: /Fridge menu/ }).first().click();
  await page.getByRole("heading", { name: /What's for dinner/ }).waitFor();
});

await browser.close();
if (problems.length) {
  console.error(`\n${problems.length} problem(s):\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log("\nSmoke test passed.");
