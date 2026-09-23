import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, options: "-c timezone=UTC" });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(782143)");
  await client.query(`
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS client_request_id text;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS request_fingerprint text;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS plan_meal_id text;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS items json;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS photo_url text;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS deleted_at timestamp;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS timezone text;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS context text;
    ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
    ALTER TABLE health_logs ADD COLUMN IF NOT EXISTS timezone text;
    ALTER TABLE health_logs ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
    ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS timezone text;
    ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT now();
    CREATE UNIQUE INDEX IF NOT EXISTS nutrition_user_request_unique ON nutrition_logs(user_id, client_request_id);
    CREATE TABLE IF NOT EXISTS travel_days (
      id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), date date NOT NULL,
      timezone text NOT NULL, revision integer NOT NULL DEFAULT 0,
      context json NOT NULL, meals json NOT NULL, updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS travel_days_user_date_unique ON travel_days(user_id, date);
  `);
  await client.query("COMMIT");
  console.log("Travel foundation migration complete");
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Migration rolled back", error);
  process.exitCode = 1;
} finally { client.release(); await pool.end(); }
