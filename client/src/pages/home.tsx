import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dumbbell, Droplets, Flame, ChevronRight, Zap, Plus, X, Pencil, Check, GripVertical, ScanBarcode, Camera, WifiOff, Loader2, RefreshCw, Scale } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";
import { SnapToLog } from "@/components/ui/snap-to-log";
import { WeightLogDialog } from "@/components/ui/weight-log-dialog";
import { useOffline } from "@/hooks/use-offline";

interface DashboardData {
  user: { name: string; goal: string };
  stats: {
    tdee: number;
    macros: { protein: number; carbs: number; fat: number; targetCalories: number };
    currentCalories: number;
    calorieProgress: number;
    currentProtein: number;
    proteinProgress: number;
    currentSteps: number;
    stepsProgress: number;
    water: number;
    waterProgress: number;
    streak: number;
  };
  dailyPlan: any;
  nutritionLog: any;
}

interface Shortcut {
  id: string;
  emoji: string;
  label: string;
  subtext: string;
  message: string;
}

const EMOJI_OPTIONS = [
  "✈️","🏨","📸","🏋️","🥗","🍔","🥤","🍎","🍜","🥩",
  "🚀","🏊","🚶","🧘","💊","🥑","🍳","🥪","🏃","🍵",
  "🌮","🍣","🫙","🏖️","🌍","🎽","💪","🍱","🥐","🍇",
];

const DEFAULT_SHORTCUTS: Shortcut[] = [
  {
    id: "airport",
    emoji: "✈️",
    label: "Airport Meal",
    subtext: "Log airport food",
    message: "I just had a meal at the airport. Can you help me log it? Here's what I ate: ",
  },
  {
    id: "hotel",
    emoji: "🏨",
    label: "Hotel Breakfast",
    subtext: "Log hotel buffet",
    message: "I had the hotel breakfast buffet this morning. Help me estimate the calories and macros for: ",
  },
  {
    id: "snap",
    emoji: "📸",
    label: "Snap Meal",
    subtext: "Photo analysis",
    message: "I want to take a photo of my meal for you to analyze.",
  },
];

const STORAGE_KEY = "layoverfuel_shortcuts";

function loadShortcuts(): Shortcut[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_SHORTCUTS;
}

function saveShortcuts(shortcuts: Shortcut[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shortcuts));
}

function CalorieRing({ current, target }: { current: number; target: number }) {
  const radius = 80;
  const stroke = 10;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const progress = Math.min(current / Math.max(target, 1), 1);
  const offset = circumference * (1 - progress);
  const remaining = Math.max(target - current, 0);

  return (
    <div className="relative flex items-center justify-center">
      <svg width={radius * 2} height={radius * 2} className="-rotate-90">
        <circle cx={radius} cy={radius} r={normalizedRadius} fill="none" stroke="#1f2937" strokeWidth={stroke} />
        <circle
          cx={radius} cy={radius} r={normalizedRadius}
          fill="none" stroke="url(#ringGrad)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{current.toLocaleString()}</span>
        <span className="text-xs text-gray-400">/ {target.toLocaleString()} kcal</span>
        <span className="text-xs text-gray-500 mt-0.5">{remaining} remaining</span>
      </div>
    </div>
  );
}

function MacroBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const pct = Math.min((current / Math.max(target, 1)) * 100, 100);
  return (
    <div className="flex-1">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-medium">{current}g</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%`, transition: "width 0.5s ease" }} />
      </div>
      <span className="text-xs text-gray-500">/ {target}g</span>
    </div>
  );
}

function WaterTracker({ glasses, onAdd, onRemove }: { glasses: number; onAdd: () => void; onRemove: () => void }) {
  return (
    <div className="bg-gray-900 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-cyan-400" />
          <span className="text-sm font-medium text-white">Water</span>
        </div>
        <span className="text-xs text-gray-400">{glasses} / 8 glasses</span>
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <button
            key={i}
            onClick={i < glasses ? onRemove : onAdd}
            className={`flex-1 h-8 rounded-lg transition-all ${
              i < glasses ? "bg-cyan-500/80 hover:bg-cyan-400" : "bg-gray-800 hover:bg-gray-700 border border-gray-700"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(loadShortcuts);
  const [showScanner, setShowScanner] = useState(false);
  const [showSnapToLog, setShowSnapToLog] = useState(false);
  const [showWeightDialog, setShowWeightDialog] = useState(false);

  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });
  const { isOffline, pendingCount, syncStatus, manualSync } = useOffline();

  const waterMutation = useMutation({
    mutationFn: (glasses: number) => apiRequest("POST", "/api/logs/water", { glasses }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }),
  });

  const currentWater = data?.stats?.water ?? 0;

  const handleAddWater = () => waterMutation.mutate(Math.min(currentWater + 1, 8));
  const handleRemoveWater = () => waterMutation.mutate(Math.max(currentWater - 1, 0));

  const openChatWith = (message: string) => {
    sessionStorage.setItem("chatPrefill", message);
    navigate("/chat");
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const stats = data?.stats;
  const macros = stats?.macros;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="w-16 h-16 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-black pb-28" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-gray-400 text-sm">{today}</p>
              <h1 className="text-2xl font-bold text-white mt-0.5">
                {greeting()}{data?.user?.name ? `, ${data.user.name.split(" ")[0]}` : ""}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Offline/Sync Status Badge */}
              {isOffline && pendingCount > 0 && (
                <div className="flex items-center gap-1.5 bg-orange-500/20 rounded-full px-3 py-1.5 border border-orange-500/40">
                  <WifiOff className="h-3.5 w-3.5 text-orange-400" />
                  <span className="text-xs font-semibold text-orange-400">{pendingCount} pending</span>
                </div>
              )}

              {syncStatus === 'syncing' && (
                <div className="flex items-center gap-1.5 bg-blue-500/20 rounded-full px-3 py-1.5 border border-blue-500/40">
                  <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                  <span className="text-xs font-semibold text-blue-400">Syncing...</span>
                </div>
              )}

              {syncStatus === 'success' && (
                <div className="flex items-center gap-1.5 bg-green-500/20 rounded-full px-3 py-1.5 border border-green-500/40">
                  <Check className="h-3.5 w-3.5 text-green-400" />
                  <span className="text-xs font-semibold text-green-400">Synced!</span>
                </div>
              )}

              {/* Manual sync button - show when online with pending items */}
              {!isOffline && pendingCount > 0 && syncStatus === 'idle' && (
                <button
                  onClick={manualSync}
                  className="flex items-center gap-1.5 bg-indigo-500/20 rounded-full px-3 py-1.5 border border-indigo-500/40 hover:bg-indigo-500/30 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="text-xs font-semibold text-indigo-400">Sync {pendingCount}</span>
                </button>
              )}

              {/* Streak Badge */}
              <div className="flex items-center gap-1.5 bg-orange-500/20 rounded-full px-3 py-1.5">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-semibold text-orange-400">
                  {data?.stats.streak ? `${data.stats.streak} day${data.stats.streak !== 1 ? 's' : ''}` : 'Start'}
                </span>
              </div>
            </div>
          </div>

          {/* HERO: Quick Log */}
          <button
            onClick={() => setShowSnapToLog(true)}
            className="w-full bg-gradient-to-br from-indigo-600 to-blue-600 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 hover:from-indigo-500 hover:to-blue-500 active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/20 border border-indigo-500/30"
            style={{ minHeight: "200px" }}
          >
            <div className="bg-white/10 rounded-full p-6 backdrop-blur-sm">
              <Camera className="h-12 w-12 text-white" />
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-white">Snap to Log</p>
              <p className="text-indigo-200 text-sm mt-1">Take a photo to instantly log your meal</p>
            </div>
          </button>

          {/* Compact Calorie Summary */}
          <div className="bg-gray-900 rounded-3xl p-5">
            {/* Calorie Ring - Smaller */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Today's Calories</p>
                <p className="text-3xl font-bold text-white">
                  {(stats?.currentCalories ?? 0).toLocaleString()}
                  <span className="text-lg text-gray-500"> / {(macros?.targetCalories ?? stats?.tdee ?? 2000).toLocaleString()}</span>
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {Math.max((macros?.targetCalories ?? stats?.tdee ?? 2000) - (stats?.currentCalories ?? 0), 0)} remaining
                </p>
              </div>
              <div className="relative flex items-center justify-center">
                <svg width={80} height={80} className="-rotate-90">
                  <circle cx={40} cy={40} r={35} fill="none" stroke="#1f2937" strokeWidth={6} />
                  <circle
                    cx={40} cy={40} r={35}
                    fill="none" stroke="url(#ringGradSmall)" strokeWidth={6}
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 35}
                    strokeDashoffset={2 * Math.PI * 35 * (1 - Math.min((stats?.currentCalories ?? 0) / Math.max(macros?.targetCalories ?? stats?.tdee ?? 2000, 1), 1))}
                    style={{ transition: "stroke-dashoffset 0.6s ease" }}
                  />
                  <defs>
                    <linearGradient id="ringGradSmall" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="absolute text-xl font-bold text-white">
                  {Math.round(((stats?.currentCalories ?? 0) / Math.max(macros?.targetCalories ?? stats?.tdee ?? 2000, 1)) * 100)}%
                </span>
              </div>
            </div>

            {/* Inline Macros */}
            <div className="flex gap-3 mb-4">
              <MacroBar label="Protein" current={stats?.currentProtein ?? 0} target={macros?.protein ?? 150} color="bg-blue-500" />
              <MacroBar label="Carbs" current={data?.nutritionLog?.carbs ?? 0} target={macros?.carbs ?? 200} color="bg-emerald-500" />
              <MacroBar label="Fat" current={data?.nutritionLog?.fat ?? 0} target={macros?.fat ?? 65} color="bg-amber-500" />
            </div>

            {/* Inline Water Tracker */}
            <div className="pt-4 border-t border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-400" />
                  <span className="text-sm font-medium text-white">Water</span>
                </div>
                <span className="text-xs text-gray-400">{currentWater} / 8 glasses</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 8 }, (_, i) => (
                  <button
                    key={i}
                    onClick={i < currentWater ? handleRemoveWater : handleAddWater}
                    className={`flex-1 h-7 rounded-lg transition-all ${
                      i < currentWater ? "bg-cyan-500/80 hover:bg-cyan-400" : "bg-gray-800 hover:bg-gray-700 border border-gray-700"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions - Simplified */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quick Actions
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowWeightDialog(true)}
                  className="text-xs text-gray-400 hover:text-indigo-400 flex items-center gap-1"
                >
                  <Scale className="h-3.5 w-3.5" />
                  Weight
                </button>
                <button
                  onClick={() => setShowScanner(true)}
                  className="text-xs text-gray-400 hover:text-indigo-400 flex items-center gap-1"
                >
                  <ScanBarcode className="h-3.5 w-3.5" />
                  Barcode
                </button>
                <button
                  onClick={() => navigate("/profile")}
                  className="text-xs text-gray-400 hover:text-indigo-400 flex items-center gap-1"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              </div>
            </div>

            {/* Horizontal scrollable shortcuts */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
              {shortcuts.slice(0, 5).map(shortcut => (
                <button
                  key={shortcut.id}
                  onClick={() => openChatWith(shortcut.message)}
                  className="shrink-0 bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-3 hover:bg-gray-800 active:scale-95 transition-all min-w-[160px]"
                >
                  <span className="text-2xl">{shortcut.emoji}</span>
                  <div className="text-left">
                    <p className="text-sm font-medium text-white leading-tight">{shortcut.label}</p>
                    <p className="text-xs text-gray-500 leading-tight">{shortcut.subtext}</p>
                  </div>
                </button>
              ))}
              {shortcuts.length > 5 && (
                <button
                  onClick={() => navigate("/profile")}
                  className="shrink-0 bg-gray-900/50 border border-dashed border-gray-700 rounded-2xl px-4 py-3 flex items-center gap-2 hover:bg-gray-900 transition-all min-w-[120px]"
                >
                  <Plus className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-400">See all</span>
                </button>
              )}
            </div>
          </div>

          {/* Today's Workout */}
          {data?.dailyPlan?.workout && (
            <button
              onClick={() => openChatWith("Can you walk me through today's workout?")}
              className="w-full bg-gradient-to-r from-indigo-600/30 to-blue-600/30 border border-indigo-500/30 rounded-2xl p-4 flex items-center gap-4 active:scale-98 transition-transform hover:from-indigo-600/40 hover:to-blue-600/40"
            >
              <div className="bg-indigo-500/20 rounded-xl p-3">
                <Dumbbell className="h-6 w-6 text-indigo-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-xs text-indigo-300 font-medium">Today's Workout</p>
                <p className="text-white font-semibold mt-0.5">{data.dailyPlan.workout.title || "Hotel Room Workout"}</p>
                <p className="text-gray-400 text-xs mt-0.5">
                  {data.dailyPlan.workout.duration || "20-30 min"} · {data.dailyPlan.workout.intensityLevel || "Moderate"}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-500" />
            </button>
          )}

          {/* Meal Plan */}
          {data?.dailyPlan?.meals && (
            <div className="bg-gray-900 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-white">Today's Meal Plan</p>
                <button onClick={() => openChatWith("Tell me more about today's meal plan")} className="text-xs text-indigo-400 hover:text-indigo-300">
                  See all
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { key: "breakfast", label: "Breakfast", emoji: "🌅" },
                  { key: "lunch", label: "Lunch", emoji: "☀️" },
                  { key: "dinner", label: "Dinner", emoji: "🌙" },
                ].map(({ key, label, emoji }) => {
                  const meal = data.dailyPlan.meals[key];
                  if (!meal) return null;
                  return (
                    <div key={key} className="flex items-center gap-3 py-1.5">
                      <span className="text-base">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="text-sm text-white font-medium truncate">{meal.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-400">{meal.macros?.calories ?? "—"} kcal</p>
                        <p className="text-xs text-blue-400">{meal.macros?.protein ?? "—"}g protein</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Generate plan CTA */}
          {!data?.dailyPlan && (
            <button
              onClick={() => openChatWith("Can you generate my meal and workout plan for today? I'm traveling and staying at a hotel.")}
              className="w-full bg-gray-900 border border-dashed border-gray-700 rounded-2xl p-5 flex flex-col items-center gap-2 hover:border-indigo-500/50 transition-colors"
            >
              <Zap className="h-6 w-6 text-indigo-400" />
              <p className="text-white font-medium">Generate Today's Plan</p>
              <p className="text-xs text-gray-500">Get a personalized meal + workout plan</p>
            </button>
          )}
        </div>
      </div>

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onClose={() => setShowScanner(false)}
          onLogSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] })}
        />
      )}

      {/* Snap to Log */}
      {showSnapToLog && (
        <SnapToLog
          onClose={() => setShowSnapToLog(false)}
          onLogSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] })}
        />
      )}

      {/* Weight Log Dialog */}
      <WeightLogDialog
        open={showWeightDialog}
        onOpenChange={setShowWeightDialog}
      />
    </>
  );
}
