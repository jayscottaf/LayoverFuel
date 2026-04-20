import OpenAI from "openai";
import { User } from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "default_key" });

export interface Exercise {
  name: string;
  sets: number;
  reps: string; // Could be "10" or "30 seconds"
  description: string;
}

export interface WorkoutSection {
  name: string;
  duration: string;
  exercises: Exercise[];
}

export interface GymRecommendation {
  name: string;
  distance: string;
  travelTime: string;
  rating: number;
  openHours: string;
}

export interface WorkoutPlan {
  title: string;
  description: string;
  duration: string;
  intensityLevel: string;
  sections: WorkoutSection[];
  gymRecommendation?: GymRecommendation;
}

export async function generateWorkoutPlan(user: User): Promise<WorkoutPlan> {
  try {
    const promptText = `
      Generate a travel-friendly workout plan for someone staying at a hotel with the following details:
      
      Fitness Goal: ${user.fitnessGoal} (${user.fitnessGoal === 'shred' ? 'fat loss' : 'maintenance/muscle retention'})
      Activity Level: ${user.activityLevel}
      Gym Memberships: ${(user.gymMemberships?.length ?? 0) > 0 ? user.gymMemberships!.join(', ') : 'None'}
      Max Travel Time: ${user.maxCommuteMinutes} minutes
      
      Create a workout plan that:
      1. Focuses on exercises that can be done in a hotel room with minimal equipment
      2. Includes a warm-up, main workout, and cool down section
      3. Has a total duration of 20-30 minutes
      4. Matches the user's fitness goal
      
      Also suggest a nearby gym option if the user wants a more equipped workout.
      
      Return the result as a JSON object with this structure:
      {
        "title": "Workout Title",
        "description": "Brief description",
        "duration": "25 min",
        "intensityLevel": "Moderate",
        "sections": [
          {
            "name": "Warm Up",
            "duration": "5 min",
            "exercises": [
              {
                "name": "Exercise Name",
                "sets": 1,
                "reps": "10 each side",
                "description": "Brief instruction"
              }
            ]
          }
        ],
        "gymRecommendation": {
          "name": "Gym Name",
          "distance": "0.8 miles",
          "travelTime": "15 min walk",
          "rating": 4.2,
          "openHours": "24 hours"
        }
      }
    `;

    const chatResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{role: "user", content: promptText}],
      response_format: { type: "json_object" },
      max_tokens: 1000,
    });

    const workoutPlan = JSON.parse(chatResponse.choices[0].message.content ?? '{}');
    return workoutPlan as WorkoutPlan;
  } catch (error) {
    console.error("Error generating workout plan:", error);
    
    // Return a default workout plan if API call fails
    return {
      title: "Hotel Room HIIT Workout",
      description: "A quick high-intensity interval training workout that can be done in your hotel room with no equipment.",
      duration: "20 min",
      intensityLevel: "Moderate",
      sections: [
        {
          name: "Warm Up",
          duration: "5 min",
          exercises: [
            {
              name: "Arm Circles",
              sets: 1,
              reps: "20 seconds each direction",
              description: "Rotate arms in small circles, then large circles, forward and backward."
            },
            {
              name: "High Knees",
              sets: 1,
              reps: "30 seconds",
              description: "March in place, bringing knees up to hip level."
            },
            {
              name: "Bodyweight Squats",
              sets: 1,
              reps: "10",
              description: "Stand with feet shoulder-width apart, lower into a squat position."
            }
          ]
        },
        {
          name: "Main Workout",
          duration: "10 min",
          exercises: [
            {
              name: "Push-ups",
              sets: 3,
              reps: "10",
              description: "Standard push-ups or modified from knees if needed."
            },
            {
              name: "Bodyweight Squats",
              sets: 3,
              reps: "15",
              description: "Perform squats with good form, keeping chest up."
            },
            {
              name: "Mountain Climbers",
              sets: 3,
              reps: "30 seconds",
              description: "Start in plank position and alternate bringing knees to chest."
            },
            {
              name: "Plank",
              sets: 3,
              reps: "30 seconds",
              description: "Hold a forearm plank with core engaged."
            }
          ]
        },
        {
          name: "Cool Down",
          duration: "5 min",
          exercises: [
            {
              name: "Quad Stretch",
              sets: 1,
              reps: "20 seconds each leg",
              description: "Stand on one leg, grab ankle of other leg behind you."
            },
            {
              name: "Hamstring Stretch",
              sets: 1,
              reps: "20 seconds each leg",
              description: "Sit with one leg extended, reach toward toes."
            },
            {
              name: "Deep Breathing",
              sets: 1,
              reps: "10 breaths",
              description: "Inhale for 4 counts, hold for 2, exhale for 6."
            }
          ]
        }
      ],
      gymRecommendation: {
        name: "Planet Fitness",
        distance: "0.8 miles",
        travelTime: "15 min walk",
        rating: 4.2,
        openHours: "24 hours"
      }
    };
  }
}
