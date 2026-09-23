import { z } from "zod";
import { dateKeySchema, timezoneSchema } from "./dates";
import { nutrientsSchema, type Nutrients } from "./nutrition";

export const travelContextSchema = z.object({
  location: z.string().trim().max(200).default(""),
  pattern: z.enum(["hotel", "groceries", "packed"]).default("hotel"),
  mealWindow: z.string().trim().max(120).default(""),
  equipment: z.array(z.enum(["fridge", "microwave", "kitchen", "none"])).max(4).default([]),
  notes: z.string().trim().max(1000).default(""),
});
export const planMealSchema = nutrientsSchema.extend({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(200),
  description: z.string().max(1000),
  status: z.enum(["planned", "locked"]), source: z.enum(["estimate", "manual"]),
});
export const travelPlanInputSchema = z.object({
  date: dateKeySchema, timezone: timezoneSchema,
  revision: z.number().int().nonnegative(),
  context: travelContextSchema,
  meals: z.array(planMealSchema).max(10).refine(meals => new Set(meals.map(m => m.id)).size === meals.length, "Meal IDs must be unique"),
});
export type TravelContext = z.infer<typeof travelContextSchema>;
export type PlanMeal = z.infer<typeof planMealSchema>;
export interface TravelPlan {
  date: string; timezone: string; revision: number; context: TravelContext;
  targets: Nutrients; consumed: Nutrients; remaining: Nutrients;
  meals: PlanMeal[]; message: string; coverage: "generic";
}
