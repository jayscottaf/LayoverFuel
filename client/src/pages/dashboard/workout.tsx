import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNavigation } from "@/components/dashboard/MobileNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Heading } from "@/components/ui/heading";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const workoutSchema = z.object({
  workoutType: z.string().min(1, { message: "Workout type is required" }),
  duration: z.string().transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, {
    message: "Must be a valid number"
  }),
  intensity: z.string().min(1, { message: "Intensity is required" }),
  equipment: z.string().optional(),
  notes: z.string().optional(),
});

type WorkoutFormValues = z.infer<typeof workoutSchema>;

export default function WorkoutPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dashboard data to get current workout plan
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/dashboard'],
  });

  const form = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutSchema),
    defaultValues: {
      workoutType: dashboardData?.workoutLog?.workoutType || "hotel_room",
      duration: dashboardData?.workoutLog?.duration?.toString() || "0",
      intensity: dashboardData?.workoutLog?.intensity || "moderate",
      equipment: dashboardData?.workoutLog?.equipment?.join(", ") || "",
      notes: dashboardData?.workoutLog?.notes || "",
    },
  });

  // Update form values when data is loaded
  useEffect(() => {
    if (dashboardData?.workoutLog) {
      form.reset({
        workoutType: dashboardData.workoutLog.workoutType,
        duration: dashboardData.workoutLog.duration?.toString(),
        intensity: dashboardData.workoutLog.intensity,
        equipment: Array.isArray(dashboardData.workoutLog.equipment) 
          ? dashboardData.workoutLog.equipment.join(", ") 
          : dashboardData.workoutLog.equipment || "",
        notes: dashboardData.workoutLog.notes || "",
      });
    }
  }, [dashboardData, form]);

  const workoutMutation = useMutation({
    mutationFn: async (data: WorkoutFormValues) => {
      const response = await apiRequest("POST", "/api/logs/workout", {
        workoutType: data.workoutType,
        duration: Number(data.duration),
        intensity: data.intensity,
        equipment: data.equipment ? data.equipment.split(",").map(e => e.trim()) : [],
        notes: data.notes,
      });
      
      if (!response.ok) {
        throw new Error("Failed to update workout log");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Workout Logged",
        description: "Your workout has been logged successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to log workout. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WorkoutFormValues) => {
    workoutMutation.mutate(data);
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      <DashboardHeader 
        userName={dashboardData?.user?.name || "User"} 
        onToggleSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)} 
      />
      
      <div className="flex">
        <Sidebar />
        
        {/* Mobile Sidebar (same as in Dashboard.tsx) */}
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
              Workout Tracking
            </Heading>
            <p className="text-gray-600">Log your workouts and track your fitness routine.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Today's Recommended Workout */}
            {dashboardData?.dailyPlan?.workout && (
              <Card>
                <CardHeader>
                  <CardTitle>Today's Recommended Workout</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <div className="bg-accent-100 p-2 rounded-lg mr-3">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-accent-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-medium text-lg">{dashboardData.dailyPlan.workout.title}</h3>
                        <p className="text-gray-600 text-sm">{dashboardData.dailyPlan.workout.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                            {dashboardData.dailyPlan.workout.duration}
                          </span>
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                            {dashboardData.dailyPlan.workout.intensityLevel} Intensity
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-4 border-t pt-4">
                      <h4 className="font-medium mb-2">Workout Sections:</h4>
                      <div className="space-y-3">
                        {dashboardData.dailyPlan.workout.sections.map((section, i) => (
                          <div key={i} className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex justify-between">
                              <span className="font-medium">{section.name}</span>
                              <span className="text-sm text-gray-500">{section.duration}</span>
                            </div>
                            <ul className="mt-1 text-sm text-gray-600">
                              {section.exercises.map((exercise, j) => (
                                <li key={j}>
                                  {exercise.sets} x {exercise.reps} {exercise.name}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    <Button 
                      className="w-full mt-4"
                      onClick={() => {
                        // Pre-fill the form with today's workout details
                        form.setValue("workoutType", dashboardData.dailyPlan.workout.title.toLowerCase().replace(/\s+/g, '_'));
                        form.setValue("duration", dashboardData.dailyPlan.workout.duration.replace(/\D/g, ''));
                        form.setValue("intensity", dashboardData.dailyPlan.workout.intensityLevel.toLowerCase());
                        form.setValue("notes", `Completed the recommended workout: ${dashboardData.dailyPlan.workout.title}`);
                      }}
                    >
                      Use This Workout
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Log Workout Form */}
            <Card>
              <CardHeader>
                <CardTitle>Log Today's Workout</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="workoutType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Workout Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a workout type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="hotel_room">Hotel Room Workout</SelectItem>
                              <SelectItem value="gym">Gym Workout</SelectItem>
                              <SelectItem value="cardio">Cardio</SelectItem>
                              <SelectItem value="stretching">Stretching/Yoga</SelectItem>
                              <SelectItem value="walking">Walking</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="duration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Duration (minutes)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                min="0" 
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="intensity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Intensity</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select intensity" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="light">Light</SelectItem>
                                <SelectItem value="moderate">Moderate</SelectItem>
                                <SelectItem value="intense">Intense</SelectItem>
                                <SelectItem value="very_intense">Very Intense</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="equipment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Equipment Used (comma separated)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g. dumbbells, resistance bands, bodyweight"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Workout Notes</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="How did the workout feel? What went well? What could improve?"
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={workoutMutation.isPending}
                    >
                      {workoutMutation.isPending ? "Logging Workout..." : "Log Workout"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>
        </main>
        
        {/* Mobile Navigation */}
        <MobileNavigation />
      </div>
    </div>
  );
}
