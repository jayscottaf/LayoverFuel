import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { estimateSchema } from "../server/routes/api/nutrition-estimate";
import { imageEstimateSchema } from "../server/services/image-analysis-service";
import { readFile } from "node:fs/promises";

if (!process.env.OPENAI_API_KEY) {
  console.log("Nutrition provider unavailable; manual logging remains available");
} else {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 25_000, maxRetries: 0 });
  try {
    const text = await client.responses.create({
      model: process.env.OPENAI_NUTRITION_MODEL || "gpt-4o-mini", store: false,
      input: "Synthetic release check: estimate one medium banana. All sources must be estimate.",
      text: { format: zodTextFormat(estimateSchema, "meal_estimate") }, max_output_tokens: 1000,
    });
    estimateSchema.parse(JSON.parse(text.output_text));
    // The public app icon checks image transport and schema support, not food accuracy.
    const image = `data:image/png;base64,${(await readFile(new URL("../client/public/icons/icon-192.png", import.meta.url))).toString("base64")}`;
    const vision = await client.responses.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o", store: false,
      input: [{ role: "user", content: [
        { type: "input_text", text: "Synthetic release check of the app icon, not a meal. Return zero nutrients and bounds, low confidence, foodItems [Test icon], and explain that this is not food." },
        { type: "input_image", image_url: image, detail: "low" },
      ] }],
      text: { format: zodTextFormat(imageEstimateSchema, "meal_photo") }, max_output_tokens: 1000,
    });
    imageEstimateSchema.parse(JSON.parse(vision.output_text));
    console.log("Nutrition text and image provider contracts verified (synthetic inputs only)");
  } catch (error) {
    const failure = error as { name?: string; status?: number; code?: string; param?: string };
    console.error("Nutrition provider release check failed", { name: failure.name, status: failure.status, code: failure.code, param: failure.param });
    process.exitCode = 1;
  }
}
