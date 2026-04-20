import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

// Required in all environments
const baseSchema = z.object({
  NODE_ENV: z.string().default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
});

// Required in production; optional (with fallbacks) in dev/test
const prodSchema = baseSchema.extend({
  SESSION_SECRET: z.string().min(16, "SESSION_SECRET must be at least 16 characters in production"),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
});

const devSchema = baseSchema.extend({
  SESSION_SECRET: z.string().optional(),
  APP_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

const parsed = (isProd ? prodSchema : devSchema).safeParse(process.env);

if (!parsed.success) {
  console.error("[env] Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  throw new Error("Environment validation failed");
}

const raw = parsed.data;

export const env = {
  NODE_ENV: raw.NODE_ENV,
  isProd,
  DATABASE_URL: raw.DATABASE_URL,
  SESSION_SECRET: raw.SESSION_SECRET ?? "layoverfuel-dev-secret-do-not-use-in-prod",
  APP_URL: raw.APP_URL ?? "http://localhost:5000",
  GOOGLE_CLIENT_ID: raw.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: raw.GOOGLE_CLIENT_SECRET ?? "",
};

export const googleOAuthConfigured = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
