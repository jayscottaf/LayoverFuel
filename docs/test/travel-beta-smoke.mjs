// Travel beta browser smoke test (iPhone 16 Pro viewport, America/Chicago).
// Runs the first full loop against a running dev server + disposable database:
//   onboarding -> manual log -> estimate-unavailable path -> plan context + fixed
//   meal -> log planned meal -> edit/delete/restore -> history -> offline queue.
// Creates a throwaway account with a random password each run; stores no secrets.
// Usage: SMOKE_BASE_URL=http://localhost:5175 node docs/test/travel-beta-smoke.mjs
//   Optional: SMOKE_OUT=./smoke-output (screenshots), PLAYWRIGHT_MODULE=/path/to/playwright
import { createRequire } from "module";
import { randomBytes } from "crypto";
import { mkdirSync } from "fs";

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:5175";
const OUT = process.env.SMOKE_OUT || "./smoke-output";
const TZ = "America/Chicago";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, pass, detail = "") => {
  results.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({
  ...devices["iPhone 15 Pro"],
  viewport: { width: 402, height: 874 },
  deviceScaleFactor: 3,
  timezoneId: TZ,
  locale: "en-US",
  serviceWorkers: "block",
});
const page = await ctx.newPage();
const shot = n => page.screenshot({ path: `${OUT}/${n}.png` });
const api = path =>
  page.evaluate(async p => {
    const r = await fetch(p, { credentials: "include", headers: { "X-Timezone": Intl.DateTimeFormat().resolvedOptions().timeZone } });
    return { status: r.status, body: await r.json().catch(() => null) };
  }, path);
const dialogInput = key => page.getByRole("dialog").locator(`input[id$="-${key}"]`).first();
const openManual = async () => {
  await page.getByRole("button", { name: "Log food" }).last().click();
  await page.getByRole("button", { name: /Enter manually/ }).click();
};

const today = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const email = `smoke+${Date.now()}@example.test`;
const password = randomBytes(12).toString("base64url");

try {
  // Onboarding
  await page.goto(`${BASE}/auth/register`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Jason"]', "Smoke Tester");
  await page.fill("input[type=email]", email);
  const pw = page.locator("input[type=password]");
  for (let i = 0; i < (await pw.count()); i++) await pw.nth(i).fill(password);
  await page.click("button[type=submit]");
  await page.getByText(/Step 1 of/).waitFor();
  check("onboarding name prefilled", (await page.locator("#ob-name").inputValue()) === "Smoke Tester");
  const next = () => page.getByRole("button", { name: /^(Continue|Create my plan)$/ }).last().click();
  await next();
  await page.getByRole("radio", { name: "Male", exact: true }).click();
  await page.fill("#ob-age", "42");
  await page.getByLabel("Feet").fill("5");
  await page.getByLabel("Inches").fill("11");
  await page.getByLabel("Pounds").fill("180");
  await next();
  await page.getByRole("radio", { name: /Lose fat/ }).click();
  await next().catch(() => {});
  await page.getByRole("radio", { name: /3.5 days|Moderately/ }).first().click().catch(() => {});
  await next().catch(() => {});
  await next();
  check("review never asks for email", !(await page.getByText(/email/i).isVisible()));
  await page.getByRole("button", { name: "Create my plan" }).click();
  await page.getByRole("button", { name: "Start using LayoverFuel" }).waitFor();
  check("login email unchanged", (await api("/api/auth/me")).body?.email === email);
  await page.getByRole("button", { name: "Start using LayoverFuel" }).click();
  await page.waitForTimeout(1500);
  const target = (await api(`/api/dashboard?date=${today}&timezone=${TZ}`)).body?.stats?.macros?.targetCalories;
  check("Today shows the single calorie target", await page.getByText(`${target?.toLocaleString("en-US")} kcal target`).isVisible());
  await shot("01-today");

  // Manual log (local date, slot, items)
  await openManual();
  await page.getByLabel("Meal name").fill("Hotel oatmeal and eggs");
  await page.getByRole("radio", { name: "Breakfast", exact: true }).click();
  await page.getByPlaceholder("Item name, e.g. Greek yogurt").first().fill("Oatmeal and 2 eggs");
  await dialogInput("calories").fill("480");
  await dialogInput("protein").fill("26");
  await page.getByRole("button", { name: "Save meal" }).click();
  await page.waitForTimeout(1500);
  let day = (await api(`/api/logs/nutrition?date=${today}`)).body ?? [];
  const oat = day.find(l => l.notes === "Hotel oatmeal and eggs");
  check("manual meal saved to local day", oat?.date === today && oat?.mealStyle === "breakfast" && oat?.items?.length === 1);

  // Describe without an AI key falls back honestly
  await page.getByRole("button", { name: "Log food" }).last().click();
  await page.getByRole("button", { name: /Describe it/ }).click();
  await page.getByLabel("What did you eat?").fill("Turkey sandwich and an apple");
  await page.getByRole("button", { name: /^Estimate$/ }).click();
  await page.waitForTimeout(1500);
  check("estimate failure offers manual entry", await page.getByText(/manually/i).first().isVisible());
  await page.getByRole("button", { name: "Close" }).click();
  if (await page.getByRole("button", { name: /Discard/ }).count()) await page.getByRole("button", { name: /Discard/ }).first().click();

  // Plan context + fixed meal, totals, log planned meal
  await page.goto(`${BASE}/plan`, { waitUntil: "networkidle" });
  await page.getByLabel("Location").fill("Nashville, TN");
  await page.getByLabel("Fridge").check().catch(() => page.getByText("Fridge").click());
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(1200);
  let plan = (await api(`/api/travel-plan?date=${today}&timezone=${TZ}`)).body;
  check("plan context saved", plan?.context?.location === "Nashville, TN" && plan?.context?.equipment?.includes("fridge"));
  check("remaining = target − logged", plan?.remaining?.calories === plan?.targets?.calories - plan?.consumed?.calories && plan?.consumed?.calories === 480);
  await page.getByRole("button", { name: /Add a fixed meal/ }).click();
  await page.getByLabel("Name", { exact: true }).last().fill("Client dinner");
  await page.locator('input[id$="-calories"]').last().fill("900");
  await page.getByRole("button", { name: "Add to plan" }).click();
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /Log this.*Client dinner/ }).click();
  await page.getByRole("button", { name: "Save meal" }).click();
  await page.waitForTimeout(1500);
  plan = (await api(`/api/travel-plan?date=${today}&timezone=${TZ}`)).body;
  check("planned meal counted once and left the plan", plan?.consumed?.calories === 1380 && !plan?.meals?.some(m => m.name === "Client dinner"));
  await shot("02-plan");

  // Edit, delete, restore on the Log
  await page.goto(`${BASE}/log`, { waitUntil: "networkidle" });
  const row = page.locator("li, article").filter({ hasText: "Hotel oatmeal and eggs" }).first();
  await row.getByRole("button", { name: /^Edit/ }).click();
  await dialogInput("calories").fill("520");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.waitForTimeout(1200);
  day = (await api(`/api/logs/nutrition?date=${today}`)).body ?? [];
  check("edit saved", day.find(l => l.id === oat?.id)?.calories === 520);
  await row.getByRole("button", { name: /^Delete/ }).click();
  await page.waitForTimeout(1000);
  day = (await api(`/api/logs/nutrition?date=${today}`)).body ?? [];
  check("delete removes the meal", !day.some(l => l.id === oat?.id));
  await page.getByRole("button", { name: /^Undo$/ }).click();
  await page.waitForTimeout(1200);
  day = (await api(`/api/logs/nutrition?date=${today}`)).body ?? [];
  check("undo restores the same record", day.some(l => l.id === oat?.id));

  // Previous day + backdated entry
  await page.getByRole("button", { name: "Previous day" }).click();
  await page.waitForTimeout(800);
  const yesterday = new URL(page.url()).searchParams.get("date");
  await page.getByRole("button", { name: /Add food to this day/ }).click();
  await page.getByRole("button", { name: /Enter manually/ }).click();
  await page.getByLabel("Meal name").fill("Late airport snack");
  await page.getByPlaceholder("Item name, e.g. Greek yogurt").first().fill("Trail mix");
  await dialogInput("calories").fill("300");
  await page.getByRole("button", { name: "Save meal" }).click();
  await page.waitForTimeout(1200);
  const yday = (await api(`/api/logs/nutrition?date=${yesterday}`)).body ?? [];
  check("backdated meal saved to selected day", yesterday < today && yday.some(l => l.notes === "Late airport snack"));

  // Offline queue: pending, not counted, single sync
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const before = (await api(`/api/dashboard?date=${today}&timezone=${TZ}`)).body?.stats?.currentCalories;
  await ctx.setOffline(true);
  await openManual();
  await page.getByLabel("Meal name").fill("Protein bar on the plane");
  await page.getByPlaceholder("Item name, e.g. Greek yogurt").first().fill("Protein bar");
  await dialogInput("calories").fill("230");
  await page.getByRole("button", { name: "Save meal" }).click();
  await page.waitForTimeout(1200);
  check("offline save listed as waiting to sync", await page.getByText(/waiting to sync/).isVisible());
  await shot("03-offline-pending");
  await ctx.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(3500);
  const after = (await api(`/api/dashboard?date=${today}&timezone=${TZ}`)).body?.stats?.currentCalories;
  check("queued meal synced exactly once", after === before + 230, `before=${before} after=${after}`);
  check("pending notice cleared", !(await page.getByText(/waiting to sync/).isVisible()));
} catch (error) {
  check("smoke run completed", false, String(error?.message ?? error).split("\n")[0]);
  await shot("99-failure").catch(() => {});
}

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
