import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

interface WeightEntry {
  date: string;
  weight: number;
}

interface WeightProgressChartProps {
  data: WeightEntry[];
  goalWeight?: number;
  className?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const date = new Date(label);
    const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const roundedWeight = Math.round(payload[0].value * 2) / 2;

    return (
      <div className="bg-gray-950 border border-blue-500/20 rounded-lg p-3 shadow-2xl backdrop-blur">
        <p className="text-xs text-gray-400 mb-1">{formattedDate}</p>
        <div className="flex items-baseline gap-1">
          <p className="text-lg font-bold text-white">{roundedWeight}</p>
          <p className="text-xs text-gray-400">lbs</p>
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
  const chartData = data.length > 0 ? data : [];

  // Format dates for better display and round weights to nearest 0.5 lbs
  const formattedData = chartData.map(entry => ({
    ...entry,
    weight: Math.round(entry.weight * 2) / 2,
    displayDate: new Date(entry.date).toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric'
    })
  }));

  // Calculate Y-axis domain with padding (use rounded weights)
  const weights = formattedData.map(d => d.weight);
  const allWeights = goalWeight ? [...weights, goalWeight] : weights;
  const minWeight = weights.length > 0 ? Math.min(...allWeights) - 3 : 150;
  const maxWeight = weights.length > 0 ? Math.max(...allWeights) + 3 : 200;

  return (
    <div className={`${className}`}>
      <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800">
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
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" strokeOpacity={0.3} />
                <XAxis
                  dataKey="displayDate"
                  stroke="#6B7280"
                  fontSize={10}
                  tick={{ fill: '#6B7280' }}
                  axisLine={{ stroke: '#374151' }}
                />
                <YAxis
                  domain={[minWeight, maxWeight]}
                  stroke="#6B7280"
                  fontSize={10}
                  tick={{ fill: '#6B7280' }}
                  axisLine={{ stroke: '#374151' }}
                  tickFormatter={(value) => `${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                {goalWeight && (
                  <ReferenceLine
                    y={goalWeight}
                    stroke="#10B981"
                    strokeDasharray="8 4"
                    strokeWidth={1.5}
                    label={{
                      value: "Goal",
                      position: "right",
                      fill: "#10B981",
                      fontSize: 10
                    }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="weight"
                  stroke="#3B82F6"
                  strokeWidth={2.5}
                  fill="url(#weightGradient)"
                  activeDot={{
                    r: 5,
                    fill: "#3B82F6",
                    stroke: "#1E293B",
                    strokeWidth: 2
                  }}
                  dot={{
                    r: 3,
                    fill: "#3B82F6",
                    stroke: "#1E293B",
                    strokeWidth: 1.5
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500 text-sm mb-2">No weight data available</p>
                <p className="text-gray-600 text-xs">Log your weight to see trends</p>
              </div>
            </div>
          )}
        </div>

        {chartData.length > 0 && (
          <div className="mt-3 flex items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-0.5 bg-blue-500"></div>
              <span className="text-xs text-gray-400">Current</span>
            </div>
            {goalWeight && (
              <div className="flex items-center gap-2">
                <div className="w-3 h-0.5 bg-green-500" style={{ borderTop: '2px dashed #10B981', height: 0 }}></div>
                <span className="text-xs text-gray-400">Goal</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
