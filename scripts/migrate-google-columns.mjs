import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_access_token text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_refresh_token text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_token_expires_at timestamp`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_connected_at timestamp`,
  `ALTER TABLE users ALTER COLUMN password DROP NOT NULL`,
  `ALTER TABLE users ALTER COLUMN name DROP NOT NULL`,
  `DO $$
   BEGIN
     IF NOT EXISTS (
       SELECT 1 FROM pg_constraint WHERE conname = 'users_google_id_unique'
     ) THEN
       ALTER TABLE users ADD CONSTRAINT users_google_id_unique UNIQUE (google_id);
     END IF;
   END$$`,
];

try {
  console.log("[migrate-google-columns] starting");
  for (const sql of statements) {
    const label = sql.split("\n")[0].slice(0, 80);
    console.log(`  → ${label}`);
    await pool.query(sql);
  }
  console.log("[migrate-google-columns] done");
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error("[migrate-google-columns] failed:", err);
  await pool.end();
  process.exit(1);
}
