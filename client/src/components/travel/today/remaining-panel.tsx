import { useId } from "react";
import { Link } from "wouter";
import { Info } from "lucide-react";
import { nonNeg, type DashboardData } from "../api";
import { formatShortDate, isDateKey } from "../local-date";
import {
  CalorieSummary,
  MacroLine,
  MacroMeter,
  Panel,
  SectionTitle,
  SkeletonBlock,
  fmtInt,
} from "../primitives";
import { RetryButton } from "./shared";

/**
 * What's left today. The calorie goal is always stats.macros.targetCalories;
 * it never moves because of a meal, and going past it is stated neutrally.
 */
export function RemainingPanel({
  data,
  today,
  refreshFailed,
  refreshing,
  onRetry,
}: {
  data: DashboardData;
  today: string;
  /** A background refresh failed; the numbers shown are the last ones loaded. */
  refreshFailed: boolean;
  refreshing: boolean;
  onRetry: () => void;
}) {
  const titleId = useId();
  const targets = data.stats?.macros;
  const targetCalories = nonNeg(targets?.targetCalories);
  const consumed = nonNeg(data.stats?.currentCalories);
  const eaten = {
    calories: consumed,
    protein: nonNeg(data.nutritionLog?.protein),
    carbs: nonNeg(data.nutritionLog?.carbs),
    fat: nonNeg(data.nutritionLog?.fat),
  };
  const macroTargets = {
    protein: nonNeg(targets?.protein),
    carbs: nonNeg(targets?.carbs),
    fat: nonNeg(targets?.fat),
  };
  const hasMacroTargets = macroTargets.protein > 0 || macroTargets.carbs > 0 || macroTargets.fat > 0;
  const serverDate = data.date;
  const dayMismatch = Boolean(serverDate && serverDate !== today);

  return (
    <Panel labelledBy={titleId}>
      <SectionTitle id={titleId}>Remaining today</SectionTitle>

      {targetCalories > 0 ? (
        <CalorieSummary consumed={consumed} target={targetCalories} basis="Based on logged meals" />
      ) : (
        <div>
          <p className="text-4xl font-semibold tabular tracking-tight">
            {fmtInt(consumed)}
            <span className="ml-1.5 text-base font-normal text-muted-foreground">kcal eaten</span>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            No daily target yet.{" "}
            <Link href="/profile" className="font-medium text-primary underline-offset-4 hover:underline">
              Add your details in Profile
            </Link>{" "}
            to see what's left.
          </p>
        </div>
      )}

      {hasMacroTargets ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-1 md:gap-3 lg:grid-cols-3 lg:gap-4">
          <MacroMeter macro="protein" consumed={eaten.protein} target={macroTargets.protein} />
          <MacroMeter macro="carbs" consumed={eaten.carbs} target={macroTargets.carbs} />
          <MacroMeter macro="fat" consumed={eaten.fat} target={macroTargets.fat} />
        </div>
      ) : (
        <MacroLine m={eaten} className="mt-4" />
      )}

      {dayMismatch && serverDate && (
        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            These totals are for {isDateKey(serverDate) ? formatShortDate(serverDate) : serverDate}, but your local
            day is {formatShortDate(today)}.
            They may not include today's meals yet.
          </span>
        </p>
      )}

      {refreshFailed && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">Couldn't refresh. Showing the last loaded totals.</p>
          <RetryButton onRetry={onRetry} busy={refreshing} />
        </div>
      )}
    </Panel>
  );
}

export function RemainingSkeleton() {
  return (
    <Panel>
      <div role="status">
        <span className="sr-only">Loading today's totals</span>
        <SkeletonBlock className="h-5 w-36" />
        <SkeletonBlock className="mt-4 h-10 w-48" />
        <SkeletonBlock className="mt-3 h-2 w-full" />
        <SkeletonBlock className="mt-2 h-3 w-56" />
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-1 md:gap-3 lg:grid-cols-3 lg:gap-4">
          {[0, 1, 2].map(i => (
            <div key={i}>
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="mt-1.5 h-1.5 w-full" />
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
