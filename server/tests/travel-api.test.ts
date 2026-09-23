import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

test("real PostgreSQL travel flow", { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const connection = new URL(process.env.TEST_DATABASE_URL!);
  assert.ok(["127.0.0.1", "localhost"].includes(connection.hostname), "Tests only run against a disposable local database");
  process.env.DATABASE_URL = connection.href;
  process.env.NODE_ENV = "test";
  const { registerRoutes } = await import("../routes");
  const { pool } = await import("../db");
  const app = express(); app.use(express.json());
  const server = await registerRoutes(app);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const accounts: number[] = [];
  const request = async (path: string, cookie = "", method = "GET", body?: unknown, headers = {}) => {
    return fetch(origin + path, { method, headers: { "Content-Type": "application/json", cookie, ...headers }, body: body ? JSON.stringify(body) : undefined });
  };
  try {
    const register = async () => {
      const res = await request("/api/auth/register", "", "POST", { email: `${crypto.randomUUID()}@example.test`, password: "test-only-password", name: "Travel tester" });
      assert.equal(res.status, 201);
      const body = await res.json(); accounts.push(body.userId);
      return { id: body.userId, cookie: res.headers.get("set-cookie")!.split(";")[0] };
    };
    const a = await register(); const b = await register();
    const profile = { name: "Travel tester", age: 40, height: 180, weight: 80, gender: "male", fitnessGoal: "maintain", activityLevel: "moderately_active", gymMemberships: [], maxCommuteMinutes: 20, dietaryRestrictions: [] };
    assert.equal((await request("/api/onboarding/complete", a.cookie, "POST", profile)).status, 200);
    const date = "2026-09-22";
    const meal = { date, timezone: "America/New_York", mealStyle: "dinner", calories: 700, protein: 40, carbs: 70, fat: 20, clientRequestId: crypto.randomUUID() };
    let id = 0;
    await t.test("unauthenticated endpoints and foreign accounts are isolated", async () => {
      assert.equal((await request("/api/assistant/messages/not-a-real-thread")).status, 401);
      assert.equal((await request("/api/assistant/thread", a.cookie, "POST", {})).status, 410);
      assert.equal((await request("/api/travel-plan")).status, 401);
      const wrong = await request("/api/logs/nutrition", a.cookie, "POST", meal, { "X-Account-Id": String(b.id) });
      assert.equal(wrong.status, 409);
    });
    await t.test("concurrent retries produce one meal and preserve its local date", async () => {
      const responses = await Promise.all(Array.from({ length: 4 }, () => request("/api/logs/nutrition", a.cookie, "POST", meal)));
      const logs = await Promise.all(responses.map(res => res.json()));
      id = logs[0].id;
      assert.ok(Number.isInteger(id));
      assert.equal(new Set(logs.map(log => log.id)).size, 1);
      assert.equal(logs[0].date, date);
      assert.equal((await request("/api/logs/nutrition", a.cookie, "POST", { ...meal, calories: 999 })).status, 409);
      assert.equal((await request(`/api/logs/nutrition/${id}`, b.cookie, "PATCH", { calories: 0 })).status, 404);
      assert.deepEqual(await (await request(`/api/logs/nutrition?date=${date}`, b.cookie)).json(), []);
    });
    await t.test("dashboard, plan, edit, delete and restore stay consistent", async () => {
      const url = `?date=${date}&timezone=America%2FNew_York`;
      const dashboard = await (await request(`/api/dashboard${url}`, a.cookie)).json();
      assert.equal(dashboard.stats.currentCalories, 700);
      assert.equal(dashboard.date, date);
      assert.equal(dashboard.dailyPlan, null);
      const plan = await (await request(`/api/travel-plan${url}`, a.cookie)).json();
      assert.equal(plan.targets.calories, dashboard.stats.macros.targetCalories);
      const locked = { ...plan.meals[0], status: "locked", name: "Client dinner" };
      const put = { date, timezone: plan.timezone, revision: plan.revision, context: { ...plan.context, location: "Denver", mealWindow: "Meeting until 18:00" }, meals: [locked] };
      assert.equal((await request("/api/travel-plan", a.cookie, "PUT", put)).status, 200);
      assert.equal((await request("/api/travel-plan", a.cookie, "PUT", put)).status, 409);
      assert.equal((await request(`/api/logs/nutrition/${id}`, a.cookie, "PATCH", { calories: 900 })).status, 200);
      const updated = await (await request(`/api/travel-plan${url}`, a.cookie)).json();
      assert.equal(updated.remaining.calories, plan.targets.calories - 900);
      assert.equal(updated.meals.find((item: any) => item.id === locked.id).name, "Client dinner");
      assert.equal((await request(`/api/logs/nutrition/${id}`, a.cookie, "DELETE")).status, 204);
      assert.equal((await (await request(`/api/dashboard${url}`, a.cookie)).json()).stats.currentCalories, 0);
      assert.equal((await request("/api/logs/nutrition", a.cookie, "POST", meal)).status, 409, "retry must not resurrect a deleted meal");
      assert.equal((await request(`/api/logs/nutrition/${id}/restore`, a.cookie, "POST", {})).status, 200);
      assert.equal((await (await request(`/api/dashboard${url}`, a.cookie)).json()).stats.currentCalories, 900);
    });
    await t.test("bad dates and negative edits fail rather than being silently changed", async () => {
      assert.equal((await request("/api/logs/nutrition", a.cookie, "POST", { ...meal, date: "2026-02-30" })).status, 400);
      assert.equal((await request(`/api/logs/nutrition/${id}`, a.cookie, "PATCH", { calories: -100 })).status, 400);
      assert.equal((await request("/api/logs/nutrition?date=not-a-date", a.cookie)).status, 400);
      const adaptive = await (await request("/api/tdee/adaptive", a.cookie)).json();
      assert.equal(adaptive.adaptiveEnabled, false);
    });
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    for (const id of accounts) {
      await pool.query("DELETE FROM travel_days WHERE user_id=$1", [id]);
      await pool.query("DELETE FROM nutrition_logs WHERE user_id=$1", [id]);
      await pool.query("DELETE FROM users WHERE id=$1", [id]);
    }
    const { storage } = await import("../storage");
    (storage.sessionStore as any).close?.();
    await pool.end();
  }
});
