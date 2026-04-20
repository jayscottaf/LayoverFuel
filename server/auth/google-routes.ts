import { Router, type Request, type Response, type NextFunction } from "express";
import passport from "passport";
import { storage } from "../storage";
import { googleOAuthConfigured } from "../config/env";
import {
  GOOGLE_LOGIN_STRATEGY,
  GOOGLE_CALENDAR_STRATEGY,
  LOGIN_SCOPES,
  CALENDAR_SCOPES,
  registerGoogleStrategies,
} from "./google-strategies";
import type { User } from "@shared/schema";

const router = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.redirect("/auth/login");
  }
  next();
}

function ensureConfigured(_req: Request, res: Response, next: NextFunction) {
  if (!googleOAuthConfigured) {
    return res.status(503).json({ message: "Google OAuth is not configured on this server" });
  }
  if (!registerGoogleStrategies()) {
    return res.status(503).json({ message: "Google OAuth is not configured on this server" });
  }
  next();
}

// ─── Flow 1: Sign in with Google ──────────────────────────────────────────────

router.get(
  "/api/auth/google",
  ensureConfigured,
  (req, res, next) => {
    passport.authenticate(GOOGLE_LOGIN_STRATEGY, {
      scope: LOGIN_SCOPES,
      session: false,
    })(req, res, next);
  },
);

router.get(
  "/api/auth/google/callback",
  ensureConfigured,
  (req, res, next) => {
    passport.authenticate(GOOGLE_LOGIN_STRATEGY, {
      session: false,
      failureRedirect: "/auth/login?error=google",
    })(req, res, next);
  },
  (req: Request, res: Response) => {
    const user = req.user as User | undefined;
    if (!user) {
      return res.redirect("/auth/login?error=google");
    }
    req.session.userId = user.id;
    const isOnboardingComplete = Boolean(
      user.name && user.age && user.height && user.weight,
    );
    if (!isOnboardingComplete) {
      req.session.onboarding = {
        currentQuestion: {
          text: "Hi there! I'm your Layover Fuel fitness coach. I'll help you stay fit while traveling. Let's get to know each other better. What's your name?",
          field: "name",
        },
        userData: {},
      };
    }
    req.session.save(err => {
      if (err) {
        console.error("[auth] Failed to save session after Google login:", err);
        return res.redirect("/auth/login?error=session");
      }
      res.redirect("/");
    });
  },
);

// ─── Flow 2: Connect Google Calendar ──────────────────────────────────────────

router.get(
  "/api/auth/google/connect-calendar",
  ensureConfigured,
  requireAuth,
  (req, res, next) => {
    passport.authenticate(GOOGLE_CALENDAR_STRATEGY, {
      scope: CALENDAR_SCOPES,
      accessType: "offline",
      prompt: "consent",
      session: false,
      // Include the selected scopes in an "include_granted_scopes" hint so
      // Google offers incremental consent rather than re-prompting for email/profile.
      includeGrantedScopes: true,
    } as any)(req, res, next);
  },
);

router.get(
  "/api/auth/google/calendar/callback",
  ensureConfigured,
  requireAuth,
  (req, res, next) => {
    passport.authenticate(GOOGLE_CALENDAR_STRATEGY, {
      session: false,
      failureRedirect: "/profile?calendar=error",
    })(req, res, next);
  },
  (_req: Request, res: Response) => {
    res.redirect("/itinerary?calendar=connected");
  },
);

// ─── Disconnect ───────────────────────────────────────────────────────────────

router.post(
  "/api/integrations/google-calendar/disconnect",
  async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      await storage.clearGoogleTokens(req.session.userId);
      res.status(200).json({ message: "Disconnected" });
    } catch (err) {
      console.error("[auth] Failed to clear Google tokens:", err);
      res.status(500).json({ message: "Server error" });
    }
  },
);

export default router;
