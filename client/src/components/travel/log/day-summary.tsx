import { useId } from "react";
import { Link } from "wouter";
import type { Macros } from "../api";
import {
  CalorieSummary,
  MacroMeter,
  Panel,
  SectionTitle,
  SkeletonBlock,
  fmtG,
  fmtInt,
} from "../primitives";
import { RetryButton } from "./retry-button";

export type TargetsState =
  | { status: "ready"; targets: Macros }
  | { status: "loading" }
  | { status: "offline" }
  | { status: "error"; retry: () => void; retrying: boolean }
  | { status: "unset" };

const METER_GRID = "grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-1 md:gap-3";

/** Totals without a target to compare against (targets offline, failed, or not set up). */
function TotalsOnly({ totals }: { totals: Macros }) {
  return (
    <div>
      <p className="text-4xl font-semibold tabular tracking-tight">
        {fmtInt(totals.calories)}
        <span className="ml-1.5 text-base font-normal text-muted-foreground">kcal eaten</span>
      </p>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        {(
          [
            ["Protein", totals.protein],
            ["Carbs", totals.carbs],
            ["Fat", totals.fat],
          ] as const
        ).map(([label, grams]) => (
          <div key={label} className="min-w-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular">{fmtG(grams)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TargetsNote({ state }: { state: Exclude<TargetsState, { status: "ready" } | { status: "loading" }> }) {
  if (state.status === "offline") {
    return <p className="mt-4 text-sm text-muted-foreground">Your targets load when you're back online.</p>;
  }
  if (state.status === "unset") {
    return (
      <p className="mt-4 text-sm text-muted-foreground">
        No calorie target yet.{" "}
        <Link href="/profile" className="font-medium text-primary underline-offset-4 hover:underline">
          Set your targets in Profile
        </Link>
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3" role="alert">
      <p className="text-sm text-muted-foreground">Your targets didn't load.</p>
      <RetryButton onRetry={state.retry} busy={state.retrying} />
    </div>
  );
}

/**
 * The selected day's totals against the (stable) daily targets. Over-target is
 * stated neutrally by CalorieSummary; targets never change because of a meal.
 */
export function DaySummary({
  title,
  totals,
  targets,
}: {
  title: string;
  totals: Macros;
  targets: TargetsState;
}) {
  const titleId = useId();
  return (
    <Panel labelledBy={titleId}>
      <SectionTitle id={titleId}>{title}</SectionTitle>
      {targets.status === "ready" ? (
        <>
          <CalorieSummary consumed={totals.calories} target={targets.targets.calories} basis="Based on logged meals" />
          <div className={`mt-5 ${METER_GRID}`}>
            <MacroMeter macro="protein" consumed={totals.protein} target={targets.targets.protein} />
            <MacroMeter macro="carbs" consumed={totals.carbs} target={targets.targets.carbs} />
            <MacroMeter macro="fat" consumed={totals.fat} target={targets.targets.fat} />
          </div>
        </>
      ) : targets.status === "loading" ? (
        <div role="status">
          <span className="sr-only">Loading your targets</span>
          <SkeletonBlock className="h-10 w-40" />
          <SkeletonBlock className="mt-3 h-2 w-full" />
          <SkeletonBlock className="mt-2 h-3 w-2/3" />
          <div className={`mt-5 ${METER_GRID}`}>
            {[0, 1, 2].map(i => (
              <SkeletonBlock key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <TotalsOnly totals={totals} />
          <TargetsNote state={targets} />
        </>
      )}
    </Panel>
  );
}

export function DaySummarySkeleton() {
  return (
    <Panel>
      <div role="status">
        <span className="sr-only">Loading the day's totals</span>
        <SkeletonBlock className="h-5 w-32" />
        <SkeletonBlock className="mt-4 h-10 w-40" />
        <SkeletonBlock className="mt-3 h-2 w-full" />
        <SkeletonBlock className="mt-2 h-3 w-2/3" />
        <div className={`mt-5 ${METER_GRID}`}>
          {[0, 1, 2].map(i => (
            <SkeletonBlock key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </Panel>
  );
}
