import { Request, Response } from "express";
import { storage } from "../../../storage";
import { z } from "zod";
import { insertNutritionLogSchema } from "@shared/schema";

// Validation schema for client requests (without userId)
const clientNutritionLogSchema = insertNutritionLogSchema.omit({ userId: true });

// GET nutrition logs
export async function handleNutritionLogGet(req: Request, res: Response) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const logs = await storage.getNutritionLogs(req.session.userId);
    res.status(200).json(logs);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}

// POST nutrition log
export async function handleNutritionLogPost(req: Request, res: Response) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { date, ...logData } = clientNutritionLogSchema.parse(req.body);
    const logDate = date ? new Date(date) : new Date();

    // Check if a log already exists for this date
    const existingLog = await storage.getNutritionLogByDate(req.session.userId, logDate);

    let nutritionLog;
    if (existingLog) {
      // Update existing log
      nutritionLog = await storage.updateNutritionLog(existingLog.id, logData);
    } else {
      // Create new log
      nutritionLog = await storage.createNutritionLog({
        date: logDate.toISOString().split('T')[0],
        userId: req.session.userId,
        ...logData,
      });
    }

    res.status(200).json(nutritionLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid input", errors: error.errors });
    }
    res.status(500).json({ message: "Server error" });
  }
}

export default {
  handleNutritionLogGet,
  handleNutritionLogPost
};