import { useState } from "react";
import { DailyCheckInCard } from "@/components/dashboard/DailyCheckInCard";

export default function TourPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showDashboard, setShowDashboard] = useState(false);
  
  if (!showDashboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="max-w-3xl w-full bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-primary-500 text-white p-6">
            <h1 className="text-3xl font-bold">Welcome to Layover Fuel</h1>
            <p className="mt-2 text-primary-100">Your personalized travel fitness companion</p>
          </div>
          
          <div className="p-6">
            <div className="flex justify-between mb-8">
              {[1, 2, 3, 4].map((step) => (
                <div 
                  key={step}
                  className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 
                    ${currentStep >= step ? 'bg-primary-500 border-primary-500 text-white' : 'border-gray-300 text-gray-400'}`}
                >
                  {step}
                  {step < 4 && (
                    <div className={`absolute top-4 h-0.5 w-16 right-8 
                      ${currentStep > step ? 'bg-primary-500' : 'bg-gray-300'}`}></div>
                  )}
                </div>
              ))}
            </div>
            
            {currentStep === 1 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">Personalized Fitness for Travelers</h2>
                <p className="text-gray-600">
                  Layover Fuel helps you maintain your fitness goals while traveling. We create personalized meal
                  and workout plans tailored to your specific needs, available equipment, and travel constraints.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-primary-500 text-xl font-bold mb-2">Meal Plans</div>
                    <p className="text-sm text-gray-600">Nutritious meal recommendations based on your location and dietary preferences</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-primary-500 text-xl font-bold mb-2">Workouts</div>
                    <p className="text-sm text-gray-600">Hotel-friendly exercise routines with minimal equipment requirements</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-primary-500 text-xl font-bold mb-2">AI Analysis</div>
                    <p className="text-sm text-gray-600">Upload meal photos to get AI-powered nutritional feedback</p>
                  </div>
                </div>
              </div>
            )}
            
            {currentStep === 2 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">Your Dashboard</h2>
                <p className="text-gray-600">
                  Your personalized dashboard gives you an overview of your progress, daily stats, 
                  and recommendations. You can track calories, macros, steps, and water intake.
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-6">
                  <div className="bg-white rounded-lg shadow-sm p-4 border">
                    <p className="text-gray-500 text-sm">Daily Calories</p>
                    <p className="text-2xl font-bold text-gray-900">1,450</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-primary-500 h-2 rounded-full" style={{width: '65%'}}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Target: 2,200</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-4 border">
                    <p className="text-gray-500 text-sm">Protein</p>
                    <p className="text-2xl font-bold text-gray-900">85g</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-primary-500 h-2 rounded-full" style={{width: '60%'}}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Target: 140g</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-4 border">
                    <p className="text-gray-500 text-sm">Steps</p>
                    <p className="text-2xl font-bold text-gray-900">7,500</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-primary-500 h-2 rounded-full" style={{width: '75%'}}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Target: 10,000</p>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm p-4 border">
                    <p className="text-gray-500 text-sm">Water</p>
                    <p className="text-2xl font-bold text-gray-900">5</p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div className="bg-primary-500 h-2 rounded-full" style={{width: '63%'}}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Target: 8 glasses</p>
                  </div>
                </div>
              </div>
            )}
            
            {currentStep === 3 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">Meal Photo Analysis</h2>
                <p className="text-gray-600">
                  Our newest feature lets you take a photo of your meal and get instant AI-powered nutritional analysis. 
                  Simply click the + button in the daily check-in form, upload a photo, and get detailed feedback!
                </p>
                <div className="my-6 border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-center mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                        <line x1="9" y1="9" x2="9.01" y2="9"></line>
                        <line x1="15" y1="9" x2="15.01" y2="9"></line>
                      </svg>
                    </div>
                    <span className="ml-3 font-medium">How was your day?</span>
                  </div>
                  <div className="relative mb-3">
                    <div className="border rounded-lg p-4 bg-white">
                      <p className="text-gray-600">Tell us more about your day...</p>
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <span className="font-medium">Tip:</span> Click the + button to upload a photo of your meal and receive instant nutritional analysis.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {currentStep === 4 && (
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">Ready to Start!</h2>
                <p className="text-gray-600">
                  You're all set to begin your fitness journey with Layover Fuel. Your personalized recommendations are
                  ready, and you can start logging your meals and workouts right away.
                </p>
                <div className="my-6">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-green-800">Your account is fully set up</p>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-green-800">Your meal plan is personalized</p>
                    </div>
                  </div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <p className="text-green-800">Your workout routine is ready</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex justify-between mt-6">
              {currentStep > 1 && (
                <button 
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="px-4 py-2 text-primary-600 hover:text-primary-800 font-medium"
                >
                  Back
                </button>
              )}
              {currentStep < 4 ? (
                <button 
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 font-medium ml-auto"
                >
                  Next
                </button>
              ) : (
                <button 
                  onClick={() => setShowDashboard(true)}
                  className="px-6 py-2 bg-primary-500 text-white rounded-md hover:bg-primary-600 font-medium ml-auto"
                >
                  Go to Dashboard
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Dashboard view
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary-500 text-white p-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Layover Fuel</h1>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary-300 flex items-center justify-center text-primary-800 font-bold">
                  G
                </div>
                <span className="ml-2">Guide User</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Your Dashboard</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-500 text-sm">Daily Calories</p>
            <p className="text-2xl font-bold text-gray-900">1,450</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-primary-500 h-2 rounded-full" style={{width: '65%'}}></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Target: 2,200</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-500 text-sm">Protein</p>
            <p className="text-2xl font-bold text-gray-900">85g</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-primary-500 h-2 rounded-full" style={{width: '60%'}}></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Target: 140g</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-500 text-sm">Steps</p>
            <p className="text-2xl font-bold text-gray-900">7,500</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-primary-500 h-2 rounded-full" style={{width: '75%'}}></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Target: 10,000</p>
          </div>
          
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-gray-500 text-sm">Water</p>
            <p className="text-2xl font-bold text-gray-900">5</p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div className="bg-primary-500 h-2 rounded-full" style={{width: '63%'}}></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">Target: 8 glasses</p>
          </div>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Today's Plan</h2>
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="mb-6">
              <h3 className="text-lg font-medium text-primary-700 mb-2">Meal Recommendations</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-3">
                  <p className="font-medium text-gray-800">Breakfast</p>
                  <p className="text-sm text-gray-600">Greek yogurt with berries and a sprinkle of granola</p>
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="mr-2">320 cal</span>
                    <span className="mr-2">24g protein</span>
                    <span>42g carbs</span>
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-medium text-gray-800">Lunch</p>
                  <p className="text-sm text-gray-600">Grilled chicken salad with olive oil dressing</p>
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="mr-2">450 cal</span>
                    <span className="mr-2">35g protein</span>
                    <span>12g carbs</span>
                  </div>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-medium text-gray-800">Dinner</p>
                  <p className="text-sm text-gray-600">Salmon with roasted vegetables</p>
                  <div className="mt-2 text-xs text-gray-500">
                    <span className="mr-2">520 cal</span>
                    <span className="mr-2">38g protein</span>
                    <span>25g carbs</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium text-primary-700 mb-2">Workout Plan</h3>
              <div className="border rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <p className="font-medium text-gray-800">Hotel Room HIIT</p>
                  <p className="text-sm text-gray-600">20 minutes</p>
                </div>
                <p className="text-sm text-gray-600 mb-3">A quick high-intensity workout that requires no equipment</p>
                <div className="space-y-2">
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-sm font-medium">Warm-up (3 minutes)</p>
                    <p className="text-xs text-gray-600">Jumping jacks, high knees, arm circles</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-sm font-medium">Circuit (15 minutes)</p>
                    <p className="text-xs text-gray-600">Bodyweight squats, push-ups, mountain climbers, plank</p>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <p className="text-sm font-medium">Cool-down (2 minutes)</p>
                    <p className="text-xs text-gray-600">Stretching</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Daily Check-in</h2>
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mb-4">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Try our new feature!</span> Click the + button below to upload a photo of your meal and receive instant AI-powered nutritional analysis.
            </p>
          </div>
          <DailyCheckInCard />
        </div>
      </div>
    </div>
  );
}