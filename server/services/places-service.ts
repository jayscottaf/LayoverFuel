import { z } from "zod";

// Google Maps lookups for the plan's location field. The key stays on the server; the
// browser sends only what was typed, or one-time coordinates, and nothing is stored.

export const placesConfigured = () => !!process.env.GOOGLE_MAPS_API_KEY;

export const autocompleteInputSchema = z.object({
  input: z.string().trim().min(2).max(120),
  sessionToken: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
}).strict();

export const reverseInputSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();

export interface PlaceSuggestion { label: string; main: string; secondary: string }

// Cities, towns, neighbourhoods, ZIP codes and airports: places a traveller eats near.
const SUGGESTION_TYPES = ["locality", "sublocality", "neighborhood", "postal_code", "airport"];
// Most specific first; rural spots outside any locality fall back to the town.
const REVERSE_TYPES = "neighborhood|sublocality|locality|postal_code|administrative_area_level_3";

const autocompleteResponse = z.object({
  suggestions: z.array(z.object({
    placePrediction: z.object({
      text: z.object({ text: z.string() }),
      structuredFormat: z.object({
        mainText: z.object({ text: z.string() }),
        secondaryText: z.object({ text: z.string() }).optional(),
      }).optional(),
    }).optional(),
  })).default([]),
});

const geocodeResponse = z.object({
  status: z.string(),
  results: z.array(z.object({ formatted_address: z.string() })).default([]),
});

export async function placeSuggestions(input: z.infer<typeof autocompleteInputSchema>, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": process.env.GOOGLE_MAPS_API_KEY ?? "" },
    body: JSON.stringify({ input: input.input, sessionToken: input.sessionToken, includedPrimaryTypes: SUGGESTION_TYPES, languageCode: "en" }),
    signal: anySignal(signal, 8_000),
  });
  if (!response.ok) throw new Error(`Places autocomplete returned ${response.status}`);
  const { suggestions } = autocompleteResponse.parse(await response.json());
  return suggestions.flatMap(({ placePrediction: p }) => p ? [{
    label: p.text.text.slice(0, 160),
    main: (p.structuredFormat?.mainText.text ?? p.text.text).slice(0, 120),
    secondary: (p.structuredFormat?.secondaryText?.text ?? "").slice(0, 120),
  }] : []).slice(0, 5);
}

export async function areaForCoordinates(input: z.infer<typeof reverseInputSchema>, signal?: AbortSignal): Promise<string> {
  const query = new URLSearchParams({
    latlng: `${input.latitude},${input.longitude}`, result_type: REVERSE_TYPES, language: "en",
    key: process.env.GOOGLE_MAPS_API_KEY ?? "",
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${query}`, { signal: anySignal(signal, 8_000) });
  if (!response.ok) throw new Error(`Geocoding returned ${response.status}`);
  const data = geocodeResponse.parse(await response.json());
  if (data.status === "ZERO_RESULTS") throw new AreaNotFound();
  if (data.status !== "OK") throw new Error(`Geocoding status ${data.status}`);
  if (!data.results[0]) throw new AreaNotFound();
  return data.results[0].formatted_address.slice(0, 160);
}

export class AreaNotFound extends Error {}

function anySignal(signal: AbortSignal | undefined, timeoutMs: number) {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}
