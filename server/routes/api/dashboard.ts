import { Router, type Request } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { dateKeySchema, dateKeyToDate, localDateKey, shiftDateKey, timezoneSchema } from "@shared/dates";
import { sumNutrients } from "@shared/nutrition";
import { calculateMacros, calculateTDEE } from "../../services/tdee-service";

export function requestDay(req: Request) {
  const timezone = timezoneSchema.parse(req.query.timezone ?? req.get("X-Timezone") ?? "UTC");
  const date = dateKeySchema.parse(req.query.date ?? localDateKey(timezone));
  return { timezone, date, day: dateKeyToDate(date) };
}
export function countStreak(dates: string[], today: string) {
  const unique = new Set(dates);
  let cursor = unique.has(today) ? today : shiftDateKey(today, -1);
  let count = 0;
  while (unique.has(cursor)) { count++; cursor = shiftDateKey(cursor, -1); }
  return count;
}
const router = Router();
router.use(["/dashboard", "/stats", "/logs/water"], (req, res, next) => {
  if (!req.session.userId!) { res.status(401).json({ message: "Unauthorized" }); return; }
  next();
});
router.get("/dashboard", async (req, res) => {
  try {
    const { date, timezone, day } = requestDay(req);
    const user = await storage.getUser(req.session.userId!);
    if (!user) { res.status(404).json({ message: "Account not found" }); return; }
    const tdee = calculateTDEE(user);
    const macros = calculateMacros(user, tdee);
    const healthLog = await storage.getHealthLogByDate(user.id, day);
    const meals = await storage.getNutritionLogsByDate(user.id, day);
    const allMeals = await storage.getNutritionLogs(user.id);
    const workoutLog = await storage.getWorkoutLogByDate(user.id, day);
    const totals = sumNutrients(meals);
    res.json({ date, timezone, user: { name: user.name, goal: user.fitnessGoal },
      stats: { tdee, macros, currentCalories: totals.calories, currentProtein: totals.protein,
        calorieProgress: Math.round(totals.calories / Math.max(macros.targetCalories, 1) * 100),
        proteinProgress: Math.round(totals.protein / Math.max(macros.protein, 1) * 100),
        currentSteps: healthLog?.steps ?? 0, stepsProgress: (healthLog?.steps ?? 0) / 100,
        water: healthLog?.water ?? 0, waterTarget: 8, waterTargetReason: null,
        waterProgress: (healthLog?.water ?? 0) / 8 * 100,
        streak: countStreak(allMeals.map(meal => meal.date), date),
      },
      dailyPlan: null, healthLog, nutritionLog: { ...totals, meals }, workoutLog,
    });
  } catch (error) {
    if (error instanceof z.ZodError) { res.status(400).json({ message: "Invalid date or timezone" }); return; }
    console.error("Dashboard unavailable", error);
    res.status(503).json({ message: "Your daily data is unavailable. Please retry." });
  }
});
router.get("/stats", async (req, res) => {
  try {
    const { date } = requestDay(req);
    const meals = await storage.getNutritionLogs(req.session.userId!);
    const days = new Map<string, number>();
    for (const meal of meals) days.set(meal.date, (days.get(meal.date) ?? 0) + (meal.calories ?? 0));
    const recent = [...days.keys()].filter(day => day >= shiftDateKey(date, -29) && day <= date);
    res.json({ streak: countStreak([...days.keys()], date), totalDaysLogged: days.size,
      avgCalories: days.size ? Math.round([...days.values()].reduce((a, b) => a + b, 0) / days.size) : 0,
      consistency: Math.round(recent.length / 30 * 100),
    });
  } catch { res.status(503).json({ message: "Progress data is unavailable" }); }
});
router.post("/logs/water", async (req, res) => {
  try {
    const timezone = timezoneSchema.parse(req.body.timezone ?? req.get("X-Timezone") ?? "UTC");
    const date = dateKeySchema.parse(req.body.date ?? localDateKey(timezone));
    const glasses = z.number().int().min(0).max(100).parse(req.body.glasses);
    const existing = await storage.getHealthLogByDate(req.session.userId!, dateKeyToDate(date));
    const saved = existing
      ? await storage.updateHealthLog(existing.id, { water: glasses, timezone })
      : await storage.createHealthLog({ userId: req.session.userId!, date, timezone, water: glasses });
    res.json(saved);
  } catch (error) {
    res.status(error instanceof z.ZodError ? 400 : 503).json({ message: "Water entry was not saved" });
  }
});
export default router;
