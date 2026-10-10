import { pgTable, text, serial, integer, timestamp, real, date, json, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { foodItemSchema, type FoodItem } from "./nutrition";
import type { PlanMeal, TravelContext } from "./travel-plan";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password"),
  name: text("name"),
  age: integer("age"),
  height: integer("height_cm"),
  weight: real("weight_kg"),
  gender: text("gender"),
  fitnessGoal: text("fitness_goal"),
  activityLevel: text("activity_level"),
  gymMemberships: text("gym_memberships").array(),
  maxCommuteMinutes: integer("max_commute_minutes"),
  tdee: integer("tdee"),
  dietaryRestrictions: text("dietary_restrictions").array(),
  assistantThreadId: text("assistant_thread_id"),
  quickLogMode: boolean("quick_log_mode").default(false),
  googleId: text("google_id").unique(),
  avatarUrl: text("avatar_url"),
  googleAccessToken: text("google_access_token"),
  googleRefreshToken: text("google_refresh_token"),
  googleTokenExpiresAt: timestamp("google_token_expires_at"),
  googleCalendarConnectedAt: timestamp("google_calendar_connected_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nutritionLogs = pgTable("nutrition_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  mealStyle: text("meal_style"),
  calories: real("calories"),
  protein: real("protein"),
  carbs: real("carbs"),
  fat: real("fat"),
  fiber: real("fiber"),
  notes: text("notes"),
  timezone: text("timezone"),                  // IANA tz at time of logging
  context: text("context"),                    // 'home' | 'airport' | 'inflight' | 'hotel' | 'other'
  createdAt: timestamp("created_at").defaultNow(),
  clientRequestId: text("client_request_id"),
  requestFingerprint: text("request_fingerprint"),
  planMealId: text("plan_meal_id"),
  items: json("items").$type<FoodItem[]>(),
  photoUrl: text("photo_url"),
  deletedAt: timestamp("deleted_at"),
}, table => [uniqueIndex("nutrition_user_request_unique").on(table.userId, table.clientRequestId)]);

export const travelDays = pgTable("travel_days", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  timezone: text("timezone").notNull(),
  revision: integer("revision").notNull().default(0),
  context: json("context").$type<TravelContext>().notNull(),
  meals: json("meals").$type<PlanMeal[]>().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, table => [uniqueIndex("travel_days_user_date_unique").on(table.userId, table.date)]);

export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  workoutType: text("workout_type"),
  duration: integer("duration"),
  intensity: text("intensity"),
  equipment: text("equipment").array(),
  notes: text("notes"),
  timezone: text("timezone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const healthLogs = pgTable("health_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  weight: real("weight"),
  hrv: integer("hrv"),
  restingHr: integer("resting_hr"),
  vo2Max: integer("vo2_max"),
  steps: integer("steps"),
  distanceWalked: real("distance_walked"),
  activeEnergy: integer("active_energy"),
  water: integer("water"),
  notes: text("notes"),
  timezone: text("timezone"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dailyPlans = pgTable("daily_plans", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  meals: json("meals"),
  workout: json("workout"),
  gymRecommendations: json("gym_recommendations"),
  motivation: text("motivation"),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true });

export const insertNutritionLogSchema = createInsertSchema(nutritionLogs)
  .omit({ id: true }).extend({ items: z.array(foodItemSchema).nullable().optional() });

export const insertWorkoutLogSchema = createInsertSchema(workoutLogs)
  .omit({ id: true });

export const insertHealthLogSchema = createInsertSchema(healthLogs)
  .omit({ id: true });

export const insertDailyPlanSchema = createInsertSchema(dailyPlans)
  .omit({ id: true });

// Auth schemas
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
});

export const loginSchema = registerSchema;

export const onboardingSchema = z.object({
  name: z.string(),
  age: z.number().int().min(18).max(100),
  height: z.number().int().min(100).max(250),
  weight: z.number().min(30).max(350),
  gender: z.enum(['male', 'female', 'other']),
  fitnessGoal: z.enum(['lose_weight', 'maintain', 'gain_muscle', 'endurance']),
  activityLevel: z.enum(['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active']),
  gymMemberships: z.array(z.string()),
  maxCommuteMinutes: z.number().int().min(0),
  dietaryRestrictions: z.array(z.string()),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type NutritionLog = typeof nutritionLogs.$inferSelect;
export type InsertNutritionLog = z.infer<typeof insertNutritionLogSchema>;

export type WorkoutLog = typeof workoutLogs.$inferSelect;
export type InsertWorkoutLog = z.infer<typeof insertWorkoutLogSchema>;

export type HealthLog = typeof healthLogs.$inferSelect;
export type InsertHealthLog = z.infer<typeof insertHealthLogSchema>;

export type DailyPlan = typeof dailyPlans.$inferSelect;
export type InsertDailyPlan = z.infer<typeof insertDailyPlanSchema>;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type OnboardingInput = z.infer<typeof onboardingSchema>;
