import type { ReactNode } from "react";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Dumbbell, Droplets, Flame, ChevronRight, Zap, Plus, X, Pencil, Check, GripVertical, ScanBarcode, Camera } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";
import { SnapToLog } from "@/components/ui/snap-to-log";

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

interface ShortcutEditorProps {
  initial?: Partial<Shortcut>;
  onSave: (s: Omit<Shortcut, "id">) => void;
  onCancel: () => void;
}

function ShortcutEditor({ initial, onSave, onCancel }: ShortcutEditorProps) {
  const [emoji, setEmoji] = useState(initial?.emoji ?? "✈️");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [subtext, setSubtext] = useState(initial?.subtext ?? "");
  const [message, setMessage] = useState(initial?.message ?? "");
  const [showPicker, setShowPicker] = useState(false);

  const canSave = label.trim() && message.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-t-3xl p-5 pb-8 space-y-4 overflow-y-auto"
        style={{ maxHeight: "90dvh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold">{initial?.label ? "Edit Shortcut" : "New Shortcut"}</h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Emoji picker */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Icon</label>
          <button
            onClick={() => setShowPicker(p => !p)}
            className="text-3xl bg-gray-900 rounded-xl p-2.5 border border-gray-700 hover:border-indigo-500/50 transition-colors"
          >
            {emoji}
          </button>
          {showPicker && (
            <div className="mt-2 grid grid-cols-10 gap-1.5 bg-gray-900 rounded-2xl p-3 border border-gray-800">
              {EMOJI_OPTIONS.map(e => (
                <button
                  key={e}
                  onClick={() => { setEmoji(e); setShowPicker(false); }}
                  className={`text-xl p-1 rounded-lg hover:bg-gray-700 transition-colors ${emoji === e ? "bg-indigo-600/30 ring-1 ring-indigo-500" : ""}`}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Label */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Label</label>
          <input
            className="w-full bg-gray-900 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-indigo-500"
            placeholder="e.g. Hotel Gym"
            value={label}
            onChange={e => setLabel(e.target.value)}
            maxLength={20}
          />
        </div>

        {/* Subtext */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Short description</label>
          <input
            className="w-full bg-gray-900 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-indigo-500"
            placeholder="e.g. Quick workout"
            value={subtext}
            onChange={e => setSubtext(e.target.value)}
            maxLength={30}
          />
        </div>

        {/* Chat message */}
        <div>
          <label className="text-xs text-gray-400 mb-1.5 block">Chat message to send</label>
          <textarea
            className="w-full bg-gray-900 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-indigo-500 resize-none"
            placeholder="e.g. I just finished a hotel gym session. Can you log a 45-min moderate workout?"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
          />
        </div>

        <button
          disabled={!canSave}
          onClick={() => onSave({ emoji, label: label.trim(), subtext: subtext.trim(), message: message.trim() })}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2"
        >
          <Check className="h-4 w-4" /> Save Shortcut
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [shortcuts, setShortcuts] = useState<Shortcut[]>(loadShortcuts);
  const [editMode, setEditMode] = useState(false);
  const [editorTarget, setEditorTarget] = useState<Shortcut | null | "new">(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showSnapToLog, setShowSnapToLog] = useState(false);

  const { data, isLoading } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });

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

  const updateShortcuts = (next: Shortcut[]) => {
    setShortcuts(next);
    saveShortcuts(next);
  };

  const removeShortcut = (id: string) => updateShortcuts(shortcuts.filter(s => s.id !== id));

  const addShortcut = (data: Omit<Shortcut, "id">) => {
    const next = [...shortcuts, { ...data, id: `custom_${Date.now()}` }];
    updateShortcuts(next);
    setEditorTarget(null);
  };

  const editShortcut = (updated: Omit<Shortcut, "id">) => {
    if (!editorTarget || editorTarget === "new") return;
    const next = shortcuts.map(s => s.id === editorTarget.id ? { ...s, ...updated } : s);
    updateShortcuts(next);
    setEditorTarget(null);
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
            <div className="flex items-center gap-1.5 bg-orange-500/20 rounded-full px-3 py-1.5">
              <Flame className="h-4 w-4 text-orange-400" />
              <span className="text-sm font-semibold text-orange-400">Day 1</span>
            </div>
          </div>

          {/* Calorie Ring */}
          <div className="bg-gray-900 rounded-3xl p-6 flex flex-col items-center gap-4">
            <CalorieRing current={stats?.currentCalories ?? 0} target={macros?.targetCalories ?? stats?.tdee ?? 2000} />
            <div className="flex gap-4 w-full">
              <MacroBar label="Protein" current={stats?.currentProtein ?? 0} target={macros?.protein ?? 150} color="bg-blue-500" />
              <MacroBar label="Carbs" current={data?.nutritionLog?.carbs ?? 0} target={macros?.carbs ?? 200} color="bg-emerald-500" />
              <MacroBar label="Fat" current={data?.nutritionLog?.fat ?? 0} target={macros?.fat ?? 65} color="bg-amber-500" />
            </div>
          </div>

          {/* Water Tracker */}
          <WaterTracker glasses={currentWater} onAdd={handleAddWater} onRemove={handleRemoveWater} />

          {/* Travel Quick-Log */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Quick Log — Traveler Mode
              </p>
              <button
                onClick={() => setEditMode(p => !p)}
                className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  editMode ? "bg-indigo-600 text-white" : "text-indigo-400 hover:text-indigo-300"
                }`}
              >
                {editMode ? (
                  <><Check className="h-3 w-3" /> Done</>
                ) : (
                  <><Pencil className="h-3 w-3" /> Edit</>
                )}
              </button>
            </div>

            {/* Quick-log buttons — always visible, outside editable grid */}
            <div className="flex gap-2 mb-2.5">
              <button
                onClick={() => setShowSnapToLog(true)}
                className="flex-1 bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-3 flex items-center gap-3 hover:bg-indigo-600/20 active:scale-[0.98] transition-all"
              >
                <div className="bg-indigo-500/20 rounded-xl p-2 shrink-0">
                  <Camera className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">Snap to Log</p>
                  <p className="text-xs text-gray-500">Photo meal analysis</p>
                </div>
              </button>
              <button
                onClick={() => setShowScanner(true)}
                className="flex-1 bg-indigo-600/10 border border-indigo-500/30 rounded-2xl p-3 flex items-center gap-3 hover:bg-indigo-600/20 active:scale-[0.98] transition-all"
              >
                <div className="bg-indigo-500/20 rounded-xl p-2 shrink-0">
                  <ScanBarcode className="h-5 w-5 text-indigo-400" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-white">Scan Barcode</p>
                  <p className="text-xs text-gray-500">Packaged food</p>
                </div>
              </button>
            </div>

            {/* Shortcut grid — wraps naturally */}
            <div className="grid grid-cols-3 gap-2">
              {shortcuts.map(shortcut => (
                <div key={shortcut.id} className="relative">
                  <button
                    onClick={() => {
                      if (editMode) setEditorTarget(shortcut);
                      else openChatWith(shortcut.message);
                    }}
                    className={`w-full bg-gray-900 rounded-2xl p-3 flex flex-col items-center gap-1.5 transition-all ${
                      editMode
                        ? "ring-1 ring-indigo-500/40 hover:ring-indigo-500 active:scale-95"
                        : "hover:bg-gray-800 active:scale-95"
                    }`}
                  >
                    <span className="text-2xl">{shortcut.emoji}</span>
                    <span className="text-xs font-medium text-white leading-tight text-center">{shortcut.label}</span>
                    {!editMode && (
                      <span className="text-xs text-gray-500 text-center leading-tight">{shortcut.subtext}</span>
                    )}
                    {editMode && (
                      <span className="text-xs text-indigo-400 flex items-center gap-0.5">
                        <Pencil className="h-2.5 w-2.5" /> Edit
                      </span>
                    )}
                  </button>

                  {/* Remove button */}
                  {editMode && (
                    <button
                      onClick={() => removeShortcut(shortcut.id)}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 hover:bg-red-500 rounded-full p-0.5 shadow-lg transition-colors z-10"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add new shortcut card */}
              {editMode && (
                <button
                  onClick={() => setEditorTarget("new")}
                  className="bg-gray-900/50 border border-dashed border-gray-700 rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:border-indigo-500/50 hover:bg-gray-900 transition-all active:scale-95"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                    <Plus className="h-4 w-4 text-gray-400" />
                  </div>
                  <span className="text-xs text-gray-500">Add new</span>
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

      {/* Shortcut Editor Modal */}
      {editorTarget !== null && (
        <ShortcutEditor
          initial={editorTarget === "new" ? undefined : editorTarget}
          onSave={editorTarget === "new" ? addShortcut : editShortcut}
          onCancel={() => setEditorTarget(null)}
        />
      )}

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
    </>
  );
}
