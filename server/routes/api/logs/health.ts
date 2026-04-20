import { Request, Response, Router } from "express";
import { storage } from "../../../storage";
import { insertHealthLogSchema } from "../../../../shared/schema";
import { z } from "zod";

// Create a modified schema that makes userId optional for client requests
const ClientHealthLogSchema = insertHealthLogSchema
  .omit({ userId: true })
  .merge(z.object({
    userId: z.number().optional()
  }));

export async function handleHealthLogPost(req: Request, res: Response) {
  console.log("📊 Health log POST received");

  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Validate incoming request with the client schema (userId optional)
    const clientData = ClientHealthLogSchema.parse(req.body);

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

    // Check if log exists for this date and update it, otherwise create new
    const existingLog = await storage.getHealthLogByDate(userId, logDate);

    let healthLog;
    if (existingLog) {
      // Update existing log with new data
      healthLog = await storage.updateHealthLog(existingLog.id, {
        ...logData,
        date: formattedDate,
      });
      console.log(`✅ Health log updated - ID: ${existingLog.id} for user ${userId}`);
    } else {
      // Create new log
      healthLog = await storage.createHealthLog({
        ...logData,
        date: formattedDate,
        userId,
      });
      console.log(`✅ Health log saved - ID: ${healthLog.id} for user ${userId}`);
    }

    res.status(200).json(healthLog);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.flatten());
      return res.status(400).json({ message: "Validation failed", issues: error.flatten() });
    }
    console.error("💥 Server error while logging health:", error);
    res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function handleHealthLogGet(req: Request, res: Response) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { date, start, end } = req.query;

    // If specific date requested
    if (date && typeof date === 'string') {
      const logDate = new Date(date);
      const log = await storage.getHealthLogByDate(userId, logDate);
      return res.status(200).json(log || null);
    }

    // If date range requested
    if (start && end && typeof start === 'string' && typeof end === 'string') {
      const allLogs = await storage.getHealthLogs(userId);
      const filtered = allLogs.filter(log => {
        const logDate = new Date(log.date);
        return logDate >= new Date(start) && logDate <= new Date(end);
      });
      return res.status(200).json(filtered);
    }

    // Default: return all logs
    const logs = await storage.getHealthLogs(userId);
    res.status(200).json(logs);
  } catch (error) {
    console.error("💥 Error fetching health logs:", error);
    res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const router = Router();
router.post("/", handleHealthLogPost);
router.get("/", handleHealthLogGet);

export default router;
