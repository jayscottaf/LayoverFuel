import { pgTable, text, serial, integer, boolean, timestamp, real, date, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  age: integer("age"),
  height: integer("height"),
  weightKg: real("weight_kg"),
  gender: text("gender"),
  fitnessGoal: text("fitness_goal"),
  activityLevel: text("activity_level"),
  gymMemberships: text("gym_memberships").array(),
  maxCommuteMinutes: integer("max_commute_minutes"),
  tdee: integer("tdee"),
  dietaryRestrictions: text("dietary_restrictions").array(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const nutritionLogs = pgTable("nutrition_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  mealStyle: text("meal_style"),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fat: integer("fat"),
  fiber: integer("fiber"),
  notes: text("notes"),
});

export const workoutLogs = pgTable("workout_logs", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  workoutType: text("workout_type"),
  duration: integer("duration"),
  intensity: text("intensity"),
  equipment: text("equipment").array(),
  notes: text("notes"),
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
  notes: text("notes"),
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
  .omit({ id: true });

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
});

export const loginSchema = registerSchema;

export const onboardingSchema = z.object({
  name: z.string(),
  age: z.number().int().min(1),
  height: z.number().int().min(1),
  weightKg: z.number().min(1),
  gender: z.enum(['male', 'female', 'other']),
  fitnessGoal: z.enum(['shred', 'sustain']),
  activityLevel: z.enum(['lightly_active', 'moderate', 'very_active']),
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
