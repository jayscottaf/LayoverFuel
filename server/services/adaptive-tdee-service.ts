import { storage } from "../storage";

interface WeightEntry {
  date: string;
  weight: number; // in kg
}

interface CalorieEntry {
  date: string;
  calories: number;
}

interface AdaptiveTDEEResult {
  value: number;
  formulaTDEE: number;
  difference: number;
  confidence: "low" | "medium" | "high";
  daysOfData: number;
  avgDailyCalories: number;
  weightChange: number; // in lbs
}

/**
 * Calculate adaptive TDEE based on actual weight change and calorie intake
 * Uses the MacroFactor approach: actual calorie burn = calories eaten - weight change
 *
 * @param userId - User ID to calculate for
 * @param days - Number of days to look back (default 14, minimum 7)
 * @returns Calculated adaptive TDEE or null if insufficient data
 */
export async function calculateAdaptiveTDEE(
  userId: number,
  days: number = 14
): Promise<AdaptiveTDEEResult | null> {
  // Require minimum 7 days of data
  if (days < 7) days = 7;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    // Fetch user's formula TDEE
    const user = await storage.getUser(userId);
    if (!user || !user.tdee) {
      console.log("No user or TDEE found");
      return null;
    }

    // Fetch weight logs
    const weightLogs = await storage.getHealthLogs(userId);
    const weightData = weightLogs
      .filter(log => {
        const logDate = new Date(log.date);
        return log.weight && logDate >= startDate && logDate <= endDate;
      })
      .map(log => ({
        date: log.date,
        weight: log.weight as number,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Need at least 2 weight entries
    if (weightData.length < 2) {
      console.log(`Insufficient weight data: ${weightData.length} entries`);
      return null;
    }

    // Fetch nutrition logs
    const nutritionLogs = await storage.getNutritionLogs(userId);
    const calorieData = nutritionLogs
      .filter(log => {
        const logDate = new Date(log.date);
        return log.calories && logDate >= startDate && logDate <= endDate;
      })
      .map(log => ({
        date: log.date,
        calories: log.calories as number,
      }));

    // Need at least 7 days of calorie data
    if (calorieData.length < 7) {
      console.log(`Insufficient calorie data: ${calorieData.length} entries`);
      return null;
    }

    // Calculate weight trend using linear regression (smooths out fluctuations)
    const weightTrend = calculateWeightTrend(weightData);

    // Get starting and ending weights from the trend
    const startWeight = weightTrend.startWeight; // in kg
    const endWeight = weightTrend.endWeight; // in kg
    const weightChangeKg = endWeight - startWeight;
    const weightChangeLbs = weightChangeKg * 2.20462;

    // Calculate average daily calorie intake
    const totalCalories = calorieData.reduce((sum, entry) => sum + entry.calories, 0);
    const avgDailyCalories = Math.round(totalCalories / calorieData.length);

    // Calculate actual days between first and last weight entry
    const actualDays = Math.ceil(
      (new Date(weightData[weightData.length - 1].date).getTime() -
       new Date(weightData[0].date).getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate calorie deficit/surplus
    // 1 lb = ~3500 calories
    const totalCalorieDeficit = weightChangeLbs * 3500;
    const dailyCalorieDeficit = totalCalorieDeficit / actualDays;

    // Actual TDEE = Average calories consumed - daily deficit
    // (If in deficit, this adds calories; if in surplus, this subtracts)
    const adaptiveTDEE = Math.round(avgDailyCalories - dailyCalorieDeficit);

    // Calculate difference from formula
    const difference = adaptiveTDEE - user.tdee;

    // Calculate confidence based on data completeness
    const dataCompleteness = (calorieData.length / actualDays) * 100;
    let confidence: "low" | "medium" | "high";

    if (actualDays >= 14 && dataCompleteness >= 85) {
      confidence = "high";
    } else if (actualDays >= 7 && dataCompleteness >= 70) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    console.log(`Adaptive TDEE calculated: ${adaptiveTDEE} (${confidence} confidence)`);

    return {
      value: adaptiveTDEE,
      formulaTDEE: user.tdee,
      difference,
      confidence,
      daysOfData: actualDays,
      avgDailyCalories,
      weightChange: weightChangeLbs,
    };

  } catch (error) {
    console.error("Error calculating adaptive TDEE:", error);
    return null;
  }
}

/**
 * Calculate weight trend using simple linear regression
 * This smooths out daily fluctuations from water weight
 */
function calculateWeightTrend(weightData: WeightEntry[]): {
  startWeight: number;
  endWeight: number;
} {
  // If only 2 entries, just use them directly
  if (weightData.length === 2) {
    return {
      startWeight: weightData[0].weight,
      endWeight: weightData[1].weight,
    };
  }

  // Convert dates to day numbers (0, 1, 2, ...)
  const firstDate = new Date(weightData[0].date).getTime();
  const points = weightData.map(entry => ({
    x: Math.floor((new Date(entry.date).getTime() - firstDate) / (1000 * 60 * 60 * 24)),
    y: entry.weight,
  }));

  // Calculate linear regression
  const n = points.length;
  const sumX = points.reduce((sum, p) => sum + p.x, 0);
  const sumY = points.reduce((sum, p) => sum + p.y, 0);
  const sumXY = points.reduce((sum, p) => sum + p.x * p.y, 0);
  const sumX2 = points.reduce((sum, p) => sum + p.x * p.x, 0);

  // Slope (m) and intercept (b) for y = mx + b
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate trend line values for first and last days
  const lastDay = points[points.length - 1].x;

  return {
    startWeight: intercept, // Day 0
    endWeight: slope * lastDay + intercept, // Last day
  };
}