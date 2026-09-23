import test from "node:test";
import assert from "node:assert/strict";
import { localDateKey, dateKeySchema, dateKeyToDate, shiftDateKey } from "../../shared/dates";
import { nutritionInputSchema, sumNutrients } from "../../shared/nutrition";
import { buildTravelPlan } from "../services/travel-plan-service";

test("local calendar days survive evening UTC rollover and the date line", () => {
  const instant = new Date("2026-09-23T01:30:00Z");
  assert.equal(localDateKey("America/New_York", instant), "2026-09-22");
  assert.equal(localDateKey("Pacific/Honolulu", instant), "2026-09-22");
  assert.equal(localDateKey("Pacific/Auckland", instant), "2026-09-23");
  assert.equal(dateKeyToDate("2026-09-22").toISOString().slice(0, 10), "2026-09-22");
  assert.equal(shiftDateKey("2026-03-08", 1), "2026-03-09");
  assert.equal(dateKeySchema.safeParse("2026-02-30").success, false);
  assert.equal(dateKeySchema.safeParse("YYYY-MM-DD").success, false);
});

test("nutrition validation rejects negative, malformed and non-finite inputs", () => {
  const input = { date: "2026-09-22", timezone: "America/New_York", mealStyle: "lunch", calories: 500, protein: 25, carbs: 50, fat: 15 };
  assert.equal(nutritionInputSchema.safeParse(input).success, true);
  for (const patch of [{ calories: -1 }, { protein: Infinity }, { timezone: "invalid" }, { date: "2026-02-30" }]) {
    assert.equal(nutritionInputSchema.safeParse({ ...input, ...patch }).success, false);
  }
  assert.equal(sumNutrients([{ calories: 700 }, { calories: 700 }, { calories: 700 }]).calories, 2100);
});

test("changed meals update remaining totals without changing targets or locked dinner", () => {
  const targets = { calories: 2200, protein: 130, carbs: 250, fat: 70 };
  const base = buildTravelPlan({ date: "2026-09-22", timezone: "America/New_York", targets, logs: [] });
  const locked = { ...base.meals[0], id: "client-dinner", name: "Client dinner", status: "locked" as const };
  const updated = buildTravelPlan({ date: base.date, timezone: base.timezone, targets,
    savedMeals: [locked], logs: [{ calories: 2500, protein: 110, carbs: 200, fat: 90 }] });
  assert.deepEqual(updated.targets, targets);
  assert.equal(updated.remaining.calories, -300);
  assert.deepEqual(updated.meals.find(meal => meal.id === locked.id), locked);
  assert.match(updated.message, /no need to compensate/);
  assert.equal(updated.coverage, "generic");
  const eaten = buildTravelPlan({ date: base.date, timezone: base.timezone, targets,
    savedMeals: [locked], logs: [{ ...locked, planMealId: locked.id }] });
  assert.equal(eaten.meals.some(meal => meal.id === locked.id), false);
});

test("unsupported restrictions suppress generic suggestions instead of guessing", () => {
  const plan = buildTravelPlan({ date: "2026-09-22", timezone: "UTC", logs: [],
    targets: { calories: 2200, protein: 130, carbs: 250, fat: 70 }, restrictions: ["sesame allergy"] });
  assert.equal(plan.meals.length, 0);
  assert.match(plan.message, /dietary restrictions/);
});

test("snacks and multiple entries for one meal do not exhaust the remaining day", () => {
  const input = { date: "2026-09-22", timezone: "UTC", targets: { calories: 2200, protein: 130, carbs: 250, fat: 70 } };
  const snacks = Array.from({ length: 3 }, () => ({ calories: 100, mealStyle: "snack" }));
  const plan = buildTravelPlan({ ...input, logs: snacks });
  assert.equal(plan.remaining.calories, 1900);
  assert.equal(plan.meals.length, 3);
  const breakfast = buildTravelPlan({ ...input, logs: [...snacks, { calories: 300, mealStyle: "breakfast" }, { calories: 50, mealStyle: "breakfast" }] });
  assert.equal(breakfast.meals.length, 2);
});
