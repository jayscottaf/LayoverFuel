import { researchNearbyMeals } from "../server/services/nearby-meals-service";

try {
  const result = await researchNearbyMeals({ area: "Downtown Nashville, Tennessee, USA", kind: "restaurant" });
  if (!result.meals.length) throw new Error("No grounded menu choices returned");
  console.log(`Nearby menu provider ready: ${result.meals.length} sourced choices for public Nashville test area.`);
  for (const meal of result.meals) console.log(JSON.stringify({ venue: meal.venue, address: meal.address, item: meal.name, menuSource: meal.menuUrl, locationSource: meal.locationUrl }));
} catch (error) {
  console.error("Nearby menu provider check failed:", error instanceof Error ? error.name : "unknown");
  process.exitCode = 1;
}
