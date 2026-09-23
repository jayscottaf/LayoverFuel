import { useId } from "react";
import { Link } from "wouter";
import { History } from "lucide-react";
import type { TravelPlan } from "../api";
import { CalorieSummary, MacroMeter, Panel, SectionTitle, SkeletonBlock, fmtInt } from "../primitives";
import { planMacros } from "./plan-utils";

/**
 * What's left for the day, from the plan's fixed targets and logged meals.
 * Going past the target is stated neutrally; targets never move because of a meal.
 */
export function BudgetPanel({ plan, isToday }: { plan: TravelPlan; isToday: boolean }) {
  const titleId = useId();
  const targets = planMacros(plan.targets);
  const consumed = planMacros(plan.consumed);
  const hasMacroTargets = targets.protein > 0 || targets.carbs > 0 || targets.fat > 0;

  return (
    <Panel labelledBy={titleId}>
      <SectionTitle id={titleId}>{isToday ? "Left for today" : "Left for tomorrow"}</SectionTitle>

      {targets.calories > 0 ? (
        <CalorieSummary consumed={consumed.calories} target={targets.calories} basis="Based on logged meals" />
      ) : (
        <div>
          <p className="text-4xl font-semibold tabular tracking-normal">
            {fmtInt(consumed.calories)}
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

      {hasMacroTargets && (
        <div className="mt-5 grid grid-cols-3 gap-3">
          <MacroMeter macro="protein" consumed={consumed.protein} target={targets.protein} />
          <MacroMeter macro="carbs" consumed={consumed.carbs} target={targets.carbs} />
          <MacroMeter macro="fat" consumed={consumed.fat} target={targets.fat} />
        </div>
      )}

      <p className="mt-4 border-t pt-3 text-xs text-muted-foreground">
        Your daily targets stay the same. The meal ideas below follow what you've logged.
      </p>
    </Panel>
  );
}

/**
 * Why the plan looks different since the last visit. The live region is always
 * mounted (visually hidden when empty) so a new message is announced.
 */
export function WhatChanged({ message }: { message: string | null | undefined }) {
  const text = typeof message === "string" ? message.trim() : "";
  return (
    <div aria-live="polite" aria-atomic="true" className={text ? undefined : "sr-only"}>
      {text && (
        <div className="flex items-start gap-3 rounded-lg bg-secondary px-4 py-3">
          <History className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">What changed</p>
            <p className="mt-0.5 text-sm">{text}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function BudgetSkeleton() {
  return (
    <Panel>
      <SkeletonBlock className="h-5 w-28" />
      <SkeletonBlock className="mt-4 h-10 w-44" />
      <SkeletonBlock className="mt-3 h-2 w-full" />
      <SkeletonBlock className="mt-2 h-3 w-2/3" />
      <div className="mt-5 grid grid-cols-3 gap-3">
        {[0, 1, 2].map(i => (
          <div key={i}>
            <SkeletonBlock className="h-4 w-full" />
            <SkeletonBlock className="mt-2 h-1.5 w-full" />
          </div>
        ))}
      </div>
    </Panel>
  );
}
