import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type AIProgressStep = "upload" | "analyze" | "ready";

const STEP_ORDER: AIProgressStep[] = ["upload", "analyze", "ready"];

const STEP_LABELS: Record<AIProgressStep, string> = {
  upload: "Uploading",
  analyze: "Analyzing",
  ready: "Ready",
};

interface AIProgressProps {
  step: AIProgressStep;
  className?: string;
}

export function AIProgress({ step, className }: AIProgressProps) {
  const currentIndex = STEP_ORDER.indexOf(step);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {STEP_ORDER.map((s, i) => {
        const isDone = i < currentIndex;
        const isActive = i === currentIndex;
        return (
          <div key={s} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors",
                isDone && "bg-green-500/20 border border-green-500/40",
                isActive && "bg-indigo-500/20 border border-indigo-500/40",
                !isDone && !isActive && "bg-gray-800 border border-gray-700"
              )}
            >
              {isDone ? (
                <Check className="h-3.5 w-3.5 text-green-400" />
              ) : isActive ? (
                <Loader2 className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border-2 border-gray-600" />
              )}
              <span
                className={cn(
                  "text-xs font-medium",
                  isDone && "text-green-400",
                  isActive && "text-indigo-300",
                  !isDone && !isActive && "text-gray-500"
                )}
              >
                {STEP_LABELS[s]}
              </span>
            </div>
            {i < STEP_ORDER.length - 1 && (
              <div
                className={cn(
                  "h-px w-3 transition-colors",
                  isDone ? "bg-green-500/40" : "bg-gray-700"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
