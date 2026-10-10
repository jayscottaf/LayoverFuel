import { Router } from "express";
import { nearbyInputSchema } from "@shared/nearby-meals";
import { researchNearbyMeals } from "../../services/nearby-meals-service";

const router = Router();
router.post("/", async (req, res) => {
  if (!req.session.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
  const input = nearbyInputSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json({ message: "Enter a city, neighborhood or airport (3 to 160 characters)." }); return; }
  if (!process.env.OPENAI_API_KEY) { res.status(503).json({ message: "Live menu search is unavailable. Your saved plan and meal logger still work." }); return; }
  const controller = new AbortController();
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.once("close", cancel);
  try {
    res.json(await researchNearbyMeals(input.data, controller.signal));
  } catch (error) {
    if (controller.signal.aborted) return;
    console.error("Nearby menu research failed", error instanceof Error ? error.name : "unknown");
    res.status(502).json({ message: "Live menus could not be checked. Try again or enter a more specific neighborhood or airport terminal." });
  } finally { res.off("close", cancel); }
});
export default router;
