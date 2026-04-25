import { Link } from "wouter";

export function OnboardingSidebar() {
  return (
    <div className="hidden md:flex w-1/3 bg-indigo-600 text-white p-8 flex-col justify-between">
      <div>
        <div className="mb-12">
          <h1 className="font-heading text-3xl font-bold mb-2">Layover Fuel</h1>
          <p className="text-indigo-100 text-lg">Your travel fitness companion</p>
        </div>
        
        <div className="space-y-8">
          <div className="flex items-start">
            <div className="bg-white bg-opacity-20 rounded-full p-2 mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-xl">Personalized Plans</h3>
              <p className="text-indigo-100 mt-1">Custom workouts and nutrition tailored to your travel schedule</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-white bg-opacity-20 rounded-full p-2 mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-xl">Track Progress</h3>
              <p className="text-indigo-100 mt-1">Monitor your fitness journey with intuitive dashboards</p>
            </div>
          </div>
          
          <div className="flex items-start">
            <div className="bg-white bg-opacity-20 rounded-full p-2 mr-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
            </div>
            <div>
              <h3 className="font-heading font-semibold text-xl">AI Coach</h3>
              <p className="text-indigo-100 mt-1">Get guidance and motivation from your personal AI fitness coach</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-16">
        <p className="text-indigo-100 text-sm">
          Already have an account? <Link href="/auth/login" className="text-white font-medium underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
