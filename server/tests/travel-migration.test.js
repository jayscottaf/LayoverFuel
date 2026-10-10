import test from "node:test";
import assert from "node:assert/strict";
import pg from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

test("travel migration preserves legacy meals and its recovery copy on repeated runs", { skip: !process.env.TEST_DATABASE_URL }, async () => {
  const url = new URL(process.env.TEST_DATABASE_URL);
  assert.ok(["127.0.0.1", "localhost"].includes(url.hostname), "Migration tests require a disposable local database");
  const admin = new pg.Pool({ connectionString: url.href });
  const name = `travel_migration_${crypto.randomUUID().replaceAll("-", "")}`;
  await admin.query(`CREATE DATABASE ${name}`);
  url.pathname = `/${name}`;
  const pool = new pg.Pool({ connectionString: url.href });
  try {
    await pool.query(`
      CREATE TABLE users (id integer PRIMARY KEY);
      INSERT INTO users VALUES (1);
      CREATE TABLE nutrition_logs (id serial PRIMARY KEY, user_id integer REFERENCES users(id), date date, calories real, protein real, carbs real, fat real, meal_style text, notes text);
      CREATE TABLE health_logs (id serial PRIMARY KEY);
      CREATE TABLE workout_logs (id serial PRIMARY KEY);
      INSERT INTO nutrition_logs(user_id,date,calories,protein,carbs,fat,meal_style,notes) VALUES (1,'2026-10-09',550,35,60,18,'Dinner','Legacy meal');
    `);
    const original = (await pool.query("SELECT to_jsonb(n) AS record FROM nutrition_logs n")).rows[0].record;
    const run = () => promisify(execFile)(process.execPath, ["scripts/migrate-travel-foundation.mjs"], { env: { ...process.env, DATABASE_URL: url.href } });
    await run();
    await run();
    const current = (await pool.query("SELECT to_jsonb(n) AS record FROM nutrition_logs n")).rows[0].record;
    for (const [key, value] of Object.entries(original)) assert.deepEqual(current[key], value, `Preserve ${key}`);
    assert.equal((await pool.query("SELECT count(*)::int AS count FROM nutrition_logs")).rows[0].count, 1);
    assert.deepEqual((await pool.query("SELECT to_jsonb(n) AS record FROM nutrition_logs_pre_travel_beta n")).rows[0].record, original);
    assert.equal((await pool.query("SELECT indexname FROM pg_indexes WHERE indexname IN ('nutrition_user_request_unique','travel_days_user_date_unique')")).rowCount, 2);
  } finally {
    await pool.end();
    await admin.query(`DROP DATABASE ${name}`);
    await admin.end();
  }
});
