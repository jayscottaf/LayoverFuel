import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number | string;
  target?: number | string;
  status?: "on-track" | "low" | "great";
  progress?: number;
  className?: string;
}

export function StatCard({
  title,
  value,
  target,
  status = "on-track",
  progress = 0,
  className
}: StatCardProps) {
  const statusColors = {
    "on-track": {
      text: "text-green-500",
      bg: "bg-green-100",
      progressBar: "bg-primary-500"
    },
    "low": {
      text: "text-yellow-500",
      bg: "bg-yellow-100",
      progressBar: "bg-yellow-500"
    },
    "great": {
      text: "text-green-500",
      bg: "bg-green-100",
      progressBar: "bg-green-500"
    }
  };

  const statusLabels = {
    "on-track": "On Track",
    "low": "Low",
    "great": "Great"
  };

  return (
    <div className={cn("bg-white rounded-lg shadow-sm p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-500 text-sm font-medium">{title}</h3>
        <span className={`${statusColors[status].text} ${statusColors[status].bg} text-xs font-medium rounded-full px-2 py-0.5`}>
          {statusLabels[status]}
        </span>
      </div>
      <div className="flex items-end space-x-2">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {target && <p className="text-sm text-gray-500">/ {target}</p>}
      </div>
      <div className="mt-3 bg-gray-200 rounded-full h-2">
        <div 
          className={`${statusColors[status].progressBar} h-2 rounded-full`} 
          style={{ width: `${Math.min(100, progress)}%` }}
        ></div>
      </div>
    </div>
  );
}
