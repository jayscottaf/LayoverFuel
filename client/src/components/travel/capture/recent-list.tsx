import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { useRecentMeals, type RecentMeal } from "../api";
import { formatDayLabel, shiftDate } from "../local-date";
import { MacroLine, SkeletonBlock, StateMessage } from "../primitives";
import { btnGhost, btnSecondary } from "./ui";

/**
 * Meals logged in the last 30 days. Tapping one opens review pre-filled —
 * it never saves directly.
 */
export function RecentList({
  today,
  offline,
  limit,
  onPick,
  onSeeAll,
  titleId,
  title,
}: {
  today: string;
  offline: boolean;
  limit?: number;
  onPick: (meal: RecentMeal) => void;
  onSeeAll?: () => void;
  titleId: string;
  title: string;
}) {
  const { data, isPending, isError, fetchStatus, refetch } = useRecentMeals(today, shiftDate);
  const meals = limit ? (data ?? []).slice(0, limit) : data ?? [];
  const more = !!limit && !!onSeeAll && (data?.length ?? 0) > limit;

  let body: ReactNode;
  if (!data && (offline || fetchStatus === "paused")) {
    body = (
      <StateMessage
        tone="offline"
        title="Recent meals need a connection"
        body="They'll show up here when you're back online. You can still enter a meal manually."
      />
    );
  } else if (isPending) {
    body = (
      <div role="status" aria-label="Loading recent meals" className="space-y-2">
        <SkeletonBlock className="h-14" />
        <SkeletonBlock className="h-14" />
        <SkeletonBlock className="h-14" />
      </div>
    );
  } else if (isError && !data) {
    body = (
      <StateMessage
        tone="error"
        title="Couldn't load recent meals"
        body="Check your connection and try again."
        action={
          <button type="button" onClick={() => void refetch()} className={btnSecondary}>
            Retry
          </button>
        }
      />
    );
  } else if (!meals.length) {
    body = (
      <StateMessage
        title="No recent meals yet"
        body="Meals you save show up here, so logging a usual order again takes one tap and a quick check."
      />
    );
  } else {
    body = (
      <ul className="divide-y overflow-hidden rounded-lg border bg-background">
        {meals.map(meal => (
          <li key={meal.key}>
            <button
              type="button"
              onClick={() => onPick(meal)}
              className="flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-secondary"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{meal.name}</span>
                <MacroLine m={meal.totals} className="mt-0.5" />
              </span>
              <span className="shrink-0 text-right text-xs text-muted-foreground tabular">
                {formatDayLabel(meal.lastDate, today)}
                {meal.count > 1 && <span className="block">{meal.count} times</span>}
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <section aria-labelledby={titleId}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 id={titleId} className="text-sm font-semibold">
          {title}
        </h3>
        {more && (
          <button type="button" onClick={onSeeAll} className={`${btnGhost} -mr-3`}>
            See all
          </button>
        )}
      </div>
      {body}
    </section>
  );
}
