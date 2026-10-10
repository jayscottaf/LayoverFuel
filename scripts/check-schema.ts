import { databaseReadiness } from "../server/services/readiness";
import { pool } from "../server/db";

try {
  const result = await databaseReadiness();
  console.log(result.ready ? "Database schema is ready" : `Missing schema: ${result.missing.join(", ")}`);
  if (!result.ready) process.exitCode = 1;
} finally { await pool.end(); }
