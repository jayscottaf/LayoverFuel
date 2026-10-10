import { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Check, Camera, Loader2, ChevronRight, Pencil, Undo, WifiOff } from "lucide-react";
import { MealCamera } from "@/components/ui/meal-camera";
import { AIProgress, type AIProgressStep } from "@/components/ui/ai-progress";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { errorToast } from "@/lib/toast-helpers";
import { queueItem } from "@/lib/offline-queue";
import { currentTimezone } from "@/lib/utils/timezone";
import { useOffline } from "@/hooks/use-offline";

interface MealEstimate {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface AnalysisResult {
  estimate: MealEstimate;
  range?: { caloriesLow: number; caloriesHigh: number };
  confidence?: "low" | "medium" | "high";
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

interface UserProfile {
  quickLogMode: boolean | null;
}

interface SnapToLogProps {
  onClose: () => void;
  onLogSuccess?: () => void;
  dashboard?: DashboardStats;
}

export function SnapToLog({ onClose, onLogSuccess, dashboard }: SnapToLogProps) {
  const [image, setImage] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const analysisRun = useRef(0);
  const analysisRequest = useRef<AbortController | null>(null);
  const [progressStep, setProgressStep] = useState<AIProgressStep>("upload");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [description, setDescription] = useState("");
  const [macros, setMacros] = useState<MealEstimate>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [isEditing, setIsEditing] = useState(false);
  const [isLogging, setIsLogging] = useState(false);
  const [showUndo, setShowUndo] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [undoError, setUndoError] = useState(false);
  const writeInFlight = useRef(false);
  const savedLogId = useRef<number | null>(null);
  const mounted = useRef(true);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // The home page owns totals; mounting capture must not retry that query.
  const { data: profile } = useQuery<UserProfile>({ queryKey: ["/api/user/profile"] });
  const { isOffline, refreshPendingCount } = useOffline();

  const targetCal = dashboard?.stats?.macros?.targetCalories ?? 0;
  const targetPro = dashboard?.stats?.macros?.protein ?? 0;
  const remainingCal = Math.max(targetCal - (dashboard?.stats?.currentCalories ?? 0), 0);
  const remainingPro = Math.max(targetPro - (dashboard?.stats?.currentProtein ?? 0), 0);

  const quickLogMode = profile?.quickLogMode ?? false;
  const validMeal = description.trim().length > 0 &&
    Object.values(macros).every(value => Number.isFinite(value) && value >= 0);

  const refreshMealData = () => {
    void queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/tdee/adaptive"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/logs/nutrition"] });
  };

  const analysePreview = async (preview: string) => {
    if (!mounted.current || writeInFlight.current || savedLogId.current !== null) return;
    const run = ++analysisRun.current;
    analysisRequest.current?.abort();
    const controller = new AbortController();
    analysisRequest.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60_000);
    setImage(preview);
    setResult(null);
    setIsEditing(false);
    setAnalysing(true);
    setAnalysisFailed(false);
    setSaveError(null);
    setProgressStep("upload");
    try {
      // Brief upload step so the stepper animation is perceptible
      setProgressStep("analyze");
      const res = await apiRequest("POST", "/api/meal-analysis", { imageData: preview }, { signal: controller.signal });
      const data = await res.json();
      if (run !== analysisRun.current) return;
      if (!data.result) throw new Error("No result");
      const r: AnalysisResult = data.result;
      if (!r.estimate || ![r.estimate.calories, r.estimate.protein, r.estimate.carbs, r.estimate.fat]
        .every(value => typeof value === "number" && Number.isFinite(value) && value >= 0)) {
        throw new Error("Invalid meal estimate");
      }
      setProgressStep("ready");
      setResult(r);
      const desc = r.foodItems?.length ? r.foodItems.join(", ") : "Detected meal";
      setDescription(desc);
      setMacros(r.estimate);

      // Auto-log if Quick Log Mode is enabled
      if (quickLogMode) {
        await saveMeal(desc, r.estimate, true);
      }
    } catch {
      if (run !== analysisRun.current) return;
      setAnalysisFailed(true);
      errorToast({
        title: "Analysis failed",
        description: "Couldn't identify this meal. Try again or use a clearer photo.",
        onRetry: () => analysePreview(preview),
      });
    } finally {
      clearTimeout(timeout);
      if (run === analysisRun.current) setAnalysing(false);
    }
  };

  const handleImageSelect = async (_file: File, preview: string) => {
    await analysePreview(preview);
  };

  const saveMeal = async (desc: string, estimate: MealEstimate, quick = false) => {
    if (writeInFlight.current || savedLogId.current !== null) return;
    if (!desc.trim() || !Object.values(estimate).every(value => Number.isFinite(value) && value >= 0)) return;
    writeInFlight.current = true;
    setIsLogging(true);
    setSaveError(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const logData = {
      date: new Date().toISOString().slice(0, 10),
      calories: estimate.calories,
      protein: estimate.protein,
      carbs: estimate.carbs,
      fat: estimate.fat,
      mealStyle: desc.trim(),
      notes: "Snap to Log · Photo analysis",
      timezone: currentTimezone(),
    };

    try {
      if (isOffline) {
        // Queue for later sync
        await queueItem('nutrition', logData);
        await refreshPendingCount();

        toast({
          title: "Queued Offline",
          description: `${desc} saved. Will sync when online.`,
        });

        if (mounted.current) {
          onLogSuccess?.();
          onClose();
        }
      } else {
        const response = await apiRequest("POST", "/api/logs/nutrition", logData, { signal: controller.signal });
        const saved = await response.json();
        if (!Number.isSafeInteger(saved.id) || saved.id <= 0) throw new Error("Missing saved meal id");
        savedLogId.current = saved.id;
        refreshMealData();
        if (!mounted.current) return;

        if (quick) {
          setShowUndo(true);
          setUndoError(false);
          if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
          undoTimeoutRef.current = setTimeout(() => {
            setShowUndo(false);
            onLogSuccess?.();
            onClose();
          }, 5000);
        } else {
          toast({ title: "Logged!", description: `${desc} added to today's log.` });
          onLogSuccess?.();
          onClose();
        }
      }
    } catch {
      if (mounted.current) {
        setSaveError("Couldn't confirm the save. Your photo and edits are still here. Check your diary before retrying to avoid a duplicate.");
      }
    } finally {
      clearTimeout(timeout);
      writeInFlight.current = false;
      if (mounted.current) setIsLogging(false);
    }
  };

  const handleUndo = async () => {
    if (writeInFlight.current || savedLogId.current === null) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    writeInFlight.current = true;
    setIsUndoing(true);
    setUndoError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      try {
        await apiRequest("DELETE", `/api/logs/nutrition/${savedLogId.current}`, undefined, { signal: controller.signal });
      } catch (error) {
        // A response-loss retry can find that the first deletion already succeeded.
        if (!(error instanceof Error) || !error.message.startsWith("404:")) throw error;
      }
      savedLogId.current = null;
      refreshMealData();
      if (mounted.current) {
        setShowUndo(false);
        toast({ title: "Meal removed", description: "Your photo and edits are ready to review again." });
      }
    } catch {
      if (mounted.current) setUndoError(true);
    } finally {
      clearTimeout(timeout);
      writeInFlight.current = false;
      if (mounted.current) setIsUndoing(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      analysisRun.current += 1;
      analysisRequest.current?.abort();
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  const handleLog = () => { if (result) void saveMeal(description, macros); };
  const requestClose = () => { if (!writeInFlight.current) onClose(); };

  const reset = () => {
    setImage(null);
    setResult(null);
    setIsEditing(false);
    setAnalysisFailed(false);
    setSaveError(null);
  };

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) requestClose(); }}>
    <Dialog.Portal>
    <Dialog.Content
      aria-describedby={undefined}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-indigo-400" />
          <Dialog.Title className="text-white font-semibold">Snap to Log</Dialog.Title>
          {isOffline && (
            <div className="flex items-center gap-1 bg-orange-500/20 rounded-full px-2 py-0.5 border border-orange-500/40">
              <WifiOff className="h-3 w-3 text-orange-400" />
              <span className="text-xs font-medium text-orange-400">Offline</span>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Close photo log"
          onClick={requestClose}
          disabled={isLogging || isUndoing}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">

        {/* No image yet */}
        {!image && !analysing && (
          <MealCamera onCapture={preview => void analysePreview(preview)} onImageSelect={handleImageSelect} />
        )}

        {/* Analysing */}
        {analysing && (
          <div role="status" className="mx-auto max-w-sm py-8 text-center space-y-4">
            {image && (
              <img src={image} alt="Meal" className="w-40 h-40 rounded-2xl object-cover mx-auto opacity-60" />
            )}
            <AIProgress step={progressStep} className="justify-center" />
            <p className="text-white font-medium">Analysing your meal...</p>
            <p className="text-gray-500 text-sm">Estimating calories and macros</p>
          </div>
        )}

        {analysisFailed && image && !analysing && (
          <div role="alert" className="mx-auto max-w-sm space-y-4 py-6 text-center">
            <img src={image} alt="Meal photo awaiting an estimate" className="max-h-60 w-full rounded-lg object-cover" />
            <p className="font-medium text-white">Couldn't estimate this photo</p>
            <p className="text-sm text-gray-400">Your photo is still here. Check your connection and try again.</p>
            <button type="button" onClick={() => void analysePreview(image)} className="min-h-12 w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white">Retry estimate</button>
            <button type="button" onClick={reset} className="min-h-12 w-full rounded-lg border border-gray-700 px-4 py-3 text-gray-300">Use a different photo</button>
          </div>
        )}

        {/* Result */}
        {result && image && !analysing && (
          <div className="mx-auto w-full max-w-sm space-y-3">
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
                    aria-label="Meal description"
                    disabled={isLogging}
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
                          aria-label={k === "calories" ? "Calories" : k[0].toUpperCase() + k.slice(1)}
                          disabled={isLogging}
                          min="0"
                          step="any"
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
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 break-words text-white font-semibold text-sm leading-snug">{description}</p>
                    {result?.confidence && (
                      <span
                        className={`shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          result.confidence === "high"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : result.confidence === "medium"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-orange-500/20 text-orange-300"
                        }`}
                        title="How confident the AI is in this estimate"
                      >
                        {result.confidence} confidence
                      </span>
                    )}
                  </div>
                  {result?.range && result.range.caloriesLow !== result.range.caloriesHigh && (
                    <p className="text-xs text-gray-400 mt-1">
                      Estimated range: {result.range.caloriesLow}–{result.range.caloriesHigh} kcal
                    </p>
                  )}
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

            {/* Action buttons (hidden when logged in Quick Log Mode) */}
            {!showUndo && (
              <>
                {saveError && <p role="alert" className="text-sm text-red-300">{saveError}</p>}
                {!validMeal && <p role="alert" className="text-sm text-amber-300">Enter a meal name and non-negative nutrition values.</p>}
                <div className="flex gap-2">
                  <button
                    disabled={isLogging}
                    onClick={() => setIsEditing(p => !p)}
                    className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-2xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
                  >
                    <Pencil className="h-4 w-4" />
                    {isEditing ? "Done" : "Edit"}
                  </button>
                  <button
                    onClick={handleLog}
                    disabled={isLogging || !validMeal}
                    className="flex items-center justify-center gap-1.5 flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                  >
                    {isLogging ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    {isLogging ? "Logging..." : "Log it"}
                  </button>
                </div>

                <button
                  onClick={reset}
                  disabled={isLogging}
                  className="w-full py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors flex items-center justify-center gap-1.5"
                >
                  <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                  Try different photo
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Undo Toast (Quick Log Mode only) */}
      {showUndo && (
        <div role="status" className="shrink-0 px-4 pb-6 flex justify-center">
          <div className="bg-green-600 text-white rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-4 max-w-sm w-full border border-green-500">
            <Check className="h-5 w-5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{undoError ? "Removal not confirmed" : "Logged!"}</p>
              <p className="text-xs text-green-100 truncate">{description}</p>
              {undoError && <p className="text-xs text-green-100">Try Undo again to check.</p>}
            </div>
            <button
              onClick={handleUndo}
              disabled={isUndoing}
              className="shrink-0 bg-white/20 hover:bg-white/30 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1"
            >
              {isUndoing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo className="h-3.5 w-3.5" />}
              {isUndoing ? "Removing..." : "Undo"}
            </button>
          </div>
        </div>
      )}
    </Dialog.Content>
    </Dialog.Portal>
    </Dialog.Root>
  );
}
