import { CalendarAccessError, CALENDAR_TOKEN_ERROR, CALENDAR_REAUTH_REQUIRED } from "./google-oauth";

interface GoogleEventDateTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleEventDateTime;
  end: GoogleEventDateTime;
  htmlLink?: string;
  status?: string;
}

interface EventsListResponse {
  items?: GoogleCalendarEvent[];
}

export interface FlightLike {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  link: string | null;
}

export interface Layover {
  arriveAt: string;
  departAt: string;
  durationMinutes: number;
  airportGuess: string | null;
  fromFlightId: string;
  toFlightId: string;
}

const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

/**
 * Fetches events from the user's primary Google Calendar between [timeMin, timeMax].
 * Throws CalendarAccessError on auth problems; other fetch/HTTP failures throw Error.
 */
export async function fetchUpcomingEvents(
  accessToken: string,
  timeMin: Date,
  timeMax: Date,
): Promise<GoogleCalendarEvent[]> {
  const url = new URL(EVENTS_URL);
  url.searchParams.set("timeMin", timeMin.toISOString());
  url.searchParams.set("timeMax", timeMax.toISOString());
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");

  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (resp.status === 401 || resp.status === 403) {
    throw new CalendarAccessError(CALENDAR_REAUTH_REQUIRED, "Google rejected the access token");
  }
  if (!resp.ok) {
    console.error("[google-calendar] events.list failed:", resp.status, await resp.text().catch(() => ""));
    throw new CalendarAccessError(CALENDAR_TOKEN_ERROR, "Calendar API request failed");
  }

  const json = (await resp.json()) as EventsListResponse;
  return json.items ?? [];
}

// Matches airline+flight-number strings like "UA 123", "DL1234", "BA 2490", plus common
// flight-ish keywords and directional arrows. Intentionally liberal — false positives
// are easy to filter client-side, false negatives hide trips entirely.
const FLIGHT_TITLE_REGEX = /(\bflight\b|\bfly\b|✈|→|->|(?:^|\W)[A-Z]{2,3}\s?\d{2,4}(?:\W|$))/i;

function looksLikeFlight(event: GoogleCalendarEvent): boolean {
  const summary = event.summary ?? "";
  const location = event.location ?? "";
  if (FLIGHT_TITLE_REGEX.test(summary)) return true;
  if (/\bairport\b/i.test(location)) return true;
  if (/\bairport\b/i.test(summary)) return true;
  // Bare IATA code in location like "SFO" or "JFK Airport"
  if (/^\s*[A-Z]{3}\b/.test(location.trim())) return true;
  return false;
}

function extractStart(event: GoogleCalendarEvent): string | null {
  return event.start.dateTime ?? event.start.date ?? null;
}
function extractEnd(event: GoogleCalendarEvent): string | null {
  return event.end.dateTime ?? event.end.date ?? null;
}

export function detectFlights(events: GoogleCalendarEvent[]): FlightLike[] {
  return events
    .filter(e => e.status !== "cancelled")
    .filter(looksLikeFlight)
    .map(e => {
      const start = extractStart(e);
      const end = extractEnd(e);
      if (!start || !end) return null;
      return {
        id: e.id,
        summary: e.summary ?? "(no title)",
        start,
        end,
        location: e.location ?? null,
        link: e.htmlLink ?? null,
      } as FlightLike;
    })
    .filter((f): f is FlightLike => f !== null)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

const MIN_LAYOVER_MIN = 2 * 60;       // 2h
const MAX_LAYOVER_MIN = 36 * 60;      // 36h

export function computeLayovers(flights: FlightLike[]): Layover[] {
  const out: Layover[] = [];
  for (let i = 0; i < flights.length - 1; i++) {
    const a = flights[i];
    const b = flights[i + 1];
    const gapMin = Math.round((new Date(b.start).getTime() - new Date(a.end).getTime()) / 60_000);
    if (gapMin < MIN_LAYOVER_MIN || gapMin > MAX_LAYOVER_MIN) continue;
    out.push({
      arriveAt: a.end,
      departAt: b.start,
      durationMinutes: gapMin,
      airportGuess: a.location ?? null,
      fromFlightId: a.id,
      toFlightId: b.id,
    });
  }
  return out;
}
