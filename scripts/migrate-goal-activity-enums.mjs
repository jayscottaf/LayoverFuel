import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const statements = [
  // Old onboarding enum → new four-goal taxonomy used by TDEE service
  `UPDATE users SET fitness_goal = 'lose_weight' WHERE fitness_goal = 'shred'`,
  `UPDATE users SET fitness_goal = 'maintain' WHERE fitness_goal = 'sustain'`,
  // Old onboarding enum → new five-step activity ladder
  `UPDATE users SET activity_level = 'moderately_active' WHERE activity_level = 'moderate'`,
];

try {
  console.log("[migrate-goal-activity-enums] starting");
  for (const sql of statements) {
    const label = sql.slice(0, 100);
    const result = await pool.query(sql);
    console.log(`  → ${label} (rows: ${result.rowCount})`);
  }
  console.log("[migrate-goal-activity-enums] done");
  await pool.end();
  process.exit(0);
} catch (err) {
  console.error("[migrate-goal-activity-enums] failed:", err);
  await pool.end();
  process.exit(1);
}
