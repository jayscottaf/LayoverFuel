import { storage } from "../storage";
import { env } from "../config/env";

export const CALENDAR_NOT_CONNECTED = "CALENDAR_NOT_CONNECTED";
export const CALENDAR_REAUTH_REQUIRED = "CALENDAR_REAUTH_REQUIRED";
export const CALENDAR_TOKEN_ERROR = "CALENDAR_TOKEN_ERROR";

const REFRESH_SKEW_MS = 60_000;

export class CalendarAccessError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
    this.name = "CalendarAccessError";
  }
}

interface RefreshTokenResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

interface RefreshTokenError {
  error: string;
  error_description?: string;
}

/**
 * Returns a valid Google OAuth access token for the given user, refreshing it
 * if necessary. Throws CalendarAccessError when the user has not connected
 * calendar or when the refresh token itself has been revoked.
 */
export async function getValidAccessToken(userId: number): Promise<string> {
  const user = await storage.getUser(userId);
  if (!user) {
    throw new CalendarAccessError(CALENDAR_NOT_CONNECTED, "User not found");
  }
  if (!user.googleRefreshToken) {
    throw new CalendarAccessError(CALENDAR_NOT_CONNECTED, "Calendar not connected");
  }

  const expiresAt = user.googleTokenExpiresAt?.getTime() ?? 0;
  if (user.googleAccessToken && expiresAt > Date.now() + REFRESH_SKEW_MS) {
    return user.googleAccessToken;
  }

  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: user.googleRefreshToken,
  });

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    let parsed: RefreshTokenError | null = null;
    try {
      parsed = (await resp.json()) as RefreshTokenError;
    } catch {
      /* ignore JSON parse errors */
    }
    if (parsed?.error === "invalid_grant") {
      await storage.clearGoogleTokens(userId);
      throw new CalendarAccessError(
        CALENDAR_REAUTH_REQUIRED,
        "Google refresh token was revoked or expired",
      );
    }
    console.error("[google-oauth] Token refresh failed:", resp.status, parsed);
    throw new CalendarAccessError(CALENDAR_TOKEN_ERROR, "Failed to refresh access token");
  }

  const json = (await resp.json()) as RefreshTokenResponse;
  const newExpiresAt = new Date(Date.now() + json.expires_in * 1000);
  await storage.updateGoogleTokens(userId, {
    accessToken: json.access_token,
    expiresAt: newExpiresAt,
  });
  return json.access_token;
}
