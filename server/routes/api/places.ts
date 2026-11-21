import { Router } from "express";
import {
  AreaNotFound, areaForCoordinates, autocompleteInputSchema, placeSuggestions, placesConfigured, reverseInputSchema,
} from "../../services/places-service";

// POST bodies keep typed text and coordinates out of proxy request logs.
const router = Router();

router.get("/config", (req, res) => {
  if (!req.session.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
  res.json({ google: placesConfigured() });
});

router.post("/autocomplete", async (req, res) => {
  if (!req.session.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
  if (!placesConfigured()) { res.status(503).json({ message: "Place suggestions are unavailable." }); return; }
  const input = autocompleteInputSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json({ message: "Type at least two characters." }); return; }
  try {
    res.json({ suggestions: await placeSuggestions(input.data) });
  } catch (error) {
    console.error("Place suggestions failed", error instanceof Error ? error.message : "unknown");
    res.status(502).json({ message: "Place suggestions are unavailable. Keep typing your area." });
  }
});

router.post("/reverse", async (req, res) => {
  if (!req.session.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
  if (!placesConfigured()) { res.status(503).json({ message: "The area lookup is unavailable. Enter a city instead." }); return; }
  const input = reverseInputSchema.safeParse(req.body);
  if (!input.success) { res.status(400).json({ message: "Invalid device location. Enter a city instead." }); return; }
  try {
    res.json({ area: await areaForCoordinates(input.data) });
  } catch (error) {
    if (error instanceof AreaNotFound) { res.status(404).json({ message: "No city was found. Enter an area instead." }); return; }
    console.error("Area lookup failed", error instanceof Error ? error.message : "unknown");
    res.status(502).json({ message: "The area lookup is unavailable. Enter a city instead." });
  }
});

export default router;
