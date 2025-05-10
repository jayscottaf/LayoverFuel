
import { Request, Response } from "express";
import { storage } from "../../../storage";
import { createInsertSchema } from "drizzle-zod";
import { nutritionLogs } from "../../../../shared/schema";
 // adjust path based on your structure
// Zod validation schema based on your Drizzle table
const NutritionLogInsertSchema = createInsertSchema(nutritionLogs);

export async function handleNutritionLogPost(req: Request, res: Response) {
  console.log("🔥 Nutrition POST route was called");
  const userId = req.session?.userId || 1; // TEMP fallback for testing

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Validate incoming request
    const parsed = NutritionLogInsertSchema.parse(req.body);

    // Destructure after validation
    const { date, ...logData } = parsed;
    const logDate = date ? new Date(date) : new Date();

    // ✅ Use fallback-enabled userId throughout
    const existingLog = await storage.getNutritionLogByDate(userId, logDate);

    let nutritionLog;
    if (existingLog) {
      nutritionLog = await storage.updateNutritionLog(existingLog.id, logData);
    } else {
      nutritionLog = await storage.createNutritionLog({
        ...logData,
        date: logDate.toISOString().split("T")[0],
        userId,
      });
    }

    console.log("Saved nutrition log:", nutritionLog);

    res.status(200).json(nutritionLog);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
}
import { Router } from "express";
const router = Router();
router.post("/", handleNutritionLogPost);
export default router;

