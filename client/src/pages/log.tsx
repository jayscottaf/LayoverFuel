import { useCallback, useId, useMemo, type ReactNode } from "react";
import { NotebookPen, Plus, WifiOff } from "lucide-react";
import { useOffline } from "@/hooks/use-offline";
import {
  nonNeg,
  sumMacros,
  useDashboard,
  useNutritionDay,
  type DashboardData,
  type NutritionLog,
} from "@/components/travel/api";
import { useCapture } from "@/components/travel/capture/capture-context";
import { formatDayLabel, formatShortDate, shiftDate, useLocalDay } from "@/components/travel/local-date";
import { Page, PageHeader, StateMessage } from "@/components/travel/primitives";
import { DateNav } from "@/components/travel/log/date-nav";
import { DaySummary, DaySummarySkeleton, type TargetsState } from "@/components/travel/log/day-summary";
import { logAgainDraft, logMacros } from "@/components/travel/log/log-again";
import { MealGroups, MealGroupsSkeleton } from "@/components/travel/log/meal-groups";
import { RetryButton } from "@/components/travel/log/retry-button";
import { btnPrimary } from "@/components/travel/log/ui";
import { useLogDate } from "@/components/travel/log/use-log-date";
import { usePendingDeletes } from "@/components/travel/log/use-pending-deletes";

/** "today" / "yesterday" / "Mon, Sep 21" for use inside a sentence. */
function dayPhrase(date: string, today: string): string {
  if (date === today) return "today";
  if (date === shiftDate(today, -1)) return "yesterday";
  return formatShortDate(date);
}

function targetsFrom(
  dashboard: { data?: DashboardData; isError: boolean; isFetching: boolean; refetch: () => unknown },
  isOffline: boolean,
): TargetsState {
  const macros = dashboard.data?.stats?.macros;
  if (dashboard.data) {
    const calories = nonNeg(macros?.targetCalories);
    if (calories <= 0) return { status: "unset" };
    return {
      status: "ready",
      targets: {
        calories,
        protein: nonNeg(macros?.protein),
        carbs: nonNeg(macros?.carbs),
        fat: nonNeg(macros?.fat),
      },
    };
  }
  if (isOffline) return { status: "offline" };
  if (dashboard.isError) {
    return { status: "error", retry: () => void dashboard.refetch(), retrying: dashboard.isFetching };
  }
  return { status: "loading" };
}

/**
 * Food diary: pick a day, see what was logged against the daily targets, and
 * correct, repeat, add or remove meals. Every change goes through review in
 * the capture flow; deletes can be undone for a few seconds.
 */
export default function LogPage() {
  const { today, timezone } = useLocalDay();
  const { date, setDate, isToday } = useLogDate(today);
  const { isOffline } = useOffline();
  const { open } = useCapture();
  const day = useNutritionDay(date);
  // Targets are the same every day in this beta, so today's dashboard supplies them.
  const dashboard = useDashboard(today, timezone);
  const { hidden, requestDelete } = usePendingDeletes();
  const offlineNoteId = useId();

  const visible = useMemo<NutritionLog[] | null>(
    () => (day.data ? day.data.filter(log => !hidden.has(log.id)) : null),
    [day.data, hidden],
  );
  const totals = useMemo(() => (visible ? sumMacros(visible.map(logMacros)) : null), [visible]);

  const dayLabel = formatDayLabel(date, today);
  const phrase = dayPhrase(date, today);
  const summaryTitle = isToday ? "Today so far" : `${dayLabel} total`;
  const targets = targetsFrom(dashboard, isOffline);

  const onEdit = useCallback((log: NutritionLog) => open({ editLog: log }), [open]);
  const onLogAgain = useCallback(
    (log: NutritionLog) => open({ date: today, draft: logAgainDraft(log, today, timezone) }),
    [open, today, timezone],
  );
  const onDelete = useCallback((log: NutritionLog) => requestDelete(log, date), [requestDelete, date]);
  const addToDay = () => open({ date });

  const addButton = (
    <button type="button" onClick={addToDay} className={`${btnPrimary} w-full sm:w-auto sm:self-start`}>
      <Plus className="h-4 w-4" aria-hidden="true" />
      {isToday ? "Add food to today" : "Add food to this day"}
    </button>
  );

  let summary: ReactNode = null;
  let meals: ReactNode;
  let showAdd = false;

  if (visible && totals) {
    summary = <DaySummary title={summaryTitle} totals={totals} targets={targets} />;
    if (visible.length > 0) {
      showAdd = true;
      meals = (
        <MealGroups
          logs={visible}
          timezone={timezone}
          isOffline={isOffline}
          offlineNoteId={offlineNoteId}
          onEdit={onEdit}
          onLogAgain={onLogAgain}
          onDelete={onDelete}
        />
      );
    } else {
      meals = (
        <StateMessage
          icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />}
          title={`Nothing logged for ${phrase}`}
          body={
            isToday
              ? "Take a photo, describe it, scan a barcode or enter it yourself. You review everything before it's saved."
              : "Add anything you ate that day. You review everything before it's saved."
          }
          action={addButton}
        />
      );
    }
  } else if (isOffline) {
    meals = (
      <StateMessage
        tone="offline"
        title={`Meals for ${phrase} will load when you're back online`}
        body="You can still log food. It's kept on this device and syncs when you reconnect."
        action={addButton}
      />
    );
  } else if (day.isError) {
    meals = (
      <StateMessage
        tone="error"
        title={`Meals for ${phrase} didn't load`}
        body="Check your connection and try again. You can still log food."
        action={<RetryButton onRetry={() => void day.refetch()} busy={day.isFetching} />}
      />
    );
  } else {
    summary = <DaySummarySkeleton />;
    meals = <MealGroupsSkeleton />;
  }

  // Shown above a loaded list: explains why Edit and Delete are unavailable.
  const offlineNote =
    visible && isOffline ? (
      <p id={offlineNoteId} className="flex items-start gap-2 rounded-xl bg-warning-soft px-4 py-3 text-sm">
        <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>
          You're offline. Editing and deleting need a connection. Log again and Add food still work; those meals
          sync and appear here when you reconnect.
        </span>
      </p>
    ) : null;

  // A background refresh failed but earlier data is still on screen.
  const refreshError =
    visible && day.isError && !isOffline ? (
      <StateMessage
        tone="error"
        title="Couldn't refresh this day"
        body="Showing what was loaded before."
        action={<RetryButton onRetry={() => void day.refetch()} busy={day.isFetching} />}
      />
    ) : null;

  return (
    <Page wide>
      <PageHeader title="Food log" subtitle="Everything you've logged, day by day." />

      <div className="flex flex-col gap-4 md:gap-6">
        <DateNav date={date} today={today} onChange={setDate} />

        {/*
          One column on mobile: summary, then meals. On md+ the meals take the
          wider left column and the summary sits in a sticky column on the right.
          The summary only has controls when targets are missing, so keyboard focus
          still reaches the meals first in the normal case.
        */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5 md:gap-6">
          {summary && (
            <div className="min-w-0 md:sticky md:top-8 md:order-2 md:col-span-2 md:self-start">{summary}</div>
          )}
          <div className={`flex min-w-0 flex-col gap-4 md:order-1 ${summary ? "md:col-span-3" : "md:col-span-5"}`}>
            {offlineNote}
            {refreshError}
            {meals}
            {showAdd && addButton}
          </div>
        </div>
      </div>
    </Page>
  );
}
