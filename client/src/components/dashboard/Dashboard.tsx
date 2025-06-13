import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "./DashboardHeader";
import { Sidebar } from "./Sidebar";
import { StatCard } from "./StatCard";
import { WeightProgressChart } from "./WeightProgressChart";
import { MacroDistributionChart } from "./MacroDistributionChart";
import { DailyPlanCard } from "./DailyPlanCard";
import { DailyCheckInCard } from "./DailyCheckInCard";
import { MobileNavigation } from "./MobileNavigation";
import { Heading } from "../ui/heading";
import { useToast } from "@/hooks/use-toast";

export interface DashboardData {
  user: {
    name: string;
    goal: string;
  };
  stats: {
    tdee: number;
    macros: {
      protein: number;
      carbs: number;
      fat: number;
      caloriesFromProtein: number;
      caloriesFromCarbs: number;
      caloriesFromFat: number;
    };
    currentCalories: number;
    calorieProgress: number;
    currentProtein: number;
    proteinProgress: number;
    currentSteps: number;
    stepsProgress: number;
    water: number;
    waterProgress: number;
  };
  dailyPlan: any;
  healthLog: any;
  nutritionLog: any;
  workoutLog: any;
}

export interface DashboardProps {
  demoData?: DashboardData;
}

export function Dashboard({ demoData }: DashboardProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { toast } = useToast();

  const { data: fetchedData, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['/api/dashboard'],
    enabled: !demoData, // Don't run the query if we have demo data
  });
  
  // Use demo data if provided, otherwise use fetched data
  const data = demoData || fetchedData;

  useEffect(() => {
    if (error) {
      toast({
        title: "Error",
        description: "Failed to load dashboard data. Please try again.",
        variant: "destructive",
      });
    }
  }, [error, toast]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="dot-typing mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  // Mock data for weight progress chart if no actual data
  const weightData = data?.healthLog?.weight 
    ? [{ date: new Date().toLocaleDateString(), weight: data.healthLog.weight }]
    : [];

  return (
    <div className="relative min-h-screen bg-gray-50">
      <DashboardHeader 
        userName={data?.user?.name || "User"} 
        onToggleSidebar={toggleMobileSidebar} 
      />
      
      <div className="flex">
        <Sidebar />
        
        {/* Mobile Sidebar */}
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-20">
            <div 
              className="absolute inset-0 bg-gray-600 bg-opacity-75" 
              onClick={() => setMobileSidebarOpen(false)}
            />
            
            <div className="relative flex flex-col w-64 max-w-xs bg-white h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="font-heading font-semibold text-lg">Menu</h2>
                <button 
                  onClick={() => setMobileSidebarOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <Sidebar />
            </div>
          </div>
        )}
        
        {/* Main Content */}
        <main className="flex-1 px-4 py-6 md:px-6 lg:px-8 pb-16 md:pb-6">
          <div className="mb-6">
            <Heading as="h2" className="text-2xl mb-2">
              Welcome back, {data?.user?.name || "User"}!
            </Heading>
            <p className="text-gray-600">Here's your fitness overview for today.</p>
          </div>
          
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <StatCard 
              title="Daily Calories" 
              value={data?.stats?.currentCalories || 0}
              target={data?.stats?.tdee || 2000}
              status={(data?.stats?.calorieProgress || 0) > 80 ? "on-track" : "low"}
              progress={data?.stats?.calorieProgress || 0}
            />
            
            <StatCard 
              title="Protein" 
              value={`${data?.stats?.currentProtein || 0}g`}
              target={`${data?.stats?.macros?.protein || 150}g`}
              status={(data?.stats?.proteinProgress || 0) > 80 ? "on-track" : "low"}
              progress={data?.stats?.proteinProgress || 0}
            />
            
            <StatCard 
              title="Daily Steps" 
              value={data?.stats?.currentSteps || 0}
              target={10000}
              status={(data?.stats?.stepsProgress || 0) > 80 ? "great" : "on-track"}
              progress={data?.stats?.stepsProgress || 0}
            />
            
            <StatCard 
              title="Water" 
              value={data?.stats?.water || 0}
              target="8 glasses"
              status="low"
              progress={data?.stats?.waterProgress || 30}
            />
          </div>
          
          {/* Progress Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            <WeightProgressChart 
              data={weightData}
              goalWeight={data?.user?.goal === 'shred' ? (data?.healthLog?.weight ? data.healthLog.weight * 0.9 : undefined) : undefined}
              className="col-span-1 md:col-span-2 lg:col-span-2"
            />
            
            <MacroDistributionChart 
              protein={data?.stats?.currentProtein || 0}
              carbs={data?.nutritionLog?.carbs || 0}
              fat={data?.nutritionLog?.fat || 0}
              totalCalories={data?.stats?.currentCalories || 0}
            />
          </div>
          
          {/* Daily Plan Section */}
          {data?.dailyPlan && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <Heading as="h2" className="text-xl">Today's Plan</Heading>
                <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">
                  View Full Plan
                </button>
              </div>
              
              <DailyPlanCard plan={data.dailyPlan} />
            </div>
          )}
          
          {/* Daily Check-in */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <Heading as="h2" className="text-xl">Daily Check-in</Heading>
            </div>
            
            <DailyCheckInCard />
          </div>
        </main>
        
        {/* Mobile Navigation */}
        <MobileNavigation />
      </div>
    </div>
  );
}
