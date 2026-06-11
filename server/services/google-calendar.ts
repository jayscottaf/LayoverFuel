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

// Multi-pattern flight detection. Crew calendars (CrewLounge, AIMS, CrewTrac,
// PBS, FltDeck Calendar, etc.) use a variety of title formats — we accept all
// of these and intentionally err toward false positives, which are easy to
// filter visually but false negatives hide whole trips.
//
// Recognized:
//   - English keywords: flight, fly, depart, arrive, dep, arr
//   - Arrows / plane glyphs: ✈, →, ->, –, —
//   - Airline + flight number: "DL1234", "UA 456", "AA  2490"
//   - IATA airport pair: "ATL-LAX", "ATL → LAX", "ATL/LAX", "DEN-MIA"
//   - Crew shorthand: "RPT 0530" (report), "STDBY", "DH" (deadhead),
//     "TURN" (turn), "OVNT" (overnight)
const FLIGHT_PATTERNS: RegExp[] = [
  /\bflight\b|\bfly\b|\bdepart\b|\barrive\b|\bdep\b|\barr\b/i,
  /✈|→|->|–|—/,
  /(?:^|\W)[A-Z]{2,3}\s?\d{2,4}(?:\W|$)/, // carrier + flight number
  /\b[A-Z]{3}\s*[-→/]\s*[A-Z]{3}\b/,      // IATA airport pair
  /\b(?:RPT|STDBY|DH|TURN|OVNT|RON|DUTY)\b/i,
];

function looksLikeFlight(event: GoogleCalendarEvent): boolean {
  const summary = event.summary ?? "";
  const location = event.location ?? "";
  const haystack = `${summary} ${location}`;
  if (FLIGHT_PATTERNS.some(re => re.test(haystack))) return true;
  if (/\bairport\b/i.test(haystack)) return true;
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
