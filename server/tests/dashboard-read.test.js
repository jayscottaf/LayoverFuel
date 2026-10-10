import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";
import express from "express";
import session from "express-session";
import bcrypt from "bcryptjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = await mkdtemp(join(root, "node_modules", ".dashboard-test-"));
after(() => rm(output, { recursive: true, force: true }));
const file = join(output, "routes.mjs");

// Exercise the real route with in-memory storage and providers that reject calls.
await build({
  entryPoints: [join(root, "server/routes.ts")], outfile: file,
  bundle: true, platform: "node", format: "esm", packages: "external",
  plugins: [{ name: "dashboard-fixtures", setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)storage$/ }, () => ({ path: "storage", namespace: "fixture" }));
    builder.onResolve({ filter: /(?:^|\/)config\/env$/ }, () => ({ path: "env", namespace: "fixture" }));
    builder.onResolve({ filter: /(?:^|\/)(openai-service|meal-service|workout-service|image-analysis-service)$/ }, args => ({ path: args.path.split("/").pop(), namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
      if (args.path === "storage") return { contents: "export const storage = globalThis.__dashboardStorage;" };
      if (args.path === "env") return { contents: 'export const env = { SESSION_SECRET: "fixture-session-secret", APP_URL: "http://127.0.0.1", isProd: false }; export const googleOAuthConfigured = false;' };
      const exports = {
        "openai-service": ["processOnboardingMessage", "generateDailyMotivation", "processFeedback"],
        "meal-service": ["generateMealPlan"],
        "workout-service": ["generateWorkoutPlan"],
        "image-analysis-service": ["analyzeMealImage"],
      }[args.path];
      return { contents: exports.map(name => `export async function ${name}() { globalThis.__dashboardProviderCalls++; throw new Error("Dashboard must not call AI"); }`).join("\n") + '\nexport const onboardingQuestions = [];' };
    });
  } }],
});

test("dashboard returns totals without creating a plan or calling AI", async t => {
  let plan;
  const user = { id: 1, email: "camera@example.test", name: "Camera Tester", age: 40, height: 180, weight: 80, gender: "male", fitnessGoal: "maintain_weight", activityLevel: "moderately_active", googleRefreshToken: null, password: await bcrypt.hash("test-only-password", 4) };
  globalThis.__dashboardProviderCalls = 0;
  globalThis.__dashboardStorage = {
    sessionStore: new session.MemoryStore(),
    getUserByEmail: async () => user,
    getUser: async () => user,
    getHealthLogByDate: async () => ({ water: 2, steps: 3000 }),
    getNutritionLogsByDate: async () => [{ calories: 480, protein: 25, carbs: 45, fat: 15 }],
    getNutritionLogs: async () => [],
    getWorkoutLogByDate: async () => undefined,
    getDailyPlanByDate: async () => plan,
    createDailyPlan: async () => { throw new Error("Dashboard must not create a plan"); },
  };
  const { registerRoutes } = await import(pathToFileURL(file).href);
  const app = express();
  app.use(express.json());
  const server = await registerRoutes(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    delete globalThis.__dashboardStorage;
    delete globalThis.__dashboardProviderCalls;
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  assert.equal((await fetch(`${base}/api/dashboard`)).status, 401);
  const login = await fetch(`${base}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, password: "test-only-password" }) });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const read = () => fetch(`${base}/api/dashboard`, { headers: { Cookie: cookie } });
  const first = await read();
  assert.equal(first.status, 200);
  const data = await first.json();
  assert.equal(data.stats.currentCalories, 480);
  assert.equal(data.stats.currentProtein, 25);
  assert.equal(data.dailyPlan, null);
  assert.equal(globalThis.__dashboardProviderCalls, 0);
  plan = { id: 7, meals: { breakfast: { name: "Stored breakfast" } } };
  assert.deepEqual((await (await read()).json()).dailyPlan, plan);
  assert.equal(globalThis.__dashboardProviderCalls, 0);
});
