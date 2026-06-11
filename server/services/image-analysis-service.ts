import OpenAI from "openai";

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeMealImage(imageBase64: string): Promise<{
  estimate: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  range: {
    caloriesLow: number;
    caloriesHigh: number;
  };
  confidence: "low" | "medium" | "high";
  foodItems: string[];
  analysis: string;
  suggestions: string;
}> {
  try {
    // Detect MIME type from data URI; default to jpeg if raw base64 provided.
    let mimeType = "image/jpeg";
    let base64Image = imageBase64;
    if (imageBase64.includes('data:image')) {
      const match = imageBase64.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1];
        base64Image = match[2];
      } else {
        base64Image = imageBase64.split(',')[1] ?? imageBase64;
      }
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a nutritional analysis AI that specializes in analyzing meal photos.
          Analyze the meal and return EXACTLY this JSON structure (no nesting, values at root level):
          {
            "calories": <best-estimate number>,
            "calories_low": <lower bound, ~80% of best estimate>,
            "calories_high": <upper bound, ~120% of best estimate>,
            "protein": <number in grams>,
            "carbs": <number in grams>,
            "fat": <number in grams>,
            "confidence": <"low" | "medium" | "high">,
            "food_items": ["item1", "item2", "item3"],
            "analysis": "Brief 1-2 sentence nutritional summary",
            "suggestions": "Brief improvement tips (optional)"
          }

          Important:
          - Return macros directly at root level, NOT nested under "estimate" or "macros"
          - Be honest about uncertainty: if portion size is hard to gauge from the photo, set confidence: "low" and widen the calories_low/calories_high band.
          - confidence: "high" only when the items, brand, and portion are all unambiguous.
          - Include all visible food items in the food_items array
          - Calories should be total for the entire meal shown`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this meal photo and provide nutritional information in the exact JSON format specified."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "low",
              }
            }
          ],
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 600,
    });

    const content = response.choices[0].message.content || "{}";
    console.log("[MEAL ANALYSIS] OpenAI raw response:", content);

    const result = JSON.parse(content);
    console.log("[MEAL ANALYSIS] Parsed JSON:", JSON.stringify(result, null, 2));

    // Handle different possible response structures
    let calories = 0;
    let protein = 0;
    let carbs = 0;
    let fat = 0;

    // Try direct fields first (new format)
    if (result.calories !== undefined) {
      calories = Number(result.calories) || 0;
      protein = Number(result.protein) || 0;
      carbs = Number(result.carbs) || 0;
      fat = Number(result.fat) || 0;
    }
    // Fallback: check if nested under "estimate" or "macros"
    else if (result.estimate) {
      calories = Number(result.estimate.calories) || 0;
      protein = Number(result.estimate.protein) || 0;
      carbs = Number(result.estimate.carbs) || 0;
      fat = Number(result.estimate.fat) || 0;
    }
    else if (result.macros) {
      calories = Number(result.macros.calories) || 0;
      protein = Number(result.macros.protein) || 0;
      carbs = Number(result.macros.carbs) || 0;
      fat = Number(result.macros.fat) || 0;
    }

    console.log("[MEAL ANALYSIS] Extracted values:", { calories, protein, carbs, fat });

    // Calorie range: prefer model-emitted bounds, fall back to ±20% if missing.
    const caloriesLow = Number(result.calories_low ?? result.caloriesLow) || Math.round(calories * 0.8);
    const caloriesHigh = Number(result.calories_high ?? result.caloriesHigh) || Math.round(calories * 1.2);

    const rawConfidence = String(result.confidence ?? "medium").toLowerCase();
    const confidence: "low" | "medium" | "high" =
      rawConfidence === "high" || rawConfidence === "low" ? rawConfidence : "medium";

    return {
      estimate: {
        calories,
        protein,
        carbs,
        fat,
      },
      range: {
        caloriesLow,
        caloriesHigh,
      },
      confidence,
      foodItems: result.food_items || result.foodItems || [],
      analysis: result.analysis || "Unable to analyze the meal.",
      suggestions: result.suggestions || "",
    };
  } catch (error) {
    console.error("[MEAL ANALYSIS] Error analyzing meal image:", error);
    throw new Error("Failed to analyze meal image");
  }
}