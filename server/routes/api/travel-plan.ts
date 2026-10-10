import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../../db";
import { storage } from "../../storage";
import { travelDays } from "@shared/schema";
import { dateKeySchema, dateKeyToDate, localDateKey, timezoneSchema } from "@shared/dates";
import { travelPlanInputSchema } from "@shared/travel-plan";
import { buildTravelPlan } from "../../services/travel-plan-service";
import { calculateMacros, calculateTDEE } from "../../services/tdee-service";

const router = Router();
router.use((req, res, next) => {
  if (!req.session.userId!) { res.status(401).json({ message: "Unauthorized" }); return; }
  next();
});

async function readPlan(userId: number, date: string, timezone: string) {
  const user = await storage.getUser(userId);
  if (!user) throw new Error("Account unavailable");
  const [saved] = await db.select().from(travelDays).where(and(eq(travelDays.userId, userId), eq(travelDays.date, date)));
  const logs = await storage.getNutritionLogsByDate(userId, dateKeyToDate(date));
  const macros = calculateMacros(user, calculateTDEE(user));
  return buildTravelPlan({ date, timezone, revision: saved?.revision, context: saved?.context,
    savedMeals: saved?.meals, logs, restrictions: user.dietaryRestrictions ?? [],
    targets: { calories: macros.targetCalories, protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
  });
}

router.get("/", async (req, res) => {
  try {
    const timezone = timezoneSchema.parse(req.query.timezone ?? req.get("X-Timezone") ?? "UTC");
    const date = dateKeySchema.parse(req.query.date ?? localDateKey(timezone));
    res.json(await readPlan(req.session.userId!, date, timezone));
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ message: "Invalid date or timezone" }); return; }
    console.error("Plan read failed", error);
    res.status(503).json({ message: "Your plan is unavailable. Please retry." });
  }
});

router.put("/", async (req, res) => {
  try {
    const input = travelPlanInputSchema.parse(req.body);
    const [existing] = await db.select().from(travelDays).where(and(
      eq(travelDays.userId, req.session.userId!), eq(travelDays.date, input.date),
    ));
    const logs = await storage.getNutritionLogsByDate(req.session.userId!, dateKeyToDate(input.date));
    const consumedIds = new Set(logs.map(log => log.planMealId).filter(Boolean));
    // GET hides consumed choices; retain their definitions so undo can restore them.
    const retained = (existing?.meals ?? []).filter(meal => meal.status === "locked" &&
      consumedIds.has(meal.id) && !input.meals.some(next => next.id === meal.id));
    const values = { userId: req.session.userId!, date: input.date, timezone: input.timezone,
      context: input.context, meals: [...input.meals, ...retained], revision: input.revision + 1, updatedAt: new Date() };
    const result = input.revision === 0
      ? await db.insert(travelDays).values(values).onConflictDoNothing().returning()
      : await db.update(travelDays).set(values).where(and(
        eq(travelDays.userId, req.session.userId!), eq(travelDays.date, input.date), eq(travelDays.revision, input.revision),
      )).returning();
    if (!result.length) { res.status(409).json({ message: "Your plan changed in another window. Reload before saving." }); return; }
    res.json(await readPlan(req.session.userId!, input.date, input.timezone));
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ message: "Check your plan fields", issues: error.flatten() }); return; }
    console.error("Plan save failed", error);
    res.status(503).json({ message: "Your plan was not saved. Please retry." });
  }
});
export default router;
