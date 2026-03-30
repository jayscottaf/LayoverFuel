import { useState } from "react";
import type { ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { User, ChevronRight, Check, LogOut, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  age: number | null;
  weight: number | null;
  goalWeight: number | null;
  height: number | null;
  gender: string | null;
  fitnessGoal: string | null;
  activityLevel: string | null;
  dietaryRestrictions: string[] | null;
  quickLogMode: boolean | null;
}

interface DashboardData {
  stats: { tdee: number; macros: { protein: number; carbs: number; fat: number; targetCalories: number } };
}

function cmToFtIn(cm: number): { feet: number; inches: number } {
  const roundedTotalInches = Math.round(cm / 2.54);
  const feet = Math.floor(roundedTotalInches / 12);
  const inches = roundedTotalInches % 12;
  return { feet, inches };
}

function ftInToCm(feet: number, inches: number): number {
  return Math.round((feet * 12 + inches) * 2.54);
}

function fmtHeight(cm: number | null | undefined): string {
  if (cm == null) return "—";
  const { feet, inches } = cmToFtIn(cm);
  return `${feet}'${inches}"`;
}

const GOAL_OPTIONS = [
  { value: "lose_weight", label: "Lose Weight" },
  { value: "maintain", label: "Maintain Weight" },
  { value: "gain_muscle", label: "Build Muscle" },
  { value: "endurance", label: "Improve Endurance" },
];

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary", sub: "Little to no exercise" },
  { value: "lightly_active", label: "Lightly Active", sub: "1–3 days/week" },
  { value: "moderately_active", label: "Moderately Active", sub: "3–5 days/week" },
  { value: "very_active", label: "Very Active", sub: "6–7 days/week" },
  { value: "extra_active", label: "Extra Active", sub: "Twice a day" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

const DIETARY_OPTIONS = [
  "None", "Vegetarian", "Vegan", "Gluten-free", "Dairy-free",
  "Keto", "Paleo", "Halal", "Kosher", "Low-sodium",
];

function getLabel(options: { value: string; label: string }[], value: string | null | undefined) {
  return options.find(o => o.value === value)?.label ?? value ?? "—";
}

// ─── Field Editor Sheet ───────────────────────────────────────────────────────

interface EditorSheetProps {
  title: string;
  onClose: () => void;
  onSave: (value: any) => void;
  children: ReactNode;
}

function EditorSheet({ title, onClose, onSave, children }: EditorSheetProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-t-3xl px-5 pt-4 pb-8 space-y-4 overflow-y-auto"
        style={{ maxHeight: "85dvh" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between py-1">
          <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">Cancel</button>
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onSave} className="text-indigo-400 hover:text-indigo-300 font-semibold text-sm">Save</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Settings Row ─────────────────────────────────────────────────────────────

function SettingsRow({ label, value, onTap, last = false }: {
  label: string; value: string; onTap: () => void; last?: boolean;
}) {
  return (
    <button
      onClick={onTap}
      className={`w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-800/60 transition-colors active:bg-gray-800 ${!last ? "border-b border-gray-800/60" : ""}`}
    >
      <span className="text-sm text-gray-300">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500 max-w-[180px] truncate text-right">{value}</span>
        <ChevronRight className="h-4 w-4 text-gray-600 shrink-0" />
      </div>
    </button>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1 mb-1">{title}</p>
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        {children}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: profile, isLoading } = useQuery<UserProfile>({ queryKey: ["/api/user/profile"] });
  const { data: dashData } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });

  const [editing, setEditing] = useState<string | null>(null);

  // Temp state for editors
  const [tempStr, setTempStr] = useState("");
  const [tempNum, setTempNum] = useState("");
  const [tempArr, setTempArr] = useState<string[]>([]);
  const [tempFeet, setTempFeet] = useState("");
  const [tempInches, setTempInches] = useState("");

  const mutation = useMutation({
    mutationFn: (updates: Partial<UserProfile>) =>
      apiRequest("PATCH", "/api/user/profile", updates).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      setEditing(null);
      toast({ title: "Saved", description: "Profile updated." });
    },
    onError: () => toast({ title: "Error", description: "Failed to save.", variant: "destructive" }),
  });

  const openStr = (field: string, current: string | null | undefined) => {
    setTempStr(current ?? "");
    setEditing(field);
  };

  const openNum = (field: string, current: number | null | undefined) => {
    // Convert weight from kg to lbs for display
    if ((field === "weight" || field === "goalWeight") && current != null) {
      setTempNum(String((current * 2.20462).toFixed(1)));
    } else {
      setTempNum(current != null ? String(current) : "");
    }
    setEditing(field);
  };

  const openArr = (field: string, current: string[] | null | undefined) => {
    setTempArr(current ?? []);
    setEditing(field);
  };

  const saveStr = (field: string) => mutation.mutate({ [field]: tempStr });
  const saveNum = (field: string, float = false) => {
    let value = float ? parseFloat(tempNum) : parseInt(tempNum);
    // Convert weight from lbs to kg for storage
    if ((field === "weight" || field === "goalWeight") && float) {
      value = value / 2.20462;
    }
    mutation.mutate({ [field]: value });
  };
  const saveArr = (field: string) => mutation.mutate({ [field]: tempArr });

  const openHeight = (currentCm: number | null | undefined) => {
    if (currentCm != null) {
      const { feet, inches } = cmToFtIn(currentCm);
      setTempFeet(String(feet));
      setTempInches(String(inches));
    } else {
      setTempFeet("");
      setTempInches("");
    }
    setEditing("height");
  };

  const saveHeight = () => {
    const ft = parseInt(tempFeet);
    const inches = parseInt(tempInches) || 0;
    if (!ft || ft < 1 || ft > 8 || inches < 0 || inches > 11) {
      toast({ title: "Invalid height", description: "Enter a valid height (e.g. 5 ft, 8 in).", variant: "destructive" });
      return;
    }
    mutation.mutate({ height: ftInToCm(ft, inches) });
  };

  const handleLogout = async () => {
    await apiRequest("POST", "/api/auth/logout", {});
    window.location.href = "/";
  };

  const macros = dashData?.stats?.macros;

  const fmt = (v: number | null | undefined, unit: string) => v ? `${v}${unit}` : "—";
  const dietLabel = profile?.dietaryRestrictions?.length
    ? profile.dietaryRestrictions.join(", ")
    : "None";

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-black pb-28" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">

          {/* Avatar + targets hero */}
          <div className="bg-gray-900 rounded-3xl p-5">
            {/* Avatar row */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <User className="h-7 w-7 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-white truncate">{profile?.name ?? "—"}</p>
                <p className="text-xs text-gray-400 truncate">{profile?.email ?? ""}</p>
              </div>
            </div>

            {/* Calorie + macro targets */}
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">Daily Targets</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Calories", value: macros?.targetCalories ? `${macros.targetCalories}` : "—", unit: "kcal", color: "text-orange-400" },
                { label: "Protein", value: macros?.protein ? `${macros.protein}` : "—", unit: "g", color: "text-blue-400" },
                { label: "Carbs", value: macros?.carbs ? `${macros.carbs}` : "—", unit: "g", color: "text-emerald-400" },
                { label: "Fat", value: macros?.fat ? `${macros.fat}` : "—", unit: "g", color: "text-amber-400" },
              ].map(({ label, value, unit, color }) => (
                <div key={label} className="bg-gray-800 rounded-xl p-2.5 text-center">
                  <p className={`text-base font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{unit}</p>
                  <p className="text-[10px] text-gray-500">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Goal */}
          <SectionCard title="Goal">
            <div className="px-4 py-3">
              <p className="text-xs text-gray-500 mb-2">Fitness goal</p>
              <div className="grid grid-cols-2 gap-2">
                {GOAL_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => mutation.mutate({ fitnessGoal: opt.value })}
                    className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors ${
                      profile?.fitnessGoal === opt.value
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>

          {/* Personal */}
          <SectionCard title="Personal">
            <SettingsRow label="Name" value={profile?.name ?? "—"} onTap={() => openStr("name", profile?.name)} />
            <SettingsRow label="Age" value={fmt(profile?.age, " yrs")} onTap={() => openNum("age", profile?.age)} />
            <SettingsRow label="Gender" value={getLabel(GENDER_OPTIONS, profile?.gender)} onTap={() => openStr("gender", profile?.gender)} last />
          </SectionCard>

          {/* Body */}
          <SectionCard title="Body">
            <SettingsRow
              label="Starting Weight"
              value={profile?.weight ? `${Math.round(profile.weight * 2.20462 * 2) / 2} lbs` : "—"}
              onTap={() => openNum("weight", profile?.weight)}
            />
            <SettingsRow
              label="Goal Weight"
              value={profile?.goalWeight ? `${Math.round(profile.goalWeight * 2.20462 * 2) / 2} lbs` : "—"}
              onTap={() => openNum("goalWeight", profile?.goalWeight)}
            />
            <SettingsRow label="Height" value={fmtHeight(profile?.height)} onTap={() => openHeight(profile?.height)} last />
          </SectionCard>

          {/* Activity */}
          <SectionCard title="Activity">
            <div className="px-4 py-3 space-y-1.5">
              {ACTIVITY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => mutation.mutate({ activityLevel: opt.value })}
                  className={`w-full flex items-center justify-between py-2.5 px-3 rounded-xl transition-colors ${
                    profile?.activityLevel === opt.value
                      ? "bg-indigo-600/20 border border-indigo-500/40"
                      : "hover:bg-gray-800"
                  }`}
                >
                  <div className="text-left">
                    <p className={`text-sm font-medium ${profile?.activityLevel === opt.value ? "text-indigo-300" : "text-gray-300"}`}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500">{opt.sub}</p>
                  </div>
                  {profile?.activityLevel === opt.value && (
                    <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </SectionCard>

          {/* Dietary */}
          <SectionCard title="Dietary">
            <SettingsRow label="Restrictions" value={dietLabel} onTap={() => openArr("dietaryRestrictions", profile?.dietaryRestrictions)} last />
          </SectionCard>

          {/* App */}
          <SectionCard title="App">
            <div className="px-4 py-3.5 border-b border-gray-800/60">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-gray-300 font-medium">Quick Log Mode</p>
                  <p className="text-xs text-gray-500 mt-0.5">Instant logging with 5-second undo (faster) vs always confirm first (safer)</p>
                </div>
                <button
                  onClick={() => mutation.mutate({ quickLogMode: !profile?.quickLogMode })}
                  className={`shrink-0 relative w-12 h-7 rounded-full transition-colors ${
                    profile?.quickLogMode ? "bg-indigo-600" : "bg-gray-700"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-transform ${
                      profile?.quickLogMode ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
            <button
              onClick={() => { localStorage.removeItem("layoverfuel_shortcuts"); toast({ title: "Reset", description: "Shortcuts restored to defaults." }); }}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-800/60 border-b border-gray-800/60 transition-colors"
            >
              <span className="text-sm text-gray-300">Reset Quick Shortcuts</span>
              <RefreshCw className="h-4 w-4 text-gray-500" />
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-800/60 transition-colors"
            >
              <span className="text-sm text-red-400">Sign out</span>
              <LogOut className="h-4 w-4 text-red-400" />
            </button>
          </SectionCard>

        </div>
      </div>

      {/* ── Editors ── */}

      {/* Text field editor (name) */}
      {editing === "name" && (
        <EditorSheet title="Name" onClose={() => setEditing(null)} onSave={() => saveStr("name")}>
          <input
            autoFocus
            className="w-full bg-gray-900 text-white text-base rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-indigo-500"
            value={tempStr}
            onChange={e => setTempStr(e.target.value)}
            placeholder="Your name"
          />
        </EditorSheet>
      )}

      {/* Gender picker */}
      {editing === "gender" && (
        <EditorSheet title="Gender" onClose={() => setEditing(null)} onSave={() => saveStr("gender")}>
          <div className="space-y-2">
            {GENDER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTempStr(opt.value)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                  tempStr === opt.value ? "bg-indigo-600/20 border border-indigo-500/40" : "bg-gray-900 hover:bg-gray-800"
                }`}
              >
                <span className={`text-sm ${tempStr === opt.value ? "text-indigo-300" : "text-gray-300"}`}>{opt.label}</span>
                {tempStr === opt.value && <Check className="h-4 w-4 text-indigo-400" />}
              </button>
            ))}
          </div>
        </EditorSheet>
      )}

      {/* Number editors (age, weight, goalWeight) */}
      {(editing === "age" || editing === "weight" || editing === "goalWeight") && (
        <EditorSheet
          title={
            editing === "age" ? "Age" :
            editing === "goalWeight" ? "Goal Weight (lbs)" :
            "Starting Weight (lbs)"
          }
          onClose={() => setEditing(null)}
          onSave={() => saveNum(editing, editing === "weight" || editing === "goalWeight")}
        >
          <div className="space-y-2">
            <input
              autoFocus
              type="number"
              inputMode="decimal"
              className="w-full bg-gray-900 text-white text-2xl font-semibold rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-indigo-500 text-center"
              value={tempNum}
              onChange={e => setTempNum(e.target.value)}
              placeholder="0"
            />
            <p className="text-xs text-center text-gray-500">
              {editing === "age" ? "years" : "pounds"}
            </p>
          </div>
        </EditorSheet>
      )}

      {/* Height editor — feet & inches */}
      {editing === "height" && (
        <EditorSheet title="Height" onClose={() => setEditing(null)} onSave={saveHeight}>
          <div className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <p className="text-xs text-center text-gray-500">Feet</p>
                <input
                  autoFocus
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={8}
                  className="w-full bg-gray-900 text-white text-2xl font-semibold rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-indigo-500 text-center"
                  value={tempFeet}
                  onChange={e => setTempFeet(e.target.value)}
                  placeholder="5"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-xs text-center text-gray-500">Inches</p>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={11}
                  className="w-full bg-gray-900 text-white text-2xl font-semibold rounded-xl px-4 py-3 border border-gray-700 focus:outline-none focus:border-indigo-500 text-center"
                  value={tempInches}
                  onChange={e => setTempInches(e.target.value)}
                  placeholder="8"
                />
              </div>
            </div>
            <p className="text-xs text-center text-gray-500">e.g. 5 feet 8 inches = 5'8"</p>
          </div>
        </EditorSheet>
      )}

      {/* Dietary restrictions multi-select */}
      {editing === "dietaryRestrictions" && (
        <EditorSheet title="Dietary Restrictions" onClose={() => setEditing(null)} onSave={() => saveArr("dietaryRestrictions")}>
          <div className="grid grid-cols-2 gap-2">
            {DIETARY_OPTIONS.map(opt => {
              const selected = opt === "None" ? tempArr.length === 0 : tempArr.includes(opt);
              return (
                <button
                  key={opt}
                  onClick={() => {
                    if (opt === "None") { setTempArr([]); return; }
                    setTempArr(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]);
                  }}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-colors flex items-center justify-between gap-2 ${
                    selected ? "bg-indigo-600/20 border border-indigo-500/40 text-indigo-300" : "bg-gray-900 text-gray-400 hover:bg-gray-800"
                  }`}
                >
                  <span>{opt}</span>
                  {selected && <Check className="h-3.5 w-3.5 text-indigo-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </EditorSheet>
      )}
    </>
  );
}
