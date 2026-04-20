import { Router, type Request, type Response } from "express";
import { storage } from "../../storage";
import {
  CalendarAccessError,
  CALENDAR_NOT_CONNECTED,
  CALENDAR_REAUTH_REQUIRED,
  getValidAccessToken,
} from "../../services/google-oauth";
import {
  computeLayovers,
  detectFlights,
  fetchUpcomingEvents,
} from "../../services/google-calendar";

const router = Router();

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

router.get("/upcoming", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  if (!user.googleRefreshToken) {
    return res.status(200).json({ connected: false, flights: [], layovers: [] });
  }

  try {
    const accessToken = await getValidAccessToken(user.id);
    const now = new Date();
    const timeMax = new Date(now.getTime() + SEVEN_DAYS_MS);
    const events = await fetchUpcomingEvents(accessToken, now, timeMax);
    const flights = detectFlights(events);
    const layovers = computeLayovers(flights);
    return res.status(200).json({ connected: true, flights, layovers });
  } catch (err) {
    if (err instanceof CalendarAccessError) {
      if (err.code === CALENDAR_NOT_CONNECTED) {
        return res.status(200).json({ connected: false, flights: [], layovers: [] });
      }
      if (err.code === CALENDAR_REAUTH_REQUIRED) {
        return res
          .status(409)
          .json({ code: CALENDAR_REAUTH_REQUIRED, message: "Please reconnect Google Calendar" });
      }
    }
    console.error("[itinerary] Failed to fetch upcoming events:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

export default router;
