import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./dialog";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Scale } from "lucide-react";

interface WeightLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentWeight?: number;
}

export function WeightLogDialog({ open, onOpenChange, currentWeight }: WeightLogDialogProps) {
  const [weight, setWeight] = useState(currentWeight?.toString() || "");
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const logWeightMutation = useMutation({
    mutationFn: async (data: { weight: number }) => {
      const today = new Date().toISOString().split('T')[0];
      return apiRequest("POST", "/api/logs/health", {
        date: today,
        weight: data.weight,
      });
    },
    onSuccess: () => {
      toast({
        title: "Weight logged!",
        description: `${weight} ${unit} recorded for today`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/logs/health'] });
      onOpenChange(false);
      setWeight("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to log weight. Please try again.",
        variant: "destructive",
      });
      console.error("Weight log error:", error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const weightNum = parseFloat(weight);

    if (isNaN(weightNum) || weightNum <= 0) {
      toast({
        title: "Invalid weight",
        description: "Please enter a valid weight",
        variant: "destructive",
      });
      return;
    }

    // Convert to kg for storage (database stores in kg)
    const weightInKg = unit === "lbs" ? weightNum * 0.453592 : weightNum;
    logWeightMutation.mutate({ weight: weightInKg });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-gray-900 border-gray-800 overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-white text-lg">
            <Scale className="h-5 w-5 text-blue-400" />
            Log Today's Weight
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-sm">
            Track your weight to calculate your actual calorie burn
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="weight" className="text-gray-300 text-sm">Weight</Label>
            <div className="flex gap-2">
              <Input
                id="weight"
                type="number"
                step="0.1"
                placeholder="Enter weight"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                autoFocus
              />
              <div className="flex rounded-md border border-gray-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setUnit("lbs")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    unit === "lbs"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  lbs
                </button>
                <button
                  type="button"
                  onClick={() => setUnit("kg")}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    unit === "kg"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  kg
                </button>
              </div>
            </div>
          </div>

          {currentWeight && (
            <p className="text-sm text-gray-400">
              Last recorded: {Math.round(currentWeight * 2.20462 * 2) / 2} lbs
            </p>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={logWeightMutation.isPending}
              className="text-white border-gray-700 bg-gray-800 hover:bg-gray-700"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={logWeightMutation.isPending || !weight}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {logWeightMutation.isPending ? "Logging..." : "Log Weight"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
