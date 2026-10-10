import type { RequestHandler } from "express";

export const accountBoundary: RequestHandler = (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const expected = req.get("X-Account-Id");
  if (expected && Number(expected) !== req.session.userId) {
    res.status(409).json({ message: "Your signed-in account changed. Reload before continuing." }); return;
  }
  next();
};

export const retiredAssistant: RequestHandler = (req, res) => {
  if (!req.session.userId) { res.status(401).json({ message: "Unauthorized" }); return; }
  res.status(410).json({ message: "The legacy coach has been retired. Use the meal logger to record or estimate food." });
};

export function accountRateLimit(maximum = 20, windowMs = 60_000): RequestHandler {
  const windows = new Map<number, { count: number; until: number }>();
  return (req, res, next) => {
    const userId = req.session.userId;
    if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }
    const now = Date.now();
    for (const [id, entry] of Array.from(windows)) if (entry.until <= now) windows.delete(id);
    const window = windows.get(userId) ?? { count: 0, until: now + windowMs };
    if (++window.count > maximum) {
      res.setHeader("Retry-After", String(Math.ceil((window.until - now) / 1000)));
      res.status(429).json({ message: "Please wait a moment before another estimate." }); return;
    }
    windows.set(userId, window);
    next();
  };
}
