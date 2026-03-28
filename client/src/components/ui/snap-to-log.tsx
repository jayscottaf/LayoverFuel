import { useState } from "react";
import { X, Check, Camera, Loader2, ChevronRight, Pencil } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface MealEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AnalysisResult {
  estimate: MealEstimate;
  foodItems: string[];
  analysis: string;
}

interface DashboardStats {
  stats: {
    currentCalories: number;
    currentProtein: number;
    macros: { targetCalories: number; protein: number };
  };
}

interface SnapToLogProps {
  onClose: () => void;
  onLogSuccess?: () => void;
}

export function SnapToLog({ onClose, onLogSuccess }: SnapToLogProps) {
  const [image, setImage] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [description, setDescription] = useState("");
  const [macros, setMacros] = useState<MealEstimate>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: dashboard } = useQuery<DashboardStats>({ queryKey: ["/api/dashboard"] });
  const targetCal = dashboard?.stats?.macros?.targetCalories ?? 0;
  const targetPro = dashboard?.stats?.macros?.protein ?? 0;
  const remainingCal = Math.max(targetCal - (dashboard?.stats?.currentCalories ?? 0), 0);
  const remainingPro = Math.max(targetPro - (dashboard?.stats?.currentProtein ?? 0), 0);

  const handleImageSelect = async (_file: File, preview: string) => {
    setImage(preview);
    setResult(null);
    setIsEditing(false);
    setAnalysing(true);
    try {
      const res = await apiRequest("POST", "/api/meal-analysis", { imageData: preview });
      const data = await res.json();
      if (!data.result) throw new Error("No result");
      const r: AnalysisResult = data.result;
      setResult(r);
      const desc = r.foodItems?.length ? r.foodItems.join(", ") : "Detected meal";
      setDescription(desc);
      setMacros(r.estimate);
    } catch {
      toast({ title: "Analysis failed", description: "Couldn't identify this meal. Try a clearer photo.", variant: "destructive" });
      setImage(null);
    } finally {
      setAnalysing(false);
    }
  };

  const handleLog = async () => {
    if (!result) return;
    setIsLogging(true);
    try {
      await apiRequest("POST", "/api/logs/nutrition", {
        date: new Date().toISOString().slice(0, 10),
        calories: macros.calories,
        protein: macros.protein,
        carbs: macros.carbs,
        fat: macros.fat,
        mealStyle: description,
        notes: "Snap to Log · Photo analysis",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Logged!", description: `${description} added to today's log.` });
      onLogSuccess?.();
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to log. Please try again.", variant: "destructive" });
    } finally {
      setIsLogging(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setIsEditing(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-indigo-400" />
          <h2 className="text-white font-semibold">Snap to Log</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">

        {/* No image yet */}
        {!image && !analysing && (
          <div className="text-center space-y-5 w-full max-w-xs">
            <div className="w-20 h-20 rounded-3xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto">
              <Camera className="h-10 w-10 text-indigo-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Photo Log</p>
              <p className="text-gray-400 text-sm mt-1">Take or upload a photo of your meal and AI will instantly estimate the nutrition.</p>
            </div>
            <ImageUpload
              onImageSelect={handleImageSelect}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Camera className="h-5 w-5" />
              Take or upload a photo
            </ImageUpload>
            <p className="text-xs text-gray-600">Works best with plated meals, restaurant dishes, and home cooking</p>
          </div>
        )}

        {/* Analysing */}
        {analysing && (
          <div className="text-center space-y-3">
            {image && (
              <img src={image} alt="Meal" className="w-40 h-40 rounded-2xl object-cover mx-auto opacity-60" />
            )}
            <Loader2 className="h-10 w-10 text-indigo-400 animate-spin mx-auto" />
            <p className="text-white font-medium">Analysing your meal...</p>
            <p className="text-gray-500 text-sm">Estimating calories and macros</p>
          </div>
        )}

        {/* Result */}
        {result && image && !analysing && (
          <div className="w-full max-w-sm space-y-3">
            {/* Photo */}
            <img src={image} alt="Meal" className="w-full rounded-2xl object-cover max-h-44" />

            {/* Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-2">
                Meal Detected
              </p>

              {isEditing ? (
                <div className="space-y-2">
                  <input
                    className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700 focus:outline-none focus:border-indigo-500"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Meal description"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {(["calories", "protein", "carbs", "fat"] as const).map(k => (
                      <div key={k}>
                        <p className="text-xs text-gray-500 mb-1 capitalize">{k === "calories" ? "Cal" : k}</p>
                        <input
                          type="number"
                          className="w-full bg-gray-800 text-white text-sm rounded-xl px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-indigo-500 text-center"
                          value={macros[k]}
                          onChange={e => setMacros(prev => ({ ...prev, [k]: Number(e.target.value) }))}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-white font-semibold text-sm leading-snug">{description}</p>
                  <div className="grid grid-cols-4 gap-2 mt-3">
                    {[
                      { label: "Cal", value: macros.calories, unit: "", color: "text-white" },
                      { label: "Protein", value: macros.protein, unit: "g", color: "text-blue-400" },
                      { label: "Carbs", value: macros.carbs, unit: "g", color: "text-emerald-400" },
                      { label: "Fat", value: macros.fat, unit: "g", color: "text-amber-400" },
                    ].map(({ label, value, unit, color }) => (
                      <div key={label} className="bg-gray-800 rounded-xl p-2.5 text-center">
                        <p className={`text-sm font-bold ${color}`}>
                          {Math.round(value)}<span className="text-xs font-normal opacity-60">{unit}</span>
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Fits your day */}
              {targetCal > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Remaining today</span>
                  <span className="text-xs font-medium text-gray-300">
                    {remainingCal} cal · {remainingPro}g protein
                  </span>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(p => !p)}
                className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-2xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                <Pencil className="h-4 w-4" />
                {isEditing ? "Done" : "Edit"}
              </button>
              <button
                onClick={handleLog}
                disabled={isLogging}
                className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
              >
                {isLogging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {isLogging ? "Logging..." : "Log it"}
              </button>
            </div>

            <button
              onClick={reset}
              className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
              Try different photo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
