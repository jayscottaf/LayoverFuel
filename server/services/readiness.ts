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
  return { ready: missing.length === 0, missing };
}
