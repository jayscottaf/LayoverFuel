import { useId, useRef } from "react";
import { Info, Loader2, NotebookPen, Pin, Trash2 } from "lucide-react";
import type { PlanMeal, TravelPlan } from "../api";
import { useCapture } from "../capture/capture-context";
import { MacroLine, Panel, SkeletonBlock, SourceBadge } from "../primitives";
import { AddFixedMeal } from "./add-fixed-meal";
import { planMacros, planMealDraft } from "./plan-utils";
import { RetryButton } from "./retry-button";
import { btnLink, btnQuiet, btnSecondary, btnSecondaryPressed } from "./ui";
import type { PlanBusy, PlanMutations } from "./use-plan-mutations";

const COVERAGE_NOTE =
  "These are general meal ideas for your travel pattern, not verified nearby places. Nutrition is estimated.";

function MealStatus({ meal }: { meal: PlanMeal }) {
  if (meal.source === "manual" || meal.status === "locked") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
        <Pin className="h-3.5 w-3.5 text-highlight" aria-hidden="true" />
        {meal.source === "manual" ? "Fixed meal" : "Kept"}
      </span>
    );
  }
  return <span className="shrink-0 text-xs text-muted-foreground">Suggested</span>;
}

function MealItem({
  meal,
  readOnly,
  readOnlyNoteId,
  busy,
  onLog,
  onKeep,
  onRemove,
}: {
  meal: PlanMeal;
  readOnly: boolean;
  readOnlyNoteId?: string;
  busy: PlanBusy;
  onLog: (meal: PlanMeal) => void;
  onKeep: (meal: PlanMeal, kept: boolean) => void;
  onRemove: (meal: PlanMeal) => void;
}) {
  const manual = meal.source === "manual";
  const kept = meal.status === "locked";
  const blocked = readOnly || busy !== null;
  const working = busy?.mealId === meal.id;
  const describedBy = readOnly ? readOnlyNoteId : undefined;
  const description = meal.description?.trim();

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-medium leading-snug">{meal.name}</h3>
        <MealStatus meal={meal} />
      </div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <MacroLine m={planMacros(meal)} />
        <SourceBadge source={manual ? "manual" : "estimate"} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* Logging still works offline: the capture flow queues the save. */}
        <button type="button" onClick={() => onLog(meal)} className={btnSecondary}>
          <NotebookPen className="h-4 w-4" aria-hidden="true" />
          Log this<span className="sr-only">: {meal.name}</span>
        </button>

        {manual ? (
          <button
            type="button"
            aria-disabled={blocked || undefined}
            aria-describedby={describedBy}
            onClick={() => {
              if (!blocked) onRemove(meal);
            }}
            className={btnQuiet}
          >
            {working && busy?.kind === "remove" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            )}
            Remove<span className="sr-only">: {meal.name}</span>
          </button>
        ) : (
          <button
            type="button"
            aria-pressed={kept}
            aria-disabled={blocked || undefined}
            aria-describedby={describedBy}
            onClick={() => {
              if (!blocked) onKeep(meal, !kept);
            }}
            className={kept ? btnSecondaryPressed : btnQuiet}
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Pin className={`h-4 w-4 ${kept ? "text-highlight" : ""}`} aria-hidden="true" />
            )}
            Keep<span className="sr-only">: {meal.name}</span>
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * The rest of the day's meals: generic ideas for the travel pattern plus any
 * fixed meals the user added. Nothing here is logged until the user reviews
 * and saves it in the capture flow.
 */
export function MealsPanel({
  plan,
  date,
  isToday,
  readOnly,
  readOnlyNoteId,
  mutations,
  refreshFailed,
  refreshing,
  onRetry,
  onSetUp,
}: {
  plan: TravelPlan;
  date: string;
  isToday: boolean;
  readOnly: boolean;
  readOnlyNoteId?: string;
  mutations: PlanMutations;
  refreshFailed: boolean;
  refreshing: boolean;
  onRetry: () => void;
  onSetUp: () => void;
}) {
  const titleId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { open } = useCapture();
  const meals = plan.meals ?? [];
  const { busy } = mutations;

  const onLog = (meal: PlanMeal) => open({ date, draft: planMealDraft(meal, date) });
  const onKeep = (meal: PlanMeal, kept: boolean) => void mutations.setKept(meal, kept);
  const onRemove = async (meal: PlanMeal) => {
    const outcome = await mutations.removeMeal(meal);
    // The row is gone; keep keyboard users anchored in the list.
    if (outcome.ok) headingRef.current?.focus();
  };

  return (
    <Panel labelledBy={titleId}>
      <div className="mb-3">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-base font-semibold">
          {isToday ? "Meal ideas for the rest of today" : "Meal ideas for tomorrow"}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Keep an idea to hold it in place when the plan updates.
        </p>
      </div>

      <p className="mb-4 flex items-start gap-2 rounded-lg bg-secondary px-3 py-2.5 text-xs text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{COVERAGE_NOTE}</span>
      </p>

      {meals.length > 0 ? (
        <ul className="divide-y">
          {meals.map(meal => (
            <MealItem
              key={meal.id}
              meal={meal}
              readOnly={readOnly}
              readOnlyNoteId={readOnlyNoteId}
              busy={busy}
              onLog={onLog}
              onKeep={onKeep}
              onRemove={m => void onRemove(m)}
            />
          ))}
        </ul>
      ) : (
        <div>
          <p className="font-medium">No meal ideas yet — set your pattern and save to generate them.</p>
          <button type="button" onClick={onSetUp} className={btnLink}>
            Set where you are and what you have
          </button>
        </div>
      )}

      {refreshFailed && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">Couldn't refresh your plan. Showing the last loaded version.</p>
          <RetryButton onRetry={onRetry} busy={refreshing} />
        </div>
      )}

      <div className="mt-5 border-t pt-4">
        <AddFixedMeal
          readOnly={readOnly}
          readOnlyNoteId={readOnlyNoteId}
          busy={busy}
          onAdd={mutations.addMeal}
        />
      </div>
    </Panel>
  );
}

export function MealsSkeleton() {
  return (
    <Panel>
      <SkeletonBlock className="h-5 w-56" />
      <SkeletonBlock className="mt-2 h-4 w-3/4" />
      <SkeletonBlock className="mt-4 h-10 w-full" />
      {[0, 1, 2].map(i => (
        <div key={i} className="mt-5">
          <SkeletonBlock className="h-4 w-1/2" />
          <SkeletonBlock className="mt-2 h-3 w-full" />
          <SkeletonBlock className="mt-2 h-3 w-2/3" />
          <div className="mt-3 flex gap-2">
            <SkeletonBlock className="h-11 w-28" />
            <SkeletonBlock className="h-11 w-20" />
          </div>
        </div>
      ))}
    </Panel>
  );
}
