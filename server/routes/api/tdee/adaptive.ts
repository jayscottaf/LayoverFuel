import { Request, Response, Router } from "express";
import { calculateAdaptiveTDEE } from "../../../services/adaptive-tdee-service";

export async function handleAdaptiveTDEEGet(req: Request, res: Response) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    // Get days parameter from query (default 14)
    const days = parseInt(req.query.days as string) || 14;

    const result = await calculateAdaptiveTDEE(userId, days);

    if (!result) {
      // Return null if insufficient data
      return res.status(200).json(null);
    }

    res.status(200).json(result);
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