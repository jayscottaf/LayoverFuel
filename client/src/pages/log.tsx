import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Plus,
  Flame,
  Beef,
  Wheat,
  Droplets,
  ChevronRight,
  Utensils,
  MessageCircle,
  Trash2,
  RotateCcw,
  Loader2,
  RefreshCw,
  CloudUpload,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useOffline } from "@/hooks/use-offline";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ToastAction } from "@/components/ui/toast";

interface MealLog {
  id: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  mealStyle: string;
  notes: string;
  date: string;
}

interface NutritionLog {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: MealLog[];
}

interface DashboardData {
  stats: {
    tdee: number;
    macros: { protein: number; carbs: number; fat: number };
    currentCalories: number;
    currentProtein: number;
    water: number;
  };
  nutritionLog: NutritionLog | null;
}

function StatPill({ icon, label, value, unit, color }: {
  icon: ReactNode; label: string; value: number; unit: string; color: string;
}) {
  return (
    <div className={`flex-1 bg-gray-900 rounded-2xl p-3 flex flex-col gap-1`}>
      <div className={`${color} w-fit`}>{icon}</div>
      <p className="text-lg font-bold text-white">{value}<span className="text-xs font-normal text-gray-400 ml-0.5">{unit}</span></p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

export default function LogPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { pendingCount, syncStatus, manualSync, isOffline } = useOffline();

  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });

  const openChat = (msg: string) => {
    sessionStorage.setItem("chatPrefill", msg);
    navigate("/chat");
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const stats = data?.stats;
  const log = data?.nutritionLog;

  const meals = log?.meals ?? [];

  // Optimistic hide on delete — populated by meal id, cleared on undo or commit
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<number>>(new Set());
  const deleteTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [confirmDeleteMeal, setConfirmDeleteMeal] = useState<MealLog | null>(null);

  useEffect(() => {
    return () => {
      deleteTimeoutsRef.current.forEach(t => clearTimeout(t));
      deleteTimeoutsRef.current.clear();
    };
  }, []);

  const mealEntries = meals.filter(m => !pendingDeleteIds.has(m.id));

  const commitDelete = async (id: number) => {
    deleteTimeoutsRef.current.delete(id);
    try {
      await apiRequest("DELETE", `/api/logs/nutrition/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    } catch {
      toast({
        title: "Couldn't delete meal",
        description: "We'll show it again. Try once more in a moment.",
        variant: "destructive",
      });
      // Restore from pending set so it reappears
      setPendingDeleteIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const undoDelete = (id: number) => {
    const t = deleteTimeoutsRef.current.get(id);
    if (t) {
      clearTimeout(t);
      deleteTimeoutsRef.current.delete(id);
    }
    setPendingDeleteIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const requestDelete = (meal: MealLog) => {
    setConfirmDeleteMeal(null);
    setPendingDeleteIds(prev => new Set(prev).add(meal.id));
    const t = setTimeout(() => commitDelete(meal.id), 5000);
    deleteTimeoutsRef.current.set(meal.id, t);

    toast({
      title: "Meal deleted",
      description: meal.mealStyle || "Meal removed from today's log.",
      action: (
        <ToastAction altText="Undo" onClick={() => undoDelete(meal.id)}>
          Undo
        </ToastAction>
      ),
    });
  };

  const importYesterday = () => {
    openChat(
      "I'd like to log the same meals I had yesterday. Can you remind me what I logged and re-log them for today?"
    );
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-black pb-28" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-4 w-40 bg-gray-800" />
            <Skeleton className="h-7 w-32 bg-gray-800" />
          </div>
          <div className="flex gap-2">
            {[0, 1, 2, 3].map(i => (
              <Skeleton key={i} className="flex-1 h-20 rounded-2xl bg-gray-900" />
            ))}
          </div>
          <Skeleton className="h-28 rounded-2xl bg-gray-900" />
          <Skeleton className="h-48 rounded-2xl bg-gray-900" />
          <Skeleton className="h-16 rounded-2xl bg-gray-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-black pb-28" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Header */}
        <div>
          <p className="text-gray-400 text-sm">{today}</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">Daily Log</h1>
        </div>

        {/* Pending sync banner */}
        {pendingCount > 0 && (
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-2xl p-4 flex items-center gap-3">
            <div className="bg-orange-500/20 rounded-xl p-2 shrink-0">
              <CloudUpload className="h-4 w-4 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-orange-200">
                {pendingCount} item{pendingCount === 1 ? "" : "s"} waiting to sync
              </p>
              <p className="text-xs text-orange-300/80">
                {isOffline
                  ? "Will upload automatically when you're back online."
                  : "Ready to send to the server."}
              </p>
            </div>
            {!isOffline && (
              <button
                onClick={manualSync}
                disabled={syncStatus === "syncing"}
                className="shrink-0 flex items-center gap-1.5 bg-orange-500/20 hover:bg-orange-500/30 disabled:opacity-60 rounded-xl px-3 py-1.5 text-xs font-semibold text-orange-200 transition-colors"
              >
                {syncStatus === "syncing" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {syncStatus === "syncing" ? "Syncing" : "Sync now"}
              </button>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-2">
          <StatPill icon={<Flame className="h-4 w-4" />} label="Calories" value={stats?.currentCalories ?? 0} unit="kcal" color="text-orange-400" />
          <StatPill icon={<Beef className="h-4 w-4" />} label="Protein" value={stats?.currentProtein ?? 0} unit="g" color="text-blue-400" />
          <StatPill icon={<Wheat className="h-4 w-4" />} label="Carbs" value={log?.carbs ?? 0} unit="g" color="text-emerald-400" />
          <StatPill icon={<Droplets className="h-4 w-4" />} label="Water" value={stats?.water ?? 0} unit="gl" color="text-cyan-400" />
        </div>

        {/* Calorie progress bar */}
        {stats && (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white font-medium">Calorie goal</span>
              <span className="text-gray-400">{stats.currentCalories} / {stats.tdee} kcal</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-blue-400 rounded-full transition-all"
                style={{ width: `${Math.min((stats.currentCalories / Math.max(stats.tdee, 1)) * 100, 100)}%` }}
              />
            </div>
            <div className="flex gap-4 pt-1">
              {[
                { label: "Protein", val: stats.currentProtein, target: stats.macros?.protein ?? 0, color: "bg-blue-500" },
                { label: "Carbs", val: log?.carbs ?? 0, target: stats.macros?.carbs ?? 0, color: "bg-emerald-500" },
                { label: "Fat", val: log?.fat ?? 0, target: stats.macros?.fat ?? 0, color: "bg-amber-500" },
              ].map(({ label, val, target, color }) => (
                <div key={label} className="flex-1">
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden mb-1">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.min((val / Math.max(target, 1)) * 100, 100)}%` }} />
                  </div>
                  <p className="text-xs text-gray-500">{label}: {val}g</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Meals logged */}
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">Meals Today</p>
            <button
              onClick={() => openChat("I'd like to log a meal. Here's what I ate: ")}
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" /> Log meal
            </button>
          </div>

          {mealEntries.length > 0 ? (
            <div className="space-y-2">
              {mealEntries.map((meal: MealLog) => (
                <div key={meal.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-0">
                  <div className="bg-gray-800 rounded-xl p-2">
                    <Utensils className="h-4 w-4 text-gray-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{meal.mealStyle || "Meal"}</p>
                    <p className="text-xs text-gray-500">
                      {Math.round(meal.calories) || 0} kcal · {Math.round(meal.protein) || 0}g P · {Math.round(meal.carbs) || 0}g C · {Math.round(meal.fat) || 0}g F
                    </p>
                    {meal.notes && meal.notes !== "Snap to Log · Photo analysis" && (
                      <p className="text-xs text-gray-600 mt-0.5 truncate">{meal.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmDeleteMeal(meal)}
                    className="shrink-0 p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label={`Delete ${meal.mealStyle || "meal"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Utensils className="h-8 w-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No meals logged yet today</p>
              <div className="flex flex-col items-center gap-2 mt-3">
                <button
                  onClick={() => openChat("I'd like to log my first meal of the day. Here's what I ate: ")}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Log with AI chat
                </button>
                <button
                  onClick={importYesterday}
                  className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Import from yesterday
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick log via chat */}
        <button
          onClick={() => openChat("I'd like to log a meal. Here's what I ate: ")}
          className="w-full flex items-center gap-4 bg-gradient-to-r from-indigo-600/20 to-blue-600/20 border border-indigo-500/20 rounded-2xl p-4 hover:from-indigo-600/30 hover:to-blue-600/30 transition-all active:scale-98"
        >
          <div className="bg-indigo-500/20 rounded-xl p-3">
            <MessageCircle className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="text-left flex-1">
            <p className="text-white font-medium text-sm">Log with AI</p>
            <p className="text-xs text-gray-400">Describe a meal and I'll figure out the macros</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <AlertDialog
        open={!!confirmDeleteMeal}
        onOpenChange={open => !open && setConfirmDeleteMeal(null)}
      >
        <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this meal?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {confirmDeleteMeal?.mealStyle || "This meal"} will be removed from today's log.
              You'll have 5 seconds to undo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDeleteMeal && requestDelete(confirmDeleteMeal)}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
