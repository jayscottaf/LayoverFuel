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
import { calculateTDEE } from "@/lib/utils/tdee-calculator";

const profileSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  age: z.string().transform(v => Number(v)).refine(v => !isNaN(v) && v > 0 && v < 120, {
    message: "Age must be between 1 and 120"
  }),
  heightCm: z.string().transform(v => Number(v)).refine(v => !isNaN(v) && v > 0, {
    message: "Height must be a positive number"
  }),
  weightKg: z.string().transform(v => Number(v)).refine(v => !isNaN(v) && v > 0, {
    message: "Weight must be a positive number"
  }),
  gender: z.enum(["male", "female", "other"]),
  fitnessGoal: z.enum(["shred", "sustain"]),
  activityLevel: z.enum(["lightly_active", "moderate", "very_active"]),
  maxCommuteMinutes: z.string().transform(v => Number(v)).refine(v => !isNaN(v) && v >= 0, {
    message: "Must be a valid number"
  }),
  dietaryRestrictions: z.string().optional(),
  gymMemberships: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [estimatedTDEE, setEstimatedTDEE] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user profile data
  const { data: userData, isLoading } = useQuery({
    queryKey: ['/api/user/profile'],
  });

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      age: "",
      heightCm: "",
      weightKg: "",
      gender: "male",
      fitnessGoal: "sustain",
      activityLevel: "moderate",
      maxCommuteMinutes: "15",
      dietaryRestrictions: "",
      gymMemberships: "",
    },
  });

  // Update form when user data is loaded
  useEffect(() => {
    if (userData) {
      form.reset({
        name: userData.name || "",
        age: userData.age?.toString() || "",
        heightCm: userData.heightCm?.toString() || "",
        weightKg: userData.weightKg?.toString() || "",
        gender: userData.gender || "male",
        fitnessGoal: userData.fitnessGoal || "sustain",
        activityLevel: userData.activityLevel || "moderate",
        maxCommuteMinutes: userData.maxCommuteMinutes?.toString() || "15",
        dietaryRestrictions: Array.isArray(userData.dietaryRestrictions) 
          ? userData.dietaryRestrictions.join(", ") 
          : userData.dietaryRestrictions || "",
        gymMemberships: Array.isArray(userData.gymMemberships) 
          ? userData.gymMemberships.join(", ") 
          : userData.gymMemberships || "",
      });
      
      // Set initial TDEE
      if (userData.tdee) {
        setEstimatedTDEE(userData.tdee);
      }
    }
  }, [userData, form]);

  // Update TDEE calculation when form values change
  useEffect(() => {
    const subscription = form.watch((values) => {
      try {
        const age = Number(values.age);
        const heightCm = Number(values.heightCm);
        const weightKg = Number(values.weightKg);
        const gender = values.gender;
        const activityLevel = values.activityLevel;
        
        if (age > 0 && heightCm > 0 && weightKg > 0 && gender && activityLevel) {
          const tdee = calculateTDEE({
            age,
            heightCm,
            weightKg,
            gender,
            activityLevel
          });
          setEstimatedTDEE(tdee);
        }
      } catch (error) {
        // Ignore calculation errors
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      // Convert string arrays to actual arrays
      const dietaryRestrictions = data.dietaryRestrictions
        ? data.dietaryRestrictions.split(",").map(item => item.trim())
        : [];
        
      const gymMemberships = data.gymMemberships
        ? data.gymMemberships.split(",").map(item => item.trim())
        : [];
      
      const response = await apiRequest("POST", "/api/onboarding/complete", {
        name: data.name,
        age: Number(data.age),
        heightCm: Number(data.heightCm),
        weightKg: Number(data.weightKg),
        gender: data.gender,
        fitnessGoal: data.fitnessGoal,
        activityLevel: data.activityLevel,
        maxCommuteMinutes: Number(data.maxCommuteMinutes),
        dietaryRestrictions,
        gymMemberships,
      });
      
      if (!response.ok) {
        throw new Error("Failed to update profile");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile Updated",
        description: "Your profile has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/user/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update profile. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileFormValues) => {
    profileMutation.mutate(data);
  };

  return (
    <div className="relative min-h-screen bg-gray-50">
      <DashboardHeader 
        userName={userData?.name || "User"} 
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
              Your Profile
            </Heading>
            <p className="text-gray-600">Manage your personal information and fitness goals.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {/* Profile Summary Card */}
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle>Profile Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {!isLoading && userData ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-center mb-6">
                      <div className="w-24 h-24 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-primary-700 font-bold text-2xl">
                          {userData.name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?'}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Goal:</span>
                        <span className="font-medium">
                          {userData.fitnessGoal === 'shred' ? 'Fat Loss' : 'Maintenance'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-500">Activity Level:</span>
                        <span className="font-medium">
                          {userData.activityLevel === 'lightly_active' 
                            ? 'Lightly Active' 
                            : userData.activityLevel === 'very_active' 
                              ? 'Very Active' 
                              : 'Moderate'}
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-500">TDEE:</span>
                        <span className="font-medium">
                          {userData.tdee || estimatedTDEE || '?'} calories
                        </span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-gray-500">Max Commute:</span>
                        <span className="font-medium">
                          {userData.maxCommuteMinutes || '?'} minutes
                        </span>
                      </div>
                    </div>
                    
                    {estimatedTDEE && estimatedTDEE !== userData.tdee && (
                      <div className="bg-yellow-50 p-3 rounded-lg text-sm mt-4">
                        <p className="text-yellow-700">
                          <span className="font-medium">Note:</span> Changes to your profile will update your TDEE to approximately {estimatedTDEE} calories.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="dot-typing"></div>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Profile Form */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Edit Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="age"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Age</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" max="120" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="heightCm"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Height (cm)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="weightKg"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Weight (kg)</FormLabel>
                            <FormControl>
                              <Input type="number" min="1" step="0.1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="gender"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Gender</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select gender" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="fitnessGoal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fitness Goal</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select goal" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="shred">Shred (Fat Loss)</SelectItem>
                                <SelectItem value="sustain">Sustain (Maintenance)</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="activityLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Activity Level</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select activity level" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="lightly_active">Lightly Active</SelectItem>
                                <SelectItem value="moderate">Moderate</SelectItem>
                                <SelectItem value="very_active">Very Active</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="maxCommuteMinutes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Max Commute Time (minutes)</FormLabel>
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
                      name="dietaryRestrictions"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Dietary Restrictions (comma separated)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g. vegetarian, dairy-free, gluten-free"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="gymMemberships"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gym Memberships (comma separated)</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="e.g. Planet Fitness, YMCA"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={profileMutation.isPending}
                    >
                      {profileMutation.isPending ? "Updating Profile..." : "Save Changes"}
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
