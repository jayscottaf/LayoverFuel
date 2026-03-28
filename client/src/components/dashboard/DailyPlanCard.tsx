import { useState } from "react";
import { format } from "date-fns";

interface DailyPlanCardProps {
  plan: {
    date: string;
    meals: {
      breakfast: {
        name: string;
        description: string;
        macros: {
          protein: number;
          carbs: number;
          fat: number;
          calories: number;
        };
      };
      lunch: {
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
      };
      dinner: {
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
      };
      snacks: Array<{
        name: string;
        description: string;
        macros: {
          protein: number;
          carbs: number;
          fat: number;
          calories: number;
        };
      }>;
    };
    workout: {
      title: string;
      description: string;
      duration: string;
      intensityLevel: string;
      sections: Array<{
        name: string;
        duration: string;
        exercises: Array<{
          name: string;
          sets: number;
          reps: string;
          description: string;
        }>;
      }>;
      gymRecommendation?: {
        name: string;
        distance: string;
        travelTime: string;
        rating: number;
        openHours: string;
      };
    };
    motivation?: string;
  };
}

export function DailyPlanCard({ plan }: DailyPlanCardProps) {
  const [showAllMeals, setShowAllMeals] = useState(false);
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);
  
  const today = new Date();
  const dateString = plan.date ? new Date(plan.date).toDateString() : today.toDateString();
  
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <span className="text-primary-600 bg-primary-100 p-2 rounded-lg mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <h3 className="font-heading font-semibold text-lg text-gray-900">
            Daily Focus: {plan.workout.intensityLevel} {plan.workout.title}
          </h3>
        </div>
        <span className="text-gray-500 text-sm">{format(new Date(dateString), 'MMMM d, yyyy')}</span>
      </div>
      
      {/* Meal Plan */}
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <span className="text-secondary-600 bg-secondary-100 p-1.5 rounded-md mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </span>
          <h4 className="font-heading font-medium text-gray-900">Meal Suggestions</h4>
        </div>
        
        <div className="space-y-3 ml-11">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="font-medium text-gray-900">Breakfast</p>
            <p className="text-gray-600 text-sm">{plan.meals.breakfast.description}</p>
            <div className="flex space-x-2 mt-1">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {plan.meals.breakfast.macros.protein}g protein
              </span>
              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                {plan.meals.breakfast.macros.carbs}g carbs
              </span>
              <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                {plan.meals.breakfast.macros.fat}g fat
              </span>
            </div>
          </div>
          
          {(showAllMeals || !plan.meals.lunch) ? null : (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900">Lunch</p>
              <p className="text-gray-600 text-sm">
                {plan.meals.lunch.description}
                {plan.meals.lunch.restaurantRecommendation && 
                  ` (${plan.meals.lunch.restaurantRecommendation.name}, ${plan.meals.lunch.restaurantRecommendation.distance} away)`
                }
              </p>
              <div className="flex space-x-2 mt-1">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                  {plan.meals.lunch.macros.protein}g protein
                </span>
                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                  {plan.meals.lunch.macros.carbs}g carbs
                </span>
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                  {plan.meals.lunch.macros.fat}g fat
                </span>
              </div>
            </div>
          )}
          
          {showAllMeals && (
            <>
              {plan.meals.lunch && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900">Lunch</p>
                  <p className="text-gray-600 text-sm">
                    {plan.meals.lunch.description}
                    {plan.meals.lunch.restaurantRecommendation && 
                      ` (${plan.meals.lunch.restaurantRecommendation.name}, ${plan.meals.lunch.restaurantRecommendation.distance} away)`
                    }
                  </p>
                  <div className="flex space-x-2 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {plan.meals.lunch.macros.protein}g protein
                    </span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      {plan.meals.lunch.macros.carbs}g carbs
                    </span>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      {plan.meals.lunch.macros.fat}g fat
                    </span>
                  </div>
                </div>
              )}
              
              {plan.meals.dinner && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900">Dinner</p>
                  <p className="text-gray-600 text-sm">
                    {plan.meals.dinner.description}
                    {plan.meals.dinner.restaurantRecommendation && 
                      ` (${plan.meals.dinner.restaurantRecommendation.name}, ${plan.meals.dinner.restaurantRecommendation.distance} away)`
                    }
                  </p>
                  <div className="flex space-x-2 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {plan.meals.dinner.macros.protein}g protein
                    </span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      {plan.meals.dinner.macros.carbs}g carbs
                    </span>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      {plan.meals.dinner.macros.fat}g fat
                    </span>
                  </div>
                </div>
              )}
              
              {plan.meals.snacks && plan.meals.snacks.map((snack, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium text-gray-900">Snack {index + 1}</p>
                  <p className="text-gray-600 text-sm">{snack.description}</p>
                  <div className="flex space-x-2 mt-1">
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                      {snack.macros.protein}g protein
                    </span>
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                      {snack.macros.carbs}g carbs
                    </span>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                      {snack.macros.fat}g fat
                    </span>
                  </div>
                </div>
              ))}
            </>
          )}
          
          <button 
            className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
            onClick={() => setShowAllMeals(!showAllMeals)}
          >
            {showAllMeals ? "Hide meals" : "View all meals"}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Workout Plan */}
      <div>
        <div className="flex items-center mb-4">
          <span className="text-accent-600 bg-accent-100 p-1.5 rounded-md mr-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </span>
          <h4 className="font-heading font-medium text-gray-900">
            {plan.workout.title} ({plan.workout.duration})
          </h4>
        </div>
        
        <div className="space-y-3 ml-11">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.workout.sections.slice(0, showAllWorkouts ? undefined : 2).map((section, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-gray-900">{section.name}</p>
                  <span className="text-xs text-gray-500">{section.duration}</span>
                </div>
                <p className="text-gray-600 text-sm">
                  {section.exercises.map((ex, i) => (
                    <span key={i}>
                      {i > 0 && ", "}
                      {ex.sets} x {ex.reps} {ex.name}
                    </span>
                  ))}
                </p>
              </div>
            ))}
          </div>
          
          {plan.workout.gymRecommendation && (
            <div>
              <p className="text-gray-700 text-sm font-medium mb-2">Nearby Gym Option:</p>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start">
                  <div className="h-12 w-12 bg-gray-200 rounded-md mr-3 flex-shrink-0 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{plan.workout.gymRecommendation.name}</p>
                    <p className="text-gray-600 text-sm">
                      {plan.workout.gymRecommendation.distance} - {plan.workout.gymRecommendation.travelTime} - {plan.workout.gymRecommendation.openHours}
                    </p>
                    <div className="flex items-center mt-1">
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <svg 
                            key={i}
                            xmlns="http://www.w3.org/2000/svg" 
                            className={`h-4 w-4 ${i < Math.floor(plan.workout.gymRecommendation!.rating) ? "text-yellow-400" : "text-gray-300"}`} 
                            viewBox="0 0 20 20" 
                            fill="currentColor"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-xs text-gray-500 ml-1">({Math.round(plan.workout.gymRecommendation.rating * 10) / 10})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {plan.workout.sections.length > 2 && (
            <button 
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center"
              onClick={() => setShowAllWorkouts(!showAllWorkouts)}
            >
              {showAllWorkouts ? "Hide workout details" : "View workout details"}
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Motivation Quote */}
      {plan.motivation && (
        <div className="mt-6 bg-primary-50 border border-primary-100 rounded-lg p-4">
          <div className="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-600 mt-0.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-primary-800 italic">{plan.motivation}</p>
          </div>
        </div>
      )}
    </div>
  );
}
