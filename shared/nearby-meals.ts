import { z } from "zod";
import { nutrientsSchema } from "./nutrition";

export const nearbyInputSchema = z.object({
  area: z.string().trim().min(3).max(160),
  kind: z.enum(["restaurant", "grocery", "airport"]),
}).strict();
export type NearbyInput = z.infer<typeof nearbyInputSchema>;

// Search output is untrusted. A link must also occur in the search citations.
export function publicSourceUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !host.includes(".") || /^(\d+\.){3}\d+$/.test(host) || host.includes(":") ||
      /(^|\.)(localhost|local|internal|test|example|invalid)$/.test(host)) return null;
    // Search/map links identify a query, not a retrieved menu or branch page.
    if (/(^|\.)google\.[a-z.]+$/.test(host) && /^\/(maps|search)(\/|$)/.test(url.pathname) ||
      /(^|\.)(maps.apple.com|duckduckgo.com)$/.test(host) ||
      /(^|\.)(bing.com|yahoo.com|yelp.com)$/.test(host) && /^\/search(\/|$)/.test(url.pathname)) return null;
    if (/(^|\.)maps\.google\.[a-z.]+$/.test(host) || /banquet|catering|wedding|private[-_+% ]?(event|dining)/i.test(url.pathname)) return null;
    url.hash = "";
    return url.href;
  } catch { return null; }
}
const sourceUrlSchema = z.string().max(2000).refine(value => !!publicSourceUrl(value), "Public HTTPS source required");
export const nearbyCandidateSchema = nutrientsSchema.extend({
  venue: z.string().trim().min(1).max(100),
  address: z.string().trim().min(3).max(200),
  name: z.string().trim().min(1).max(100),
  order: z.string().trim().min(3).max(500),
  portion: z.string().trim().min(1).max(200),
  menuUrl: sourceUrlSchema,
  locationUrl: sourceUrlSchema,
  access: z.string().max(200),
});
export const nearbyResearchSchema = z.object({ meals: z.array(nearbyCandidateSchema).max(6) });
export type NearbyMeal = z.infer<typeof nearbyCandidateSchema> & { id: string };
export interface NearbyResults {
  area: string;
  kind: NearbyInput["kind"];
  checkedAt: string;
  meals: NearbyMeal[];
  sources: { title: string; url: string }[];
}

export function rankNearbyMeals(meals: NearbyMeal[], remainingCalories: number, slots: number, highProtein = false): NearbyMeal[] {
  const target = Math.max(300, remainingCalories / Math.max(1, slots));
  const score = (meal: NearbyMeal) => Math.abs(meal.calories - target) / target -
    (highProtein ? Math.min(meal.protein / Math.max(1, meal.calories) * 100, 10) / 5 : 0);
  return [...meals].sort((a, b) => score(a) - score(b));
}
