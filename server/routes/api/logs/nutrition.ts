
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

  const userId = req.session?.userId;
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

export async function handleNutritionLogGet(req: Request, res: Response) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { date, start, end } = req.query;

    // If specific date requested
    if (date && typeof date === 'string') {
      const logDate = new Date(date);
      const logs = await storage.getNutritionLogsByDate(userId, logDate);
      return res.status(200).json(logs);
    }

    // If date range requested
    if (start && end && typeof start === 'string' && typeof end === 'string') {
      const allLogs = await storage.getNutritionLogs(userId);
      const filtered = allLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= new Date(start) && logDate <= new Date(end);
      });
      return res.status(200).json(filtered);
    }

    // Default: return all logs
    const logs = await storage.getNutritionLogs(userId);
    res.status(200).json(logs);
  } catch (error) {
    console.error("💥 Error fetching nutrition logs:", error);
    res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleNutritionLogDelete(req: Request, res: Response) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "Invalid log id" });
  }

  try {
    const existing = await storage.getNutritionLogById(id);
    if (!existing) {
      return res.status(404).json({ message: "Log not found" });
    }
    if (existing.userId !== userId) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const removed = await storage.deleteNutritionLog(id);
    if (!removed) {
      return res.status(404).json({ message: "Log not found" });
    }

    console.log(`🗑️  Nutrition log deleted - ID: ${id} for user ${userId}`);
    return res.status(204).send();
  } catch (error) {
    console.error("💥 Error deleting nutrition log:", error);
    return res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

import { Router } from "express";
const router = Router();
router.post("/", handleNutritionLogPost);
router.get("/", handleNutritionLogGet);
router.delete("/:id", handleNutritionLogDelete);

export default router;

