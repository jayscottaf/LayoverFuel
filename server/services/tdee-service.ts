import { User } from "@shared/schema";

// Mifflin-St Jeor Equation for calculating Basal Metabolic Rate (BMR)
function calculateBMR(user: User): number {
  const { gender, weight, height, age } = user;
  
  if (gender === 'male') {
    return Math.round(10 * weight + 6.25 * height - 5 * age + 5);
  } else {
    return Math.round(10 * weight + 6.25 * height - 5 * age - 161);
  }
}

// Activity multipliers for TDEE calculation
const activityMultipliers = {
  lightly_active: 1.375, // Light exercise 1-3 days/week
  moderate: 1.55,       // Moderate exercise 3-5 days/week
  very_active: 1.725    // Hard exercise 6-7 days/week
};

// Calculate Total Daily Energy Expenditure (TDEE)
export function calculateTDEE(user: User): number {
  const bmr = calculateBMR(user);
  const activityLevel = user.activityLevel as keyof typeof activityMultipliers;
  const multiplier = activityMultipliers[activityLevel] || activityMultipliers.moderate;
  
  return Math.round(bmr * multiplier);
}

// Calculate macro distribution based on fitness goal
export function calculateMacros(user: User, tdee: number): {
  protein: number;
  carbs: number;
  fat: number;
  caloriesFromProtein: number;
  caloriesFromCarbs: number;
  caloriesFromFat: number;
} {
  const { fitnessGoal, weight } = user;
  
  let proteinMultiplier: number;
  let fatMultiplier: number;
  let caloriesFromProtein: number;
  let caloriesFromFat: number;
  let caloriesFromCarbs: number;
  
  // Adjust macros based on fitness goal
  if (fitnessGoal === 'shred') {
    // Higher protein, moderate fat for fat loss
    proteinMultiplier = 2.2; // 2.2g per kg of bodyweight
    fatMultiplier = 0.8; // 0.8g per kg of bodyweight
    
    caloriesFromProtein = weightKg * proteinMultiplier * 4; // 4 calories per gram of protein
    caloriesFromFat = weightKg * fatMultiplier * 9; // 9 calories per gram of fat
    
    // Adjust TDEE for deficit if shredding
    const adjustedTDEE = tdee * 0.85; // 15% deficit
    caloriesFromCarbs = adjustedTDEE - caloriesFromProtein - caloriesFromFat;
  } else {
    // Moderate protein, moderate fat for maintenance
    proteinMultiplier = 1.8; // 1.8g per kg of bodyweight
    fatMultiplier = 1.0; // 1.0g per kg of bodyweight
    
    caloriesFromProtein = weight * proteinMultiplier * 4;
    caloriesFromFat = weight * fatMultiplier * 9;
    caloriesFromCarbs = tdee - caloriesFromProtein - caloriesFromFat;
  }
  
  // Calculate grams for each macro
  const protein = Math.round(weightKg * proteinMultiplier);
  const fat = Math.round(weightKg * fatMultiplier);
  const carbs = Math.round(caloriesFromCarbs / 4); // 4 calories per gram of carbs
  
  return {
    protein,
    carbs,
    fat,
    caloriesFromProtein: Math.round(caloriesFromProtein),
    caloriesFromCarbs: Math.round(caloriesFromCarbs),
    caloriesFromFat: Math.round(caloriesFromFat)
  };
}
