
import { Request, Response } from "express";
import { storage } from "../../../storage";

export async function handleNutritionLogPost(req: Request, res: Response) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  try {
    const { date, ...logData } = req.body;
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
        date: logDate.toISOString().split('T')[0], // Format date as string
        userId: req.session.userId,
        ...logData,
      });
    }
    
    res.status(200).json(nutritionLog);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
}
