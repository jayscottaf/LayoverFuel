import { useEffect, useState } from "react";
import { OnboardingSidebar } from "./OnboardingSidebar";
import { OnboardingChat } from "./OnboardingChat";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function OnboardingView() {
  const [initialQuestion, setInitialQuestion] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchInitialQuestion = async () => {
      try {
        const response = await apiRequest("GET", "/api/onboarding/current-question");
        
        if (!response.ok) {
          throw new Error("Failed to fetch initial question");
        }
        
        const data = await response.json();
        setInitialQuestion(data.question.text);
      } catch (error) {
        console.error("Error fetching initial question:", error);
        toast({
          title: "Error",
          description: "Failed to start onboarding. Please try again.",
          variant: "destructive"
        });
        setInitialQuestion("Hi there! I'm your Layover Fuel fitness coach. I'll help you stay fit while traveling. Let's get to know each other better. What's your name?");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialQuestion();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="dot-typing mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your fitness coach...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-white">
      <OnboardingSidebar />
      <OnboardingChat initialQuestion={initialQuestion} />
    </div>
  );
}
