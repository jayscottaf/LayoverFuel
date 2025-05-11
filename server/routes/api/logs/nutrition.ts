
import { Request, Response } from "express";
import { storage } from "../../../storage";
import { insertNutritionLogSchema } from "../../../../shared/schema";
import { z } from "zod";

// Create a modified schema that makes userId optional for client requests
// This way we can fill it in with the session userId or fallback value
const ClientNutritionLogSchema = insertNutritionLogSchema
  .omit({ userId: true })
  .merge(z.object({
    userId: z.number().optional()
  }));

export async function handleNutritionLogPost(req: Request, res: Response) {
  console.log("📝 Nutrition log POST received");
  
  const userId = req.session?.userId || 1; // TEMP fallback for testing

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Validate incoming request with the client schema (userId optional)
    const clientData = ClientNutritionLogSchema.parse(req.body);
    
    // Now add the userId from session or fallback
    const parsed = {
      ...clientData,
      userId: userId
    };

    // Destructure after validation
    const { date, ...logData } = parsed;
    let logDate: Date;

    try {
      // Check if we have a placeholder date format like "YYYY-MM-DD" 
      // or any other format that's not a valid date
      if (date === "YYYY-MM-DD" || /^\d{4}-[A-Z]{2}-[A-Z]{2}$/i.test(date)) {
        logDate = new Date();
      } else {
        logDate = new Date(date);
        if (isNaN(logDate.getTime())) {
          throw new Error("Invalid date format received");
        }
      }
    } catch (error) {
      const fallback = new Date();
      logDate = fallback;
    }
    
    // Format the date as YYYY-MM-DD for database storage
    const formattedDate = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;

    // Save the nutrition log
    const nutritionLog = await storage.createNutritionLog({
      ...logData,
      date: formattedDate, // Use our pre-formatted date string
      userId,
    });

    console.log(`✅ Nutrition log saved - ID: ${nutritionLog.id} for user ${userId}`);

    res.status(200).json(nutritionLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.flatten());
      return res.status(400).json({ message: "Validation failed", issues: error.flatten() });
    }
    console.error("💥 Server error while logging nutrition:", error);
    res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
import { Router } from "express";
const router = Router();
router.post("/", handleNutritionLogPost);
export default router;

