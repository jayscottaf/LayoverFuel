import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { User, Target, Activity, Scale, Ruler, ChevronRight, MessageCircle, LogOut, Settings } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface UserProfile {
  name: string;
  email: string;
  age: number;
  weight: number;
  height: number;
  activityLevel: string;
  fitnessGoal: string;
}

interface DashboardData {
  user: { name: string; goal: string };
  stats: { tdee: number; macros: { protein: number; carbs: number; fat: number } };
}

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Lose Weight",
  maintain: "Maintain Weight",
  gain_muscle: "Build Muscle",
  endurance: "Improve Endurance",
};

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary",
  lightly_active: "Lightly Active",
  moderately_active: "Moderately Active",
  very_active: "Very Active",
  extra_active: "Extra Active",
};

export default function ProfilePage() {
  const [, navigate] = useLocation();

  const { data: dashData } = useQuery<DashboardData>({ queryKey: ["/api/dashboard"] });
  const { data: profile } = useQuery<UserProfile>({ queryKey: ["/api/user/profile"] });

  const openChat = (msg: string) => {
    sessionStorage.setItem("chatPrefill", msg);
    navigate("/chat");
  };

  const handleLogout = async () => {
    await apiRequest("POST", "/api/auth/logout", {});
    window.location.href = "/";
  };

  const stats = dashData?.stats;

  return (
    <div className="flex-1 overflow-y-auto bg-black pb-28" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Profile</h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        {/* Avatar card */}
        <div className="bg-gray-900 rounded-3xl p-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
            <User className="h-8 w-8 text-indigo-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate">{profile?.name ?? dashData?.user?.name ?? "—"}</h2>
            <p className="text-sm text-gray-400 truncate">{profile?.email ?? ""}</p>
            <p className="text-xs text-indigo-400 mt-1">{GOAL_LABELS[profile?.fitnessGoal ?? ""] ?? dashData?.user?.goal ?? "No goal set"}</p>
          </div>
        </div>

        {/* Nutrition targets */}
        {stats && (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Daily Targets</p>
            {[
              { label: "Calories", value: `${stats.tdee} kcal`, color: "text-orange-400" },
              { label: "Protein", value: `${stats.macros?.protein ?? 0}g`, color: "text-blue-400" },
              { label: "Carbs", value: `${stats.macros?.carbs ?? 0}g`, color: "text-emerald-400" },
              { label: "Fat", value: `${stats.macros?.fat ?? 0}g`, color: "text-amber-400" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-400">{label}</span>
                <span className={`text-sm font-semibold ${color}`}>{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Body stats */}
        {profile && (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-white">Body Stats</p>
            {[
              { icon: Scale, label: "Weight", value: profile.weight ? `${profile.weight} lbs` : "—" },
              { icon: Ruler, label: "Height", value: profile.height ? `${profile.height} cm` : "—" },
              { icon: Activity, label: "Activity level", value: ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel ?? "—" },
              { icon: Target, label: "Goal", value: GOAL_LABELS[profile.fitnessGoal] ?? profile.fitnessGoal ?? "—" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3 py-1">
                <Icon className="h-4 w-4 text-gray-500 shrink-0" />
                <span className="text-sm text-gray-400 flex-1">{label}</span>
                <span className="text-sm text-white font-medium">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Update profile via chat */}
        <button
          onClick={() => openChat("I'd like to update my profile. My current stats are: ")}
          className="w-full flex items-center gap-4 bg-gray-900 rounded-2xl p-4 hover:bg-gray-800 transition-colors active:scale-98"
        >
          <div className="bg-indigo-500/20 rounded-xl p-3">
            <MessageCircle className="h-5 w-5 text-indigo-400" />
          </div>
          <div className="text-left flex-1">
            <p className="text-white font-medium text-sm">Update with AI</p>
            <p className="text-xs text-gray-400">Tell me your new stats and I'll update your plan</p>
          </div>
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>

        {/* Reset shortcuts */}
        <button
          onClick={() => {
            localStorage.removeItem("layoverfuel_shortcuts");
            alert("Shortcuts reset to defaults.");
          }}
          className="w-full flex items-center gap-4 bg-gray-900 rounded-2xl p-4 hover:bg-gray-800 transition-colors"
        >
          <div className="bg-gray-800 rounded-xl p-3">
            <Settings className="h-5 w-5 text-gray-400" />
          </div>
          <div className="text-left flex-1">
            <p className="text-white font-medium text-sm">Reset Quick Shortcuts</p>
            <p className="text-xs text-gray-400">Restore the default traveler shortcuts</p>
          </div>
        </button>
      </div>
    </div>
  );
}
