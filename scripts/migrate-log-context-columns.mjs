import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Add timezone + created_at to all three log tables, plus context to nutrition.
// Idempotent — safe to re-run.
const statements = [
  `ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS timezone text`,
  `ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS context text`,
  `ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW()`,
  `ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS timezone text`,
  `ALTER TABLE workout_logs ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW()`,
  `ALTER TABLE health_logs ADD COLUMN IF NOT EXISTS timezone text`,
  `ALTER TABLE health_logs ADD COLUMN IF NOT EXISTS created_at timestamp DEFAULT NOW()`,
];

try {
  console.log("[migrate-log-context-columns] starting");
  for (const sql of statements) {
    console.log(`  → ${sql.slice(0, 100)}`);
    await pool.query(sql);
  }
  console.log("[migrate-log-context-columns] done");
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error("[migrate-log-context-columns] failed:", err);
  await pool.end();
  process.exit(1);
}
