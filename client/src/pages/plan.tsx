import { useId, useState, type ReactNode } from "react";
import { WifiOff } from "lucide-react";
import { useOffline } from "@/hooks/use-offline";
import { useTravelPlan } from "@/components/travel/api";
import { formatLongDate, shiftDate, useLocalDay } from "@/components/travel/local-date";
import { Page, PageHeader, Segmented, StateMessage } from "@/components/travel/primitives";
import { BudgetPanel, BudgetSkeleton, WhatChanged } from "@/components/travel/plan/budget-panel";
import { ContextEditor, ContextSkeleton, PLAN_LOCATION_INPUT_ID } from "@/components/travel/plan/context-editor";
import { MealsPanel, MealsSkeleton } from "@/components/travel/plan/meals-panel";
import { RetryButton } from "@/components/travel/plan/retry-button";
import { usePlanMutations } from "@/components/travel/plan/use-plan-mutations";

type Day = "today" | "tomorrow";

const DAY_OPTIONS: Array<{ value: Day; label: string }> = [
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
];

/** Send people to the first context field (e.g. from the empty meal list). */
function focusContextEditor() {
  const el = document.getElementById(PLAN_LOCATION_INPUT_ID);
  if (!el) return;
  el.scrollIntoView({ block: "center" });
  el.focus({ preventScroll: true });
}

/**
 * The remaining-day plan. Targets are fixed; the server re-derives meal ideas
 * from what's been logged, and this screen just refetches. Kept and fixed meals
 * survive updates. Nothing here is logged until reviewed in the capture flow.
 */
export default function PlanPage() {
  const { today, timezone } = useLocalDay();
  const [day, setDay] = useState<Day>("today");
  const date = day === "today" ? today : shiftDate(today, 1);
  const isToday = day === "today";

  const plan = useTravelPlan(date, timezone);
  const { isOffline } = useOffline();
  const mutations = usePlanMutations({ date, timezone, refetch: plan.refetch });
  const offlineNoteId = useId();

  const retry = () => void plan.refetch();
  const data = plan.data;

  let content: ReactNode;
  if (data) {
    content = (
      <>
        {isOffline && (
          <p
            id={offlineNoteId}
            className="mb-4 flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm md:mb-6"
          >
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>
              You're offline, so this plan is read-only. You can still log meals from it. Changes to the plan can be
              saved when you reconnect.
            </span>
          </p>
        )}
        <div className="grid items-start gap-4 md:grid-cols-5 md:gap-6">
          <div className="flex min-w-0 flex-col gap-4 md:col-span-3 md:gap-6">
            <BudgetPanel plan={data} isToday={isToday} />
            <WhatChanged message={data.message} />
            <MealsPanel
              plan={data}
              date={date}
              isToday={isToday}
              readOnly={isOffline}
              readOnlyNoteId={isOffline ? offlineNoteId : undefined}
              mutations={mutations}
              refreshFailed={plan.isError}
              refreshing={plan.isFetching}
              onRetry={retry}
              onSetUp={focusContextEditor}
            />
          </div>
          <div className="min-w-0 md:sticky md:top-8 md:col-span-2 md:self-start">
            {/* Remount per day so the form starts from that day's saved context. */}
            <ContextEditor
              key={date}
              plan={data}
              readOnly={isOffline}
              readOnlyNoteId={isOffline ? offlineNoteId : undefined}
              busy={mutations.busy}
              onSave={mutations.saveContext}
            />
          </div>
        </div>
      </>
    );
  } else if (isOffline) {
    content = (
      <StateMessage
        tone="offline"
        title="Your plan will load when you're back online"
        body="You can still log meals. They're kept on this device and sync when you reconnect."
      />
    );
  } else if (plan.isError) {
    content = (
      <StateMessage
        tone="error"
        title="Plan isn't available right now"
        body="Meal ideas for the rest of your day will show here. Logging and your totals on Today still work."
        action={<RetryButton onRetry={retry} busy={plan.isFetching} />}
      />
    );
  } else {
    content = (
      <div role="status" className="grid items-start gap-4 md:grid-cols-5 md:gap-6">
        <span className="sr-only">Loading your plan</span>
        <div className="flex min-w-0 flex-col gap-4 md:col-span-3 md:gap-6">
          <BudgetSkeleton />
          <MealsSkeleton />
        </div>
        <div className="min-w-0 md:col-span-2">
          <ContextSkeleton />
        </div>
      </div>
    );
  }

  return (
    <Page wide>
      <PageHeader eyebrow={formatLongDate(date)} title="Plan" />

      <Segmented
        label="Plan for"
        value={day}
        options={DAY_OPTIONS}
        onChange={setDay}
        className="mb-4 md:mb-6 md:max-w-xs [&>button]:min-h-11"
      />

      {content}

      <p role="status" className="sr-only">
        {mutations.busy ? "Saving your plan" : ""}
      </p>
    </Page>
  );
}
