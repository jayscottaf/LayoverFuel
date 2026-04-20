import passport from "passport";
import { Strategy as GoogleStrategy, type Profile, type VerifyCallback } from "passport-google-oauth20";
import type { User } from "@shared/schema";
import { storage } from "../storage";
import { env, googleOAuthConfigured } from "../config/env";

export const GOOGLE_LOGIN_STRATEGY = "google-login";
export const GOOGLE_CALENDAR_STRATEGY = "google-calendar";

const CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

export const LOGIN_SCOPES = ["openid", "email", "profile"];
export const CALENDAR_SCOPES = [...LOGIN_SCOPES, CALENDAR_READONLY_SCOPE];

const LOGIN_CALLBACK_PATH = "/api/auth/google/callback";
const CALENDAR_CALLBACK_PATH = "/api/auth/google/calendar/callback";

export const googleLoginCallbackUrl = () => `${env.APP_URL}${LOGIN_CALLBACK_PATH}`;
export const googleCalendarCallbackUrl = () => `${env.APP_URL}${CALENDAR_CALLBACK_PATH}`;

function verifiedEmailFromProfile(profile: Profile): string | null {
  const primary = profile.emails?.find(e => e.verified !== false);
  return primary?.value?.toLowerCase() ?? null;
}

async function loginVerify(
  _accessToken: string,
  _refreshToken: string | undefined,
  profile: Profile,
  done: VerifyCallback,
): Promise<void> {
  try {
    const googleId = profile.id;
    const email = verifiedEmailFromProfile(profile);
    const name = profile.displayName || profile.name?.givenName || null;
    const avatarUrl = profile.photos?.[0]?.value ?? null;

    // 1. Existing row with this googleId — just log them in
    const byGoogleId = await storage.getUserByGoogleId(googleId);
    if (byGoogleId) {
      // Refresh avatar if it changed
      if (avatarUrl && avatarUrl !== byGoogleId.avatarUrl) {
        await storage.updateUser(byGoogleId.id, { avatarUrl });
      }
      return done(null, byGoogleId as User);
    }

    if (!email) {
      return done(null, false, { message: "Google account has no verified email" });
    }

    // 2. Existing row with matching email — auto-link
    const byEmail = await storage.getUserByEmail(email);
    if (byEmail) {
      const updated = await storage.updateUser(byEmail.id, {
        googleId,
        avatarUrl: avatarUrl ?? byEmail.avatarUrl ?? null,
      });
      return done(null, (updated ?? byEmail) as User);
    }

    // 3. Brand-new user
    const created = await storage.createUser({
      email,
      password: null,
      name,
      googleId,
      avatarUrl,
    } as any);
    return done(null, created as User);
  } catch (err) {
    return done(err as Error);
  }
}

async function calendarVerify(
  req: Express.Request,
  accessToken: string,
  refreshToken: string | undefined,
  params: { expires_in?: number },
  _profile: Profile,
  done: VerifyCallback,
): Promise<void> {
  try {
    const userId = (req.session as any)?.userId as number | undefined;
    if (!userId) {
      return done(null, false, { message: "Not logged in" });
    }
    const user = await storage.getUser(userId);
    if (!user) {
      return done(null, false, { message: "User not found" });
    }

    const expiresIn = params.expires_in ?? 3600;
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const updated = await storage.updateGoogleTokens(userId, {
      accessToken,
      refreshToken: refreshToken ?? null,
      expiresAt,
      connectedAt: new Date(),
    });
    return done(null, (updated ?? user) as User);
  } catch (err) {
    return done(err as Error);
  }
}

let registered = false;

export function registerGoogleStrategies(): boolean {
  if (registered) return true;
  if (!googleOAuthConfigured) {
    console.warn("[auth] Google OAuth not configured — skipping strategy registration");
    return false;
  }

  passport.use(
    GOOGLE_LOGIN_STRATEGY,
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: googleLoginCallbackUrl(),
      },
      loginVerify,
    ),
  );

  passport.use(
    GOOGLE_CALENDAR_STRATEGY,
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: googleCalendarCallbackUrl(),
        passReqToCallback: true,
      },
      calendarVerify as any,
    ),
  );

  registered = true;
  return true;
}
