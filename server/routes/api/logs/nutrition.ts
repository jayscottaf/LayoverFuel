import { Request, Response, Router } from "express";
import { z } from "zod";
import { createHash } from "node:crypto";
import { storage } from "../../../storage";
import { dateKeySchema, dateKeyToDate } from "@shared/dates";
import { nutritionInputSchema, nutritionPatchSchema, sumNutrients } from "@shared/nutrition";

function fail(res: Response, error: unknown) {
  if (error instanceof z.ZodError) return res.status(400).json({ message: "Check the meal fields", issues: error.flatten() });
  console.error("Nutrition request failed", error);
  return res.status(500).json({ message: "Unable to save or retrieve this meal. Please retry." });
}

export async function handleNutritionLogPost(req: Request, res: Response) {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  try {
    const input = nutritionInputSchema.parse(req.body);
    const data = input.items?.length ? { ...input, ...sumNutrients(input.items) } : input;
    const requestFingerprint = createHash("sha256").update(JSON.stringify(data)).digest("hex");
    const saved = await storage.createNutritionLog({ ...data, requestFingerprint, userId });
    if (saved.requestFingerprint !== requestFingerprint) return res.status(409).json({ message: "This request ID belongs to a different meal. Start a new meal entry." });
    if (saved.deletedAt) return res.status(409).json({ message: "This request was already saved and removed. Use a new request to log it again." });
    return res.json(saved);
  } catch (error) { return fail(res, error); }
}

export async function handleNutritionLogGet(req: Request, res: Response) {
  const userId = req.session?.userId;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  try {
    if (req.query.date !== undefined) {
      const date = dateKeySchema.parse(req.query.date);
      return res.json(await storage.getNutritionLogsByDate(userId, dateKeyToDate(date)));
    }
    let logs = await storage.getNutritionLogs(userId);
    if (req.query.start !== undefined || req.query.end !== undefined) {
      const start = dateKeySchema.parse(req.query.start);
      const end = dateKeySchema.parse(req.query.end);
      if (end < start) return res.status(400).json({ message: "End date must follow start date" });
      logs = logs.filter(log => log.date >= start && log.date <= end);
    }
    return res.json(logs.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id));
  } catch (error) { return fail(res, error); }
}

async function ownedLog(req: Request, res: Response) {
  if (!req.session?.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ message: "Invalid meal ID" }); return; }
  const log = await storage.getNutritionLogById(id);
  if (!log || log.userId !== req.session.userId) { res.status(404).json({ message: "Meal not found" }); return; }
  return log;
}

export async function handleNutritionLogPatch(req: Request, res: Response) {
  try {
    const log = await ownedLog(req, res);
    if (!log) return;
    if (log.deletedAt) return res.status(404).json({ message: "Meal not found" });
    const input = nutritionPatchSchema.parse(req.body);
    const hasTotals = ["calories", "protein", "carbs", "fat"].some(key => key in input);
    const patch = input.items?.length ? { ...input, ...sumNutrients(input.items) }
      : hasTotals && !input.items ? { ...input, items: [] } : input;
    return res.json(await storage.updateNutritionLog(log.id, patch));
  } catch (error) { return fail(res, error); }
}

export async function handleNutritionLogDelete(req: Request, res: Response) {
  try {
    const log = await ownedLog(req, res);
    if (!log) return;
    await storage.deleteNutritionLog(log.id);
    return res.status(204).send();
  } catch (error) { return fail(res, error); }
}

const router = Router();
router.post("/", handleNutritionLogPost);
router.get("/", handleNutritionLogGet);
router.patch("/:id", handleNutritionLogPatch);
router.delete("/:id", handleNutritionLogDelete);
router.post("/:id/restore", async (req, res) => {
  try {
    const log = await ownedLog(req, res);
    if (!log) return;
    res.json(await storage.updateNutritionLog(log.id, { deletedAt: null }));
  } catch (error) { fail(res, error); }
});
export default router;
