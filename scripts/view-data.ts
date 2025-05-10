
import { db } from "../server/db";
import { users, nutritionLogs, workoutLogs, healthLogs, dailyPlans } from "../shared/schema";

async function viewData() {
  console.log("\n=== Users ===");
  const allUsers = await db.select().from(users);
  console.log(allUsers);

  console.log("\n=== Nutrition Logs ===");
  const allNutritionLogs = await db.select().from(nutritionLogs);
  console.log(allNutritionLogs);

  console.log("\n=== Workout Logs ===");
  const allWorkoutLogs = await db.select().from(workoutLogs);
  console.log(allWorkoutLogs);

  console.log("\n=== Health Logs ===");
  const allHealthLogs = await db.select().from(healthLogs);
  console.log(allHealthLogs);

  console.log("\n=== Daily Plans ===");
  const allDailyPlans = await db.select().from(dailyPlans);
  console.log(allDailyPlans);
}

viewData().catch(console.error);
