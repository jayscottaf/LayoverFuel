import { User } from "@shared/schema";

// Mifflin-St Jeor Equation for BMR — requires kg and cm
function calculateBMR(user: User): number {
  const weightKg = (user.weight ?? 154) / 2.205; // stored in lbs → convert to kg
  const heightCm = user.height ?? 170;            // stored in cm (correct)
  const age = user.age ?? 30;
  const gender = user.gender ?? "male";

  if (gender === "male") {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age + 5);
  } else {
    return Math.round(10 * weightKg + 6.25 * heightCm - 5 * age - 161);
  }
}

// Activity multipliers keyed to the actual values saved in the database
const activityMultipliers: Record<string, number> = {
  sedentary: 1.2,           // Little to no exercise
  lightly_active: 1.375,    // Light exercise 1–3 days/week
  moderately_active: 1.55,  // Moderate exercise 3–5 days/week
  very_active: 1.725,       // Hard exercise 6–7 days/week
  extra_active: 1.9,        // Very hard exercise + physical job
};

// Calculate Total Daily Energy Expenditure (TDEE)
export function calculateTDEE(user: User): number {
  const bmr = calculateBMR(user);
  const multiplier = activityMultipliers[user.activityLevel ?? ""] ?? 1.55;
  return Math.round(bmr * multiplier);
}

// Calculate macro distribution based on fitness goal
export function calculateMacros(user: User, tdee: number): {
  protein: number;
  carbs: number;
  fat: number;
  targetCalories: number;
  caloriesFromProtein: number;
  caloriesFromCarbs: number;
  caloriesFromFat: number;
} {
  const { fitnessGoal } = user;
  const weightKg = (user.weight ?? 154) / 2.205;

  let targetCalories: number;
  let proteinPerKg: number;
  let fatPerKg: number;

  switch (fitnessGoal) {
    case "lose_weight":
      targetCalories = Math.round(tdee * 0.82); // 18% deficit
      proteinPerKg = 2.2;  // High protein to preserve muscle
      fatPerKg = 0.8;
      break;
    case "gain_muscle":
      targetCalories = Math.round(tdee * 1.1);  // 10% surplus
      proteinPerKg = 2.0;
      fatPerKg = 1.0;
      break;
    case "endurance":
      targetCalories = tdee;
      proteinPerKg = 1.6;
      fatPerKg = 0.7;      // Lower fat → more room for carbs
      break;
    case "maintain":
    default:
      targetCalories = tdee;
      proteinPerKg = 1.8;
      fatPerKg = 0.9;
      break;
  }

  const protein = Math.max(0, Math.round(weightKg * proteinPerKg));
  const fat = Math.max(0, Math.round(weightKg * fatPerKg));

  const caloriesFromProtein = protein * 4;
  const caloriesFromFat = fat * 9;
  const caloriesFromCarbs = Math.max(0, targetCalories - caloriesFromProtein - caloriesFromFat);
  const carbs = Math.max(0, Math.round(caloriesFromCarbs / 4));

  return {
    protein,
    carbs,
    fat,
    targetCalories,
    caloriesFromProtein,
    caloriesFromCarbs,
    caloriesFromFat,
  };
}
