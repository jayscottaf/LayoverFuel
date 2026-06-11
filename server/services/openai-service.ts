import OpenAI from "openai";
import { User } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "default_key" });

export interface OnboardingQuestion {
  text: string;
  field: string;
  validationFn?: (response: string) => boolean;
}

export interface OnboardingResponse {
  field: string;
  value: any;
  nextQuestion?: OnboardingQuestion;
  isComplete?: boolean;
}

const onboardingQuestions: OnboardingQuestion[] = [
  {
    text: "Hi there! I'm your Layover Fuel fitness coach. I'll help you stay fit while traveling. Let's get to know each other better. What's your name?",
    field: "name",
  },
  {
    text: "Great to meet you! Could you please share your email address? I'll use this to create your account.",
    field: "email",
    validationFn: (email) => /\S+@\S+\.\S+/.test(email),
  },
  {
    text: "Thanks! I need a few more details to create your personalized fitness plan. Could you share your age, height, and weight?",
    field: "biometrics",
  },
  {
    text: "Are you male, female, or prefer another option?",
    field: "gender",
  },
  {
    text: "What's your primary fitness goal? Pick one: lose weight, maintain weight, build muscle, or improve endurance.",
    field: "fitnessGoal",
  },
  {
    text: "How would you describe your activity level — sedentary, lightly active, moderately active, very active, or extra active?",
    field: "activityLevel",
  },
  {
    text: "Do you have any dietary restrictions or preferences? (e.g., no dairy, vegetarian, etc.)",
    field: "dietaryRestrictions",
  },
  {
    text: "Do you have any gym memberships? (e.g., YMCA, Planet Fitness, etc.)",
    field: "gymMemberships",
  },
  {
    text: "What's the maximum distance you're willing to travel to a gym (in minutes) while on a layover or staying at a hotel?",
    field: "maxCommuteMinutes",
  },
];

export async function processOnboardingMessage(
  message: string, 
  currentQuestion: OnboardingQuestion,
  userData: Partial<User>
): Promise<OnboardingResponse> {
  let response: OnboardingResponse = {
    field: currentQuestion.field,
    value: null,
  };

  // Process specific field types
  switch (currentQuestion.field) {
    case "name":
      response.value = message.trim();
      break;
      
    case "email":
      if (currentQuestion.validationFn && !currentQuestion.validationFn(message)) {
        return {
          field: currentQuestion.field,
          value: null,
          nextQuestion: {
            text: "That doesn't look like a valid email. Could you please provide a valid email address?",
            field: "email",
            validationFn: currentQuestion.validationFn,
          },
        };
      }
      response.value = message.trim();
      break;
      
    case "biometrics":
      try {
        const promptText = `
          Extract age, height, and weight from this text: "${message}"
          If height is in feet and inches, convert to cm (1 inch = 2.54 cm).
          If weight is in pounds (lbs), convert to kg (1 lb = 0.453592 kg).
          Return a JSON object with the following fields: age (number), heightCm (number), weightKg (number).
          Only return the JSON object, nothing else.
        `;

        const chatResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{role: "user", content: promptText}],
          response_format: { type: "json_object" },
          max_tokens: 150,
        });

        const extractedData = JSON.parse(chatResponse.choices[0].message.content ?? '{}');
        response.value = {
          age: extractedData.age,
          heightCm: extractedData.heightCm,
          weightKg: extractedData.weightKg,
        };
      } catch (error) {
        console.error("Error parsing biometrics:", error);
        return {
          field: currentQuestion.field,
          value: null,
          nextQuestion: {
            text: "I couldn't understand that. Could you provide your age, height, and weight in a clearer format? For example: '32 years old, 5'10\" (178 cm), 175 lbs (79 kg)'",
            field: "biometrics",
          },
        };
      }
      break;
      
    case "gender":
      if (message.toLowerCase().includes("male")) {
        response.value = "male";
      } else if (message.toLowerCase().includes("female")) {
        response.value = "female";
      } else {
        response.value = "other";
      }
      break;
      
    case "fitnessGoal": {
      const validGoals = ["lose_weight", "maintain", "gain_muscle", "endurance"];
      const lowered = message.toLowerCase();
      if (lowered.includes("lose") || lowered.includes("shred") || lowered.includes("fat loss") || lowered.includes("cut")) {
        response.value = "lose_weight";
      } else if (lowered.includes("muscle") || lowered.includes("bulk") || lowered.includes("strength")) {
        response.value = "gain_muscle";
      } else if (lowered.includes("endurance") || lowered.includes("cardio") || lowered.includes("stamina")) {
        response.value = "endurance";
      } else if (lowered.includes("maintain") || lowered.includes("sustain")) {
        response.value = "maintain";
      } else {
        try {
          const promptText = `
            Classify this fitness goal response as exactly one of: lose_weight, maintain, gain_muscle, endurance.
            Response: "${message}"
            Return ONLY one of those four tokens, lowercase, no other text.
          `;
          const chatResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: promptText }],
            max_tokens: 10,
          });
          const result = (chatResponse.choices[0].message.content ?? '').trim().toLowerCase();
          response.value = validGoals.includes(result) ? result : "maintain";
        } catch {
          response.value = "maintain";
        }
      }
      break;
    }

    case "activityLevel": {
      const validLevels = ["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"];
      const lowered = message.toLowerCase();
      if (lowered.includes("sedentary") || lowered.includes("none")) {
        response.value = "sedentary";
      } else if (lowered.includes("extra") || lowered.includes("twice")) {
        response.value = "extra_active";
      } else if (lowered.includes("very") || lowered.includes("hard")) {
        response.value = "very_active";
      } else if (lowered.includes("moderate")) {
        response.value = "moderately_active";
      } else if (lowered.includes("light")) {
        response.value = "lightly_active";
      } else {
        try {
          const promptText = `
            Classify this activity-level response as exactly one of: sedentary, lightly_active, moderately_active, very_active, extra_active.
            Response: "${message}"
            Return ONLY one of those five tokens, lowercase, no other text.
          `;
          const chatResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: promptText }],
            max_tokens: 10,
          });
          const result = (chatResponse.choices[0].message.content ?? '').trim().toLowerCase();
          response.value = validLevels.includes(result) ? result : "moderately_active";
        } catch {
          response.value = "moderately_active";
        }
      }
      break;
    }
      
    case "dietaryRestrictions":
      try {
        const promptText = `
          Extract dietary restrictions from this text: "${message}"
          Return a JSON array of strings with the detected restrictions.
          If the user says "none" or similar, return an empty array.
          Example restrictions: "vegan", "vegetarian", "no dairy", "gluten-free", "keto", "paleo", etc.
          Only return the JSON array, nothing else.
        `;

        const chatResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{role: "user", content: promptText}],
          response_format: { type: "json_object" },
          max_tokens: 150,
        });

        const parsed = JSON.parse(chatResponse.choices[0].message.content ?? '[]');
        response.value = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        response.value = [];
      }
      break;

    case "gymMemberships":
      try {
        const promptText = `
          Extract gym memberships from this text: "${message}"
          Return a JSON array of strings with the detected gym chains.
          If the user says "none" or similar, return an empty array.
          Example gym chains: "Planet Fitness", "LA Fitness", "YMCA", "Gold's Gym", etc.
          Only return the JSON array, nothing else.
        `;

        const chatResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{role: "user", content: promptText}],
          response_format: { type: "json_object" },
          max_tokens: 150,
        });

        const parsed = JSON.parse(chatResponse.choices[0].message.content ?? '[]');
        response.value = Array.isArray(parsed) ? parsed : [];
      } catch (error) {
        response.value = [];
      }
      break;
      
    case "maxCommuteMinutes":
      try {
        const minutes = parseInt(message.replace(/[^0-9]/g, ''));
        if (isNaN(minutes)) {
          return {
            field: currentQuestion.field,
            value: null,
            nextQuestion: {
              text: "I couldn't understand that. Please specify the maximum time in minutes you're willing to travel to a gym.",
              field: "maxCommuteMinutes",
            },
          };
        }
        response.value = minutes;
      } catch (error) {
        return {
          field: currentQuestion.field,
          value: null,
          nextQuestion: {
            text: "I couldn't understand that. Please specify the maximum time in minutes you're willing to travel to a gym.",
            field: "maxCommuteMinutes",
          },
        };
      }
      break;
      
    default:
      response.value = message.trim();
  }

  // Find next question
  const currentIndex = onboardingQuestions.findIndex(q => q.field === currentQuestion.field);
  if (currentIndex < onboardingQuestions.length - 1) {
    response.nextQuestion = onboardingQuestions[currentIndex + 1];
  } else {
    // All questions answered
    response.isComplete = true;
    
    // Generate final confirmation message
    const userDataSummary = {
      ...userData,
      [response.field]: response.value
    };
    
    const finalMessage = await generateOnboardingCompletionMessage(userDataSummary as User);
    response.nextQuestion = {
      text: finalMessage,
      field: "confirmation",
    };
  }

  return response;
}

async function generateOnboardingCompletionMessage(userData: User): Promise<string> {
  try {
    const promptText = `
      Create a friendly personalized summary for a fitness app user based on their profile:
      
      Name: ${userData.name}
      Age: ${userData.age}
      Height: ${userData.height} cm
      Weight: ${userData.weight} kg
      Gender: ${userData.gender}
      Fitness Goal: ${userData.fitnessGoal}
      Activity Level: ${userData.activityLevel}
      
      The message should be enthusiastic and mention:
      1. Thank them for completing their profile
      2. Briefly mention how their data will help create a personalized plan
      3. Encourage them to check out their dashboard to see their TDEE and initial plan
      
      Keep it concise (max 3 paragraphs) and motivational.
    `;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{role: "user", content: promptText}],
      max_tokens: 300,
    });

    return chatResponse.choices[0].message.content ?? "Thanks for completing your profile! Your dashboard is now ready with personalized recommendations tailored to your needs. Check it out to see your daily plan.";
  } catch (error) {
    console.error("Error generating completion message:", error);
    return "Thanks for completing your profile! Your dashboard is now ready with personalized recommendations tailored to your needs. Check it out to see your daily plan.";
  }
}

export async function generateDailyMotivation(user: User): Promise<string> {
  try {
    const promptText = `
      Generate a short, motivational fitness tip for a traveler with the following profile:
      
      Fitness Goal: ${user.fitnessGoal}
      Activity Level: ${user.activityLevel}

      The tip should be specific to someone who is traveling and trying to maintain their fitness routine.
      Keep it concise (1-2 sentences), actionable, and uplifting.
      Do not add any prefixes like "Tip:" or similar.
    `;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{role: "user", content: promptText}],
      max_tokens: 120,
    });

    return chatResponse.choices[0].message.content ?? "Stay consistent with your routine even when traveling - every small workout counts toward your goals!";
  } catch (error) {
    console.error("Error generating daily motivation:", error);
    return "Stay consistent with your routine even when traveling - every small workout counts toward your goals!";
  }
}

export async function processFeedback(feedback: string, user: User): Promise<string> {
  try {
    const promptText = `
      A user of a fitness app for travelers has provided feedback on their day. Based on this feedback,
      provide a supportive response and a quick adjustment suggestion for their plan.
      
      User Profile:
      Goal: ${user.fitnessGoal}
      Activity Level: ${user.activityLevel}
      
      User Feedback: "${feedback}"
      
      Respond in a conversational, encouraging tone. Keep it concise (max 3 sentences).
    `;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{role: "user", content: promptText}],
      max_tokens: 200,
    });

    return chatResponse.choices[0].message.content ?? "Thanks for sharing! We'll take your feedback into account to adjust your plan. Keep up the good work!";
  } catch (error) {
    console.error("Error processing feedback:", error);
    return "Thanks for sharing! We'll take your feedback into account to adjust your plan. Keep up the good work!";
  }
}
