import { Request, Response, Router } from "express";
import { storage } from "../../../storage";
import { calculateAdaptiveTDEE } from "../../../services/adaptive-tdee-service";
import { calculateTDEE } from "../../../services/tdee-service";

export async function handleAdaptiveTDEEGet(req: Request, res: Response) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const days = parseInt(req.query.days as string) || 14;
    const result = await calculateAdaptiveTDEE(userId, days);

    if (result) {
      return res.status(200).json({ ...result, source: "adaptive" });
    }

    // Insufficient adaptive data — fall back to the formula estimate so the
    // user sees a useful number on day 1 instead of an empty "unlock at 7+
    // days" gate. The client decides how to label confidence.
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(200).json(null);
    }
    const formulaTDEE = user.tdee ?? calculateTDEE(user);

    // Count days of nutrition logs to drive a progress indicator.
    const allNutrition = await storage.getNutritionLogs(userId);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const recentDays = new Set(
      allNutrition
        .filter(l => new Date(l.date) >= startDate && l.calories)
        .map(l => String(l.date))
    ).size;

    return res.status(200).json({
      source: "formula",
      value: formulaTDEE,
      formulaTDEE,
      difference: 0,
      confidence: "low",
      daysOfData: recentDays,
      requiredDaysForAdaptive: 7,
    });
  } catch (error) {
    console.error("💥 Error calculating adaptive TDEE:", error);
    res.status(500).json({
      message: "Server error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const router = Router();
router.get("/", handleAdaptiveTDEEGet);

export default router;