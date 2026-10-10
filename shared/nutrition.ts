import { z } from "zod";
import { dateKeySchema, timezoneSchema } from "./dates";

export const nutrientsSchema = z.object({
  calories: z.number().finite().min(0).max(20000),
  protein: z.number().finite().min(0).max(3000),
  carbs: z.number().finite().min(0).max(5000),
  fat: z.number().finite().min(0).max(3000),
});
export type Nutrients = z.infer<typeof nutrientsSchema>;
export const foodItemSchema = nutrientsSchema.extend({
  name: z.string().trim().min(1).max(200),
  quantity: z.number().finite().positive().max(10000),
  unit: z.string().trim().min(1).max(40),
  source: z.enum(["manual", "label", "database", "estimate"]),
});
export type FoodItem = z.infer<typeof foodItemSchema>;
export const nutritionInputSchema = nutrientsSchema.extend({
  date: dateKeySchema,
  timezone: timezoneSchema,
  mealStyle: z.string().trim().min(1).max(200),
  fiber: z.number().finite().min(0).max(1000).nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  context: z.enum(["home", "airport", "inflight", "hotel", "other"]).nullable().optional(),
  clientRequestId: z.string().uuid().optional(),
  planMealId: z.string().max(100).nullable().optional(),
  items: z.array(foodItemSchema).max(50).optional(),
  photoUrl: z.string().max(2048).url().refine(v => v.startsWith("https://"), "Use an HTTPS photo URL").nullable().optional(),
});
export type NutritionInput = z.infer<typeof nutritionInputSchema>;
export const nutritionPatchSchema = nutritionInputSchema.omit({
  date: true, timezone: true, clientRequestId: true,
}).partial();
export const emptyNutrients = (): Nutrients => ({ calories: 0, protein: 0, carbs: 0, fat: 0 });
export function sumNutrients(items: Partial<Record<keyof Nutrients, number | null>>[]): Nutrients {
  return items.reduce<Nutrients>((total, item) => {
    for (const key of Object.keys(total) as (keyof Nutrients)[]) total[key] += item[key] ?? 0;
    return total;
  }, emptyNutrients());
}
