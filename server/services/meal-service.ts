import OpenAI from "openai";
import { User } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "default_key" });

export interface Meal {
  name: string;
  description: string;
  macros: {
    protein: number;
    carbs: number;
    fat: number;
    calories: number;
  };
  restaurantRecommendation?: {
    name: string;
    distance: string;
  };
}

export interface MealPlan {
  breakfast: Meal;
  lunch: Meal;
  dinner: Meal;
  snacks: Meal[];
}

export async function generateMealPlan(
  user: User,
  proteinTarget: number,
  carbsTarget: number,
  fatTarget: number,
  calorieTarget: number
): Promise<MealPlan> {
  try {
    const promptText = `
      Generate a travel-friendly meal plan for someone staying at a hotel with the following details:
      
      Fitness Goal: ${user.fitnessGoal} (${user.fitnessGoal === 'shred' ? 'fat loss' : 'maintenance/muscle retention'})
      Dietary Restrictions: ${(user.dietaryRestrictions?.length ?? 0) > 0 ? user.dietaryRestrictions!.join(', ') : 'None'}
      
      Daily Targets:
      - Calories: ${calorieTarget} kcal
      - Protein: ${proteinTarget}g
      - Carbs: ${carbsTarget}g
      - Fat: ${fatTarget}g
      
      Create a full day's meal plan with:
      1. Breakfast (easy to get in hotels)
      2. Lunch (nearby restaurant option)
      3. Dinner (nearby restaurant option)
      4. 1-2 Snacks
      
      For each meal, include:
      - Name
      - Brief description focused on easily accessible/packable foods while traveling
      - Macros (protein, carbs, fat, calories)
      - For lunch and dinner, include a typical restaurant name and approximate distance ("nearby")
      
      Make sure the entire day's meals add up close to the target macros.
      Assume the person has limited cooking capability (hotel room).
      
      Return the result as a JSON object with this structure:
      {
        "breakfast": {
          "name": "Example Breakfast",
          "description": "Description here",
          "macros": {"protein": 25, "carbs": 30, "fat": 15, "calories": 355}
        },
        "lunch": {
          "name": "Example Lunch",
          "description": "Description here",
          "macros": {"protein": 30, "carbs": 45, "fat": 15, "calories": 435},
          "restaurantRecommendation": {"name": "Restaurant Name", "distance": "0.2 miles"}
        },
        "dinner": {
          "name": "Example Dinner",
          "description": "Description here",
          "macros": {"protein": 35, "carbs": 40, "fat": 20, "calories": 480},
          "restaurantRecommendation": {"name": "Restaurant Name", "distance": "0.5 miles"}
        },
        "snacks": [
          {
            "name": "Example Snack",
            "description": "Description here",
            "macros": {"protein": 10, "carbs": 15, "fat": 5, "calories": 145}
          }
        ]
      }
    `;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{role: "user", content: promptText}],
      response_format: { type: "json_object" },
    });

    const mealPlan = JSON.parse(chatResponse.choices[0].message.content ?? '{}');
    return mealPlan as MealPlan;
  } catch (error) {
    console.error("Error generating meal plan:", error);
    
    // Return a default meal plan if API call fails
    return {
      breakfast: {
        name: "Hotel Continental Breakfast",
        description: "Greek yogurt with berries, 2 hard-boiled eggs, and a piece of fruit.",
        macros: {
          protein: 25,
          carbs: 30,
          fat: 15,
          calories: 355
        }
      },
      lunch: {
        name: "Grilled Chicken Salad",
        description: "Grilled chicken breast on a bed of mixed greens with olive oil and vinegar dressing.",
        macros: {
          protein: 30,
          carbs: 10,
          fat: 15,
          calories: 295
        },
        restaurantRecommendation: {
          name: "Fresh & Quick Cafe",
          distance: "0.3 miles"
        }
      },
      dinner: {
        name: "Salmon and Roasted Vegetables",
        description: "Baked salmon fillet with a side of roasted vegetables and a small portion of rice.",
        macros: {
          protein: 35,
          carbs: 40,
          fat: 20,
          calories: 480
        },
        restaurantRecommendation: {
          name: "Coastal Grill",
          distance: "0.5 miles"
        }
      },
      snacks: [
        {
          name: "Protein Bar",
          description: "Commercially available protein bar with good protein-to-carb ratio.",
          macros: {
            protein: 20,
            carbs: 25,
            fat: 10,
            calories: 270
          }
        }
      ]
    };
  }
}
