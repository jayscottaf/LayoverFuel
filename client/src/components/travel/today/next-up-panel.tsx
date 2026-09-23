import { useId } from "react";
import { Link } from "wouter";
import type { UseQueryResult } from "@tanstack/react-query";
import { Info, Pin } from "lucide-react";
import type { PlanMeal, TravelPlan } from "../api";
import { planMealDraft } from "../plan/plan-utils";
import { useCapture } from "../capture/capture-context";
import { MacroLine, Panel, SectionTitle, SkeletonBlock, SourceBadge, StateMessage } from "../primitives";
import { RetryButton, buttonSecondary, headerLink } from "./shared";

const COVERAGE_NOTE: Record<TravelPlan["coverage"], string> = {
  generic: "General ideas for your pattern, not verified nearby places.",
};

/** A planned meal as an unsaved draft; the capture flow opens it for review before anything is saved. */
function NextMeal({ meal, today }: { meal: PlanMeal; today: string }) {
  const { open } = useCapture();
  const kept = meal.status === "locked";
  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-medium leading-snug">{meal.name}</h3>
        {kept && (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            <Pin className="h-3.5 w-3.5 text-highlight" aria-hidden="true" />
            Kept
          </span>
        )}
      </div>
      {meal.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{meal.description}</p>}
      <MacroLine m={meal} className="mt-2" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <SourceBadge source={meal.source === "manual" ? "manual" : "estimate"} />
        <button
          type="button"
          onClick={() => open({ date: today, draft: planMealDraft(meal, today) })}
          className={buttonSecondary}
        >
          Log this<span className="sr-only">: {meal.name}</span>
        </button>
      </div>
    </li>
  );
}

/**
 * The next good meal decisions from the server-derived plan. Plan failures are
 * contained here so the rest of Today keeps working.
 */
export function NextUpPanel({
  plan,
  today,
  isOffline,
}: {
  plan: UseQueryResult<TravelPlan>;
  today: string;
  isOffline: boolean;
}) {
  const titleId = useId();
  const data = plan.data;

  if (!data) {
    if (isOffline) {
      return (
        <StateMessage
          tone="offline"
          title="Your plan will load when you're back online"
          body="You can still log meals now. They're kept on this device and sync later."
        />
      );
    }
    if (plan.isError) {
      return (
        <StateMessage
          tone="error"
          title="Your plan isn't available right now"
          body="Your totals and logging still work."
          action={<RetryButton onRetry={() => void plan.refetch()} busy={plan.isFetching} />}
        />
      );
    }
    return <NextUpSkeleton />;
  }

  const meals = (data.meals ?? []).slice(0, 2);
  const hasContext = Boolean(data.context?.location?.trim());
  const coverageNote = COVERAGE_NOTE[data.coverage] ?? COVERAGE_NOTE.generic;

  return (
    <Panel labelledBy={titleId}>
      <SectionTitle
        id={titleId}
        action={
          <Link href="/plan" className={headerLink}>
            Open plan
          </Link>
        }
      >
        Next up
      </SectionTitle>

      {data.message && <p className="text-sm text-muted-foreground">{data.message}</p>}

      {meals.length > 0 ? (
        <ul className={`divide-y ${data.message ? "mt-4" : ""}`}>
          {meals.map(meal => (
            <NextMeal key={meal.id} meal={meal} today={today} />
          ))}
        </ul>
      ) : (
        <div className={data.message ? "mt-4" : ""}>
          <p className="font-medium">No meal ideas for the rest of today</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {hasContext
              ? "Your plan has nothing left to suggest right now."
              : "Add where you are and your meal windows to get ideas that fit your day."}
          </p>
          {!hasContext && (
            <Link href="/plan" className={`${buttonSecondary} mt-3`}>
              Set up today's plan
            </Link>
          )}
        </div>
      )}

      {plan.isError && (
        <p className="mt-4 text-xs text-muted-foreground">Couldn't refresh your plan. Showing the last loaded version.</p>
      )}

      <p className="mt-4 flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{coverageNote}</span>
      </p>
    </Panel>
  );
}

export function NextUpSkeleton() {
  return (
    <Panel>
      <div role="status">
        <span className="sr-only">Loading your plan</span>
        <SkeletonBlock className="h-5 w-24" />
        <SkeletonBlock className="mt-4 h-4 w-full" />
        <SkeletonBlock className="mt-2 h-4 w-3/4" />
        {[0, 1].map(i => (
          <div key={i} className="mt-5">
            <SkeletonBlock className="h-4 w-1/2" />
            <SkeletonBlock className="mt-2 h-3 w-full" />
            <SkeletonBlock className="mt-2 h-3 w-2/3" />
            <SkeletonBlock className="mt-3 h-11 w-28" />
          </div>
        ))}
      </div>
    </Panel>
  );
}
