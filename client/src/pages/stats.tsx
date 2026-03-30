import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowUp, ArrowDown, TrendingUp, Calendar, Scale, Flame, Target, Award } from "lucide-react";
import { WeightProgressChart } from "@/components/dashboard/WeightProgressChart";

interface WeightData {
  date: string;
  weight: number;
}

interface StatsData {
  currentWeight?: number;
  weightChange?: number;
  weightData: WeightData[];
  adaptiveTDEE?: {
    value: number;
    formulaTDEE: number;
    difference: number;
    confidence: "low" | "medium" | "high";
    daysOfData: number;
  };
  nutritionTrends: {
    avgCalories: number;
    avgProtein: number;
    avgCarbs: number;
    avgFat: number;
  };
  streakDays: number;
  totalDaysLogged: number;
}

export default function StatsPage() {
  const [timeRange, setTimeRange] = useState<"week" | "month" | "3month" | "year">("month");

  // Fetch weight history
  const { data: weightHistory } = useQuery<WeightData[]>({
    queryKey: [`/api/logs/health?range=${timeRange}`],
    queryFn: async () => {
      const endDate = new Date();
      const startDate = new Date();

      switch(timeRange) {
        case "week":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "month":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "3month":
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case "year":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const response = await apiRequest("GET", `/api/logs/health?start=${startDate.toISOString().split('T')[0]}&end=${endDate.toISOString().split('T')[0]}`);
      const data = await response.json();

      // Transform data for chart
      return data.map((log: any) => ({
        date: new Date(log.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        weight: log.weight * 2.20462, // Convert kg to lbs for display
      }));
    },
  });

  // Fetch adaptive TDEE
  const { data: tdeeData } = useQuery({
    queryKey: ["/api/tdee/adaptive"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/tdee/adaptive");
        return await response.json();
      } catch {
        return null;
      }
    },
  });

  // Calculate current stats from weight history
  const currentWeight = weightHistory?.[weightHistory.length - 1]?.weight;
  const previousWeight = weightHistory?.[0]?.weight;
  const weightChange = currentWeight && previousWeight ? currentWeight - previousWeight : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-black pb-28" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Your Progress</h1>
          <p className="text-gray-400 text-sm mt-1">Track your journey to better health</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 bg-gray-900 rounded-2xl p-1">
          {(["week", "month", "3month", "year"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                timeRange === range
                  ? "bg-blue-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {range === "3month" ? "3M" : range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>

        {/* Weight Section */}
        {weightHistory && weightHistory.length > 0 ? (
          <div className="bg-gray-900 rounded-3xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Scale className="h-4 w-4 text-blue-400" />
                  <span className="text-sm text-gray-400">Current Weight</span>
                </div>
                <p className="text-3xl font-bold text-white">
                  {currentWeight?.toFixed(1)} <span className="text-lg text-gray-500">lbs</span>
                </p>
                {weightChange !== 0 && (
                  <div className={`flex items-center gap-1 mt-1 ${weightChange > 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {weightChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    <span className="text-sm">{Math.abs(weightChange).toFixed(1)} lbs this {timeRange}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Weight Chart */}
            <WeightProgressChart
              data={weightHistory}
              className="mt-2"
            />
          </div>
        ) : (
          <div className="bg-gray-900 rounded-3xl p-8 text-center">
            <Scale className="h-12 w-12 text-gray-700 mx-auto mb-3" />
            <p className="text-gray-400">No weight data yet</p>
            <p className="text-gray-500 text-sm mt-1">Log your weight daily to see trends</p>
          </div>
        )}

        {/* Adaptive TDEE Section */}
        {tdeeData ? (
          <div className="bg-gradient-to-br from-indigo-600/20 to-blue-600/20 border border-indigo-500/30 rounded-3xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Flame className="h-4 w-4 text-orange-400" />
                  <span className="text-sm text-gray-300">Your Real Metabolism</span>
                </div>
                <p className="text-3xl font-bold text-white">
                  {tdeeData.value} <span className="text-lg text-gray-400">cal/day</span>
                </p>
                <p className="text-sm mt-1">
                  {tdeeData.difference > 0 ? (
                    <span className="text-green-400">↑ {tdeeData.difference} higher than formula</span>
                  ) : tdeeData.difference < 0 ? (
                    <span className="text-red-400">↓ {Math.abs(tdeeData.difference)} lower than formula</span>
                  ) : (
                    <span className="text-gray-400">Matches formula estimate</span>
                  )}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-1">Confidence</p>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-2 h-6 rounded-full ${
                        i < (tdeeData.confidence === "high" ? 5 : tdeeData.confidence === "medium" ? 3 : 1)
                          ? "bg-blue-500"
                          : "bg-gray-700"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">{tdeeData.daysOfData} days</p>
              </div>
            </div>

            <div className="bg-black/30 rounded-xl p-3 mt-3">
              <p className="text-xs text-gray-400">
                This is your actual calorie burn based on your weight changes and food intake.
                It includes everything: exercise, daily movement, and metabolism.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-3xl p-5">
            <div className="flex items-center gap-3">
              <div className="bg-orange-500/20 rounded-xl p-3">
                <Flame className="h-6 w-6 text-orange-400" />
              </div>
              <div className="flex-1">
                <p className="text-white font-medium">Adaptive TDEE</p>
                <p className="text-gray-400 text-sm">Log 7+ days to unlock</p>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Progress</span>
                <span className="text-gray-400">3/7 days</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full" style={{ width: "43%" }} />
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-green-400" />
              <span className="text-xs text-gray-400">Days Logged</span>
            </div>
            <p className="text-2xl font-bold text-white">12</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-orange-400" />
              <span className="text-xs text-gray-400">Current Streak</span>
            </div>
            <p className="text-2xl font-bold text-white">3 <span className="text-sm text-gray-500">days</span></p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-blue-400" />
              <span className="text-xs text-gray-400">Avg Calories</span>
            </div>
            <p className="text-2xl font-bold text-white">2,150</p>
          </div>

          <div className="bg-gray-900 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-purple-400" />
              <span className="text-xs text-gray-400">Consistency</span>
            </div>
            <p className="text-2xl font-bold text-white">86<span className="text-sm text-gray-500">%</span></p>
          </div>
        </div>

      </div>
    </div>
  );
}