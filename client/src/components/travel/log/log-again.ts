import {
  MEAL_CONTEXT_LABELS,
  SOURCE_LABELS,
  logDisplayName,
  logSlot,
  logSource,
  nonNeg,
  suggestSlot,
  sumMacros,
  type Macros,
  type MealContext,
  type NutritionDraft,
  type NutritionItem,
  type NutritionLog,
  type NutritionSource,
} from "../api";
import { localHour } from "../local-date";

export function isNutritionSource(v: unknown): v is NutritionSource {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(SOURCE_LABELS, v);
}

export function isMealContextValue(v: unknown): v is MealContext {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(MEAL_CONTEXT_LABELS, v);
}

export function logMacros(log: Macros): Macros {
  return {
    calories: nonNeg(log.calories),
    protein: nonNeg(log.protein),
    carbs: nonNeg(log.carbs),
    fat: nonNeg(log.fat),
  };
}

/**
 * A reviewable copy of a logged meal for today. It carries no clientRequestId,
 * so the capture flow issues a fresh one; nothing is saved until the user
 * confirms in review.
 */
export function logAgainDraft(log: NutritionLog, today: string, timezone: string): Partial<NutritionDraft> {
  const name = logDisplayName(log);
  const logged = logMacros(log);
  const items: NutritionItem[] = log.items?.length
    ? log.items.map(i => ({
        name: typeof i.name === "string" ? i.name : "",
        quantity: nonNeg(i.quantity) || 1,
        unit: typeof i.unit === "string" && i.unit.trim() ? i.unit : "serving",
        ...logMacros(i),
        source: isNutritionSource(i.source) ? i.source : "estimate",
      }))
    : [{ name, quantity: 1, unit: "serving", ...logged, source: logSource(log) ?? "estimate" }];
  const totals = sumMacros(items);
  return {
    date: today,
    mealStyle: logSlot(log) ?? suggestSlot(localHour(timezone)),
    name,
    items,
    totals,
    context: isMealContextValue(log.context) ? log.context : undefined,
    origin: "recent",
  };
}
