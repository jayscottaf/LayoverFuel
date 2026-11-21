import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ArrowUp, ArrowDown, TrendingUp, Calendar, Scale, Flame, Target, Award } from "lucide-react";
import { WeightProgressChart } from "@/components/dashboard/WeightProgressChart";
import { Skeleton } from "@/components/ui/skeleton";
import { weightHistoryFromHealthLogs } from "@/lib/weight-history";

interface WeightData {
  date: string;
  weight: number;
}

interface StatsData {
  currentWeight?: number;
  weightChange?: number;
  weightData: WeightData[];
  adaptiveTDEE?: {
    source?: "adaptive" | "formula";
    value: number;
    formulaTDEE: number;
    difference: number;
    confidence: "low" | "medium" | "high";
    daysOfData: number;
    requiredDaysForAdaptive?: number;
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
  const { data: weightHistory, isLoading: weightLoading } = useQuery<WeightData[]>({
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

      return weightHistoryFromHealthLogs(data);
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

  // Fetch stats
  const { data: statsData } = useQuery<{
    streak: number;
    totalDaysLogged: number;
    avgCalories: number;
    consistency: number;
  }>({
    queryKey: ["/api/stats"],
  });

  // Calculate current stats from weight history
  const currentWeight = weightHistory?.[weightHistory.length - 1]?.weight;
  const previousWeight = weightHistory?.[0]?.weight;
  const weightChange = currentWeight && previousWeight ? currentWeight - previousWeight : 0;

  return (
    <div className="flex-1 overflow-y-auto bg-background pb-28" style={{ WebkitOverflowScrolling: "touch" }}>
      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* Header */}
        <div>
          <h1 className="text-[34px] font-bold leading-tight tracking-tight text-foreground">Progress</h1>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 bg-card rounded-2xl p-1">
          {(["week", "month", "3month", "year"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                timeRange === range
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {range === "3month" ? "3M" : range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>

        {/* Weight Section */}
        {weightLoading ? (
          <div className="bg-card rounded-[22px] p-5 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 bg-secondary" />
              <Skeleton className="h-9 w-32 bg-secondary" />
              <Skeleton className="h-4 w-36 bg-secondary" />
            </div>
            <Skeleton className="h-40 w-full rounded-xl bg-secondary" />
          </div>
        ) : weightHistory && weightHistory.length > 0 ? (
          <div className="bg-card rounded-[22px] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Scale className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Current Weight</span>
                </div>
                <p className="text-3xl font-bold text-foreground">
                  {currentWeight !== undefined ? Math.round(currentWeight * 2) / 2 : "--"} <span className="text-lg text-muted-foreground">lbs</span>
                </p>
                {weightChange !== 0 && (
                  <div className={`flex items-center gap-1 mt-1 ${weightChange > 0 ? 'text-destructive' : 'text-primary'}`}>
                    {weightChange > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    <span className="text-sm">{Math.round(Math.abs(weightChange) * 2) / 2} lbs this {timeRange}</span>
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
          <div className="bg-card rounded-[22px] p-8 text-center">
            <Scale className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No weight data yet</p>
            <p className="text-muted-foreground text-sm mt-1">Log your weight daily to see trends</p>
          </div>
        )}

        {/* Adaptive TDEE Section */}
        {tdeeData ? (
          (() => {
            const isAdaptive = (tdeeData.source ?? "adaptive") === "adaptive";
            const required = tdeeData.requiredDaysForAdaptive ?? 7;
            return (
              <div className="bg-card rounded-[22px] p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Flame className="h-4 w-4 text-highlight" />
                      <span className="text-sm text-muted-foreground">
                        {isAdaptive ? "Estimated Calorie Burn" : "Estimated Maintenance Calories"}
                      </span>
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {tdeeData.value} <span className="text-lg text-muted-foreground">cal/day</span>
                    </p>
                    {isAdaptive ? (
                      <p className="text-sm mt-1">
                        {tdeeData.difference > 0 ? (
                          <span className="text-primary">↑ {tdeeData.difference} higher than formula</span>
                        ) : tdeeData.difference < 0 ? (
                          <span className="text-destructive">↓ {Math.abs(tdeeData.difference)} lower than formula</span>
                        ) : (
                          <span className="text-muted-foreground">Matches formula estimate</span>
                        )}
                      </p>
                    ) : (
                      <p className="text-sm mt-1 text-muted-foreground">
                        Formula estimate, not your daily food target. Adaptive adjustments are disabled in this beta.
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground mb-1">Confidence</p>
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={`w-2 h-6 rounded-full ${
                            i < (tdeeData.confidence === "high" ? 5 : tdeeData.confidence === "medium" ? 3 : 1)
                              ? "bg-primary"
                              : "bg-accent"
                          }`}
                        />
                      ))}
                    </div>
                    {isAdaptive && <p className="text-xs text-muted-foreground mt-1">
                      {isAdaptive
                        ? `${tdeeData.daysOfData} days`
                        : `${tdeeData.daysOfData}/${required} days`}
                    </p>}
                  </div>
                </div>

                {!isAdaptive && tdeeData.adaptiveEnabled && (
                  <div className="space-y-1">
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${Math.min((tdeeData.daysOfData / Math.max(required, 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="bg-black/30 rounded-xl p-3 mt-3">
                  <p className="text-xs text-muted-foreground">
                    {isAdaptive
                      ? "This is an estimate based on logged food and weight changes, not a direct measurement of metabolism."
                      : "This is a Mifflin-St Jeor maintenance estimate from your profile. Use Today for your daily food target, which also accounts for your goal."}
                  </p>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="bg-card rounded-[22px] p-5">
            <div className="flex items-center gap-3">
              <div className="bg-highlight-soft rounded-xl p-3">
                <Flame className="h-6 w-6 text-highlight" />
              </div>
              <div className="flex-1">
                <p className="text-foreground font-medium">Estimated Maintenance Calories</p>
                <p className="text-muted-foreground text-sm">Estimate unavailable</p>
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground mt-3">
              — <span className="text-lg text-muted-foreground">cal/day</span>
            </p>
            <p className="text-xs text-muted-foreground mt-3">
              Complete your profile to calculate a formula estimate. Adaptive adjustments are disabled in this beta.
            </p>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Days Logged</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{statsData?.totalDaysLogged || 0}</p>
          </div>

          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="h-4 w-4 text-highlight" />
              <span className="text-xs text-muted-foreground">Current Streak</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{statsData?.streak || 0} <span className="text-sm text-muted-foreground">days</span></p>
          </div>

          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Avg Calories</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{statsData?.avgCalories?.toLocaleString() || 0}</p>
          </div>

          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-highlight" />
              <span className="text-xs text-muted-foreground">Consistency</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{statsData?.consistency || 0}<span className="text-sm text-muted-foreground">%</span></p>
          </div>
        </div>

      </div>
    </div>
  );
}
