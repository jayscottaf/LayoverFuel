import type { ReactNode } from "react";
import { Link } from "wouter";
import type { UseQueryResult } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { PLAN_PATTERN_LABELS, type TravelPlan } from "../api";
import { textLink } from "./shared";

/**
 * "Where am I" line under the Today title, or null when there is nothing to say
 * (so PageHeader doesn't render an empty line). PageHeader wraps it in a <p>,
 * so it only uses inline elements.
 */
export function planSubtitle(plan: UseQueryResult<TravelPlan>, isOffline: boolean): ReactNode {
  const context = plan.data?.context;
  const location = context?.location?.trim();

  if (location) {
    const pattern = context ? PLAN_PATTERN_LABELS[context.pattern]?.title : undefined;
    return (
      <>
        <MapPin className="mr-1 inline h-3.5 w-3.5 -translate-y-px align-middle" aria-hidden="true" />
        In {location}
        {pattern && (
          <>
            <span aria-hidden="true"> · </span>
            <span className="sr-only">, </span>
            {pattern}
          </>
        )}
      </>
    );
  }

  if (plan.data) {
    return (
      <Link href="/plan" className={textLink}>
        Add where you are and your meal windows
      </Link>
    );
  }

  // Still loading: hold the line so the header doesn't jump. On error or offline
  // the Next up panel explains; the header stays quiet.
  if (plan.isPending && !plan.isError && !isOffline) {
    return <span className="inline-block h-4 w-48 animate-pulse rounded-lg bg-muted align-middle" aria-hidden="true" />;
  }
  return null;
}
