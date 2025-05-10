
import { Request, Response } from "express";
import { storage } from "../../../storage";
import { createInsertSchema } from "drizzle-zod";
import { nutritionLogs, insertNutritionLogSchema } from "../../../../shared/schema";
import { z } from "zod";

// Create a modified schema that makes userId optional for client requests
// This way we can fill it in with the session userId or fallback value
const ClientNutritionLogSchema = insertNutritionLogSchema
  .omit({ userId: true })
  .merge(z.object({
    userId: z.number().optional()
  }));

export async function handleNutritionLogPost(req: Request, res: Response) {
  console.log("🔥 Nutrition POST route was called - ROUTED VERSION");
  console.log("⚠️ Request URL:", req.originalUrl);
  console.log("⚠️ Request path:", req.path);
  console.log("⚠️ Request query:", req.query);
  console.log("⚠️ Request params:", req.params);
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  console.log("Session:", req.session);
  
  const userId = req.session?.userId || 1; // TEMP fallback for testing

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Validate incoming request with the client schema (userId optional)
    console.log("Validating request data with client schema...");
    const clientData = ClientNutritionLogSchema.parse(req.body);
    console.log("Client data validated:", clientData);
    
    // Now add the userId from session or fallback
    const parsed = {
      ...clientData,
      userId: userId
    };
    console.log("Complete data with userId:", parsed);

    // Destructure after validation
    const { date, ...logData } = parsed;
    const logDate = date ? new Date(date) : new Date();
    console.log("Using date:", logDate);

    // ✅ Use fallback-enabled userId throughout
    console.log("Looking for existing log with userId:", userId, "and date:", logDate);
    const existingLog = await storage.getNutritionLogByDate(userId, logDate);
    console.log("Existing log found?", !!existingLog);

    let nutritionLog;
    if (existingLog) {
      console.log("Updating existing log:", existingLog.id);
      nutritionLog = await storage.updateNutritionLog(existingLog.id, logData);
    } else {
      console.log("Creating new log with:", {
        ...logData,
        date: logDate.toISOString().split("T")[0],
        userId,
      });
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

