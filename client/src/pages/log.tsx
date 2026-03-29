import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, Flame, Beef, Wheat, Droplets, ChevronRight, Utensils, MessageCircle } from "lucide-react";

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

  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });

  const openChat = (msg: string) => {
    sessionStorage.setItem("chatPrefill", msg);
    navigate("/chat");
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const stats = data?.stats;
  const log = data?.nutritionLog;

  const meals = log?.meals ?? [];
  const mealEntries = meals;

  return (
    <div className="flex-1 overflow-y-auto bg-black pb-28" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Header */}
        <div>
          <p className="text-gray-400 text-sm">{today}</p>
          <h1 className="text-2xl font-bold text-white mt-0.5">Daily Log</h1>
        </div>

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
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Utensils className="h-8 w-8 text-gray-700 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No meals logged yet today</p>
              <button
                onClick={() => openChat("I'd like to log my first meal of the day. Here's what I ate: ")}
                className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mx-auto"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Log with AI chat
              </button>
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
    </div>
  );
}
