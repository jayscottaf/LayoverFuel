import { sumNutrients, type Nutrients } from "@shared/nutrition";
import { travelContextSchema, type PlanMeal, type TravelContext, type TravelPlan } from "@shared/travel-plan";

type MealLog = Partial<Record<keyof Nutrients, number | null>> & { planMealId?: string | null };
type Idea = { name: string; description: string; calories: number; protein: number; carbs: number; fat: number; excludes?: string[] };
const ideas: Record<TravelContext["pattern"], Idea[]> = {
  hotel: [
    { name: "Oats, fruit and seeds", description: "A bowl of oats with fruit and seeds. Confirm ingredients and portions at the breakfast buffet.", calories: 450, protein: 15, carbs: 65, fat: 14 },
    { name: "Bean, rice and vegetable bowl", description: "Rice, beans and vegetables with dressing on the side. Check ingredients before ordering.", calories: 600, protein: 22, carbs: 90, fat: 17 },
    { name: "Lentil and vegetable plate", description: "Lentils, vegetables and potatoes. A general meal idea, not a verified restaurant order.", calories: 550, protein: 25, carbs: 80, fat: 15 },
  ],
  groceries: [
    { name: "Fruit, oats and seeds", description: "A simple breakfast assembled from labeled grocery items. Use gluten-free oats when needed.", calories: 450, protein: 15, carbs: 65, fat: 14 },
    { name: "Ready-to-eat lentil salad", description: "Ready-to-eat lentils with washed vegetables and dressing. Choose a single-serving pack if you cannot refrigerate leftovers.", calories: 520, protein: 25, carbs: 65, fat: 18 },
    { name: "Bean and grain bowl", description: "Ready-to-eat grain and bean pouches with vegetables. Check the package for preparation and storage instructions.", calories: 610, protein: 24, carbs: 95, fat: 16 },
  ],
  packed: [
    { name: "Oat and seed breakfast", description: "Pack a labeled oat breakfast with fruit. Follow the label's preparation instructions.", calories: 440, protein: 14, carbs: 65, fat: 14 },
    { name: "Bean and vegetable lunch", description: "A prepared bean, grain and vegetable meal. Use an insulated bag and follow safe storage instructions.", calories: 600, protein: 24, carbs: 85, fat: 19 },
    { name: "Lentil and rice meal", description: "A ready-to-eat lentil and rice meal with vegetables. Check storage and preparation requirements.", calories: 580, protein: 23, carbs: 88, fat: 17 },
  ],
};

export function buildTravelPlan(input: {
  date: string; timezone: string; revision?: number; context?: TravelContext;
  savedMeals?: PlanMeal[]; logs: MealLog[]; targets: Nutrients; restrictions?: string[];
}): TravelPlan {
  const context = travelContextSchema.parse(input.context ?? {});
  const consumed = sumNutrients(input.logs);
  const remaining = { ...input.targets };
  for (const key of Object.keys(remaining) as (keyof Nutrients)[]) remaining[key] -= consumed[key];
  const eatenIds = new Set(input.logs.map(log => log.planMealId).filter(Boolean));
  const locked = (input.savedMeals ?? []).filter(meal => meal.status === "locked" && !eatenIds.has(meal.id));
  // These templates are estimates, not an allergy-screened menu database.
  const unsupportedRestrictions = (input.restrictions ?? []).filter(restriction =>
    !["none", "vegetarian", "vegan", "dairy-free", "dairy free"].includes(restriction.trim().toLowerCase()));
  const slots = Math.max(0, 3 - input.logs.length - locked.length);
  const reserved = sumNutrients(locked);
  const available = remaining.calories - reserved.calories;
  const candidates = ideas[context.pattern];
  const selected = unsupportedRestrictions.length ? [] : candidates
    .map((idea, index): PlanMeal => ({ ...idea, id: `${context.pattern}-${index}`, status: "planned", source: "estimate" }))
    .filter(meal => !eatenIds.has(meal.id) && !locked.some(saved => saved.id === meal.id))
    .sort((a, b) => available > 0 && slots > 0
      ? Math.abs(a.calories - available / slots) - Math.abs(b.calories - available / slots) : 0)
    .slice(0, slots);
  let message = "Based on logged meals. Meal ideas are estimates; nearby availability has not been checked.";
  if (input.logs.length) message = "Updated from your logged meals. Locked choices are unchanged. " + message;
  if (remaining.calories < 0) message += " Your daily target is unchanged; there is no need to compensate by skipping meals.";
  if (unsupportedRestrictions.length) message += " Generic suggestions are paused for your dietary restrictions. Add a meal you know works for you.";
  return {
    date: input.date, timezone: input.timezone, revision: input.revision ?? 0,
    context, targets: input.targets, consumed, remaining, meals: [...locked, ...selected], message, coverage: "generic",
  };
}
