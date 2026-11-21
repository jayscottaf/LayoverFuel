import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { validWeightEntries, weightAxisDomain, type WeightEntry } from "@/lib/weight-history";

interface WeightProgressChartProps {
  data: WeightEntry[];
  goalWeight?: number;
  className?: string;
}

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(`${payload[0].payload.date}T00:00:00`);
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const roundedWeight = Math.round(payload[0].value * 2) / 2;

    return (
      <div className="bg-card border border-primary/40 rounded-lg p-3 shadow-2xl backdrop-blur">
        <p className="text-xs text-muted-foreground mb-1">{formattedDate}</p>
        <div className="flex items-baseline gap-1">
          <p className="text-lg font-bold text-foreground">{roundedWeight}</p>
          <p className="text-xs text-muted-foreground">lbs</p>
        </div>
      </div>
    );
  }
  return null;
};

export function WeightProgressChart({
  data,
  goalWeight,
  className = ""
}: WeightProgressChartProps) {
  const chartData = validWeightEntries(data);
  const validGoalWeight = goalWeight !== undefined && Number.isFinite(goalWeight) && goalWeight > 0
    ? goalWeight
    : undefined;

  // Format dates for better display and round weights to nearest 0.5 lbs
  const formattedData = chartData.map(entry => ({
    ...entry,
    weight: Math.round(entry.weight * 2) / 2,
    displayDate: new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric'
    })
  }));

  const [minWeight, maxWeight] = weightAxisDomain(formattedData, validGoalWeight);

  return (
    <div className={`${className}`}>
      <div className="bg-card rounded-xl p-4 border border-border">
        <div className="h-40">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={formattedData}
                margin={{
                  top: 10,
                  right: 10,
                  left: -20,
                  bottom: 0,
                }}
              >
                <defs>
                  <linearGradient id="weightGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                <XAxis
                  dataKey="displayDate"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  domain={[minWeight, maxWeight]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={10}
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                {validGoalWeight !== undefined && (
                  <ReferenceLine
                    y={validGoalWeight}
                    stroke="hsl(var(--highlight))"
                    strokeDasharray="8 4"
                    strokeWidth={1.5}
                    label={{
                      value: "Goal",
                      position: "right",
                      fill: "hsl(var(--highlight))",
                      fontSize: 10
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  fill="url(#weightGradient)"
                  activeDot={{
                    r: 5,
                    fill: "hsl(var(--primary))",
                    stroke: "hsl(var(--card))",
                    strokeWidth: 2
                  }}
                  dot={{
                    r: 3,
                    fill: "hsl(var(--primary))",
                    stroke: "hsl(var(--card))",
                    strokeWidth: 1.5
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-muted-foreground text-sm mb-2">No weight data available</p>
                <p className="text-muted-foreground text-xs">Log your weight to see trends</p>
              </div>
            </div>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="mt-3 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-primary"></div>
              <span className="text-xs text-muted-foreground">Current</span>
            </div>
            {validGoalWeight !== undefined && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-primary" style={{ borderTop: '2px dashed hsl(var(--highlight))', height: 0 }}></div>
                <span className="text-xs text-muted-foreground">Goal</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
