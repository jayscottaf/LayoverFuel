import { pool } from "../db";

export async function databaseReadiness() {
  const required: Record<string, string[]> = {
    users: ["id", "email", "google_id", "quick_log_mode"],
    nutrition_logs: ["date", "timezone", "context", "created_at", "client_request_id", "request_fingerprint", "plan_meal_id", "items", "photo_url", "deleted_at"],
    health_logs: ["date", "timezone", "created_at"],
    workout_logs: ["date", "timezone", "created_at"],
    travel_days: ["user_id", "date", "timezone", "revision", "context", "meals"],
  };
  const { rows } = await pool.query<{ table_name: string; column_name: string }>(
    "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ANY($1)",
    [Object.keys(required)],
  );
  const present = new Set(rows.map(row => `${row.table_name}.${row.column_name}`));
  const missing = Object.entries(required).flatMap(([table, columns]) => columns
    .filter(column => !present.has(`${table}.${column}`)).map(column => `${table}.${column}`));
  const indexes = await pool.query<{ indexname: string }>(
    "SELECT indexname FROM pg_indexes WHERE schemaname = current_schema() AND indexname = ANY($1) AND indexdef LIKE 'CREATE UNIQUE INDEX%'",
    [["nutrition_user_request_unique", "travel_days_user_date_unique"]],
  );
  for (const name of ["nutrition_user_request_unique", "travel_days_user_date_unique"]) {
    if (!indexes.rows.some(row => row.indexname === name)) missing.push(`index:${name}`);
  }
  return { ready: missing.length === 0, missing };
}
