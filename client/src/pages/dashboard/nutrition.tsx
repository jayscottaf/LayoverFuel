import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileNavigation } from "@/components/dashboard/MobileNavigation";
import { MacroDistributionChart } from "@/components/dashboard/MacroDistributionChart";
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

const nutritionSchema = z.object({
  calories: z.string().transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, {
    message: "Must be a valid number"
  }),
  protein: z.string().transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, {
    message: "Must be a valid number"
  }),
  carbs: z.string().transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, {
    message: "Must be a valid number"
  }),
  fat: z.string().transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, {
    message: "Must be a valid number"
  }),
  fiber: z.string().transform(v => Number(v)).optional().refine(v => v === undefined || (!isNaN(v) && v >= 0), {
    message: "Must be a valid number"
  }),
  notes: z.string().optional(),
});

type NutritionFormValues = z.infer<typeof nutritionSchema>;

export default function NutritionPage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dashboard data to get current nutrition logs and targets
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['/api/dashboard'],
  });

  const form = useForm<NutritionFormValues>({
    resolver: zodResolver(nutritionSchema),
    defaultValues: {
      calories: dashboardData?.stats?.currentCalories?.toString() || "0",
      protein: dashboardData?.stats?.currentProtein?.toString() || "0",
      carbs: dashboardData?.nutritionLog?.carbs?.toString() || "0",
      fat: dashboardData?.nutritionLog?.fat?.toString() || "0",
      fiber: dashboardData?.nutritionLog?.fiber?.toString() || "0",
      notes: dashboardData?.nutritionLog?.notes || "",
    },
  });

  // Update form values when data is loaded
  useEffect(() => {
    if (dashboardData) {
      form.reset({
        calories: dashboardData.stats.currentCalories.toString(),
        protein: dashboardData.stats.currentProtein.toString(),
        carbs: (dashboardData.nutritionLog?.carbs || 0).toString(),
        fat: (dashboardData.nutritionLog?.fat || 0).toString(),
        fiber: (dashboardData.nutritionLog?.fiber || 0).toString(),
        notes: dashboardData.nutritionLog?.notes || "",
      });
    }
  }, [dashboardData, form]);

  const nutritionMutation = useMutation({
    mutationFn: async (data: NutritionFormValues) => {
      const response = await apiRequest("POST", "/api/logs/nutrition", {
        calories: Number(data.calories),
        protein: Number(data.protein),
        carbs: Number(data.carbs),
        fat: Number(data.fat),
        fiber: data.fiber ? Number(data.fiber) : undefined,
        notes: data.notes,
      });
      
      if (!response.ok) {
        throw new Error("Failed to update nutrition log");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Nutrition Updated",
        description: "Your nutrition log has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update nutrition log. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: NutritionFormValues) => {
    nutritionMutation.mutate(data);
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
              Nutrition Tracking
            </Heading>
            <p className="text-gray-600">Track your daily macros and maintain your nutrition goals.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Macro Distribution Chart */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Today's Macros</CardTitle>
              </CardHeader>
              <CardContent>
                {!isLoading && dashboardData && (
                  <MacroDistributionChart 
                    protein={dashboardData.stats.currentProtein || 0}
                    carbs={dashboardData.nutritionLog?.carbs || 0}
                    fat={dashboardData.nutritionLog?.fat || 0}
                    totalCalories={dashboardData.stats.currentCalories || 0}
                  />
                )}
              </CardContent>
            </Card>
            
            {/* Nutrition Form */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Log Today's Nutrition</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="calories"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Calories</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="protein"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Protein (g)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="carbs"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Carbs (g)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="fat"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fat (g)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="fiber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fiber (g)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Any notes about today's nutrition" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={nutritionMutation.isPending}
                    >
                      {nutritionMutation.isPending ? "Updating..." : "Update Nutrition Log"}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
            
            {/* Daily Targets Card */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Your Daily Targets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-primary-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-primary-600">Calories</h3>
                    <p className="text-2xl font-bold">{dashboardData?.stats?.tdee || 0}</p>
                    <p className="text-sm text-gray-500">kcal / day</p>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-blue-600">Protein</h3>
                    <p className="text-2xl font-bold">{dashboardData?.stats?.macros?.protein || 0}g</p>
                    <p className="text-sm text-gray-500">
                      {dashboardData?.stats?.macros?.caloriesFromProtein || 0} kcal
                    </p>
                  </div>
                  
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-green-600">Carbs</h3>
                    <p className="text-2xl font-bold">{dashboardData?.stats?.macros?.carbs || 0}g</p>
                    <p className="text-sm text-gray-500">
                      {dashboardData?.stats?.macros?.caloriesFromCarbs || 0} kcal
                    </p>
                  </div>
                  
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <h3 className="text-sm font-medium text-yellow-600">Fat</h3>
                    <p className="text-2xl font-bold">{dashboardData?.stats?.macros?.fat || 0}g</p>
                    <p className="text-sm text-gray-500">
                      {dashboardData?.stats?.macros?.caloriesFromFat || 0} kcal
                    </p>
                  </div>
                </div>
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
