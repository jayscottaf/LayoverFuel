import { researchNearbyMeals } from "../server/services/nearby-meals-service";

try {
  // Exercise city-to-airport resolution and airport directories, including
  // restaurant-only results when an individual menu cannot be confirmed.
  const result = await researchNearbyMeals({ area: "North Charleston, South Carolina, United States of America", kind: "airport" });
  if (result.airport?.code !== "CHS" || !result.meals.length && !result.places?.length) {
    throw new Error("No sourced CHS airport food choices returned");
  }
  console.log(`Nearby food provider ready: ${result.meals.length} meals and ${result.places?.length ?? 0} places for public CHS airport test area.`);
  for (const meal of result.meals) console.log(JSON.stringify({ venue: meal.venue, address: meal.address, item: meal.name, menuSource: meal.menuUrl, locationSource: meal.locationUrl }));
  for (const place of result.places ?? []) console.log(JSON.stringify({ venue: place.venue, address: place.address, locationSource: place.locationUrl }));
} catch (error) {
  console.error("Nearby menu provider check failed:", error instanceof Error ? error.name : "unknown");
  process.exitCode = 1;
}
