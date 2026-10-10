import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  PlanConflictError,
  statusOf,
  keys,
  saveTravelPlan,
  type PlanContext,
  type PlanMeal,
  type TravelPlan,
} from "../api";
import { cleanContext, normalizeContext } from "./plan-utils";

export type PlanBusy = { kind: "keep" | "remove" | "add" | "context"; mealId?: string } | null;

export type SaveOutcome = { ok: true; plan: TravelPlan } | { ok: false; conflict: boolean };

/**
 * Every plan write goes through one PUT with the loaded revision. One write at a
 * time, so the screen never races its own revision. A 409 reloads the plan and
 * says so; the caller keeps whatever the user had typed.
 */
export function usePlanMutations({
  date,
  timezone,
  refetch,
}: {
  date: string;
  timezone: string;
  refetch: () => Promise<unknown>;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState<PlanBusy>(null);
  const inFlight = useRef(false);

  const put = useCallback(
    async (
      change: { context?: PlanContext; meals?: (plan: TravelPlan) => PlanMeal[] },
      marker: NonNullable<PlanBusy>,
      failureTitle: string,
    ): Promise<SaveOutcome> => {
      // Always build on the plan currently on screen (the cached copy), never a stale closure.
      const plan = queryClient.getQueryData<TravelPlan>(keys.travelPlan(date, timezone));
      if (!plan || inFlight.current) return { ok: false, conflict: false };
      inFlight.current = true;
      setBusy(marker);
      try {
        const saved = await saveTravelPlan({
          date,
          timezone,
          revision: plan.revision,
          context: change.context ? cleanContext(change.context) : normalizeContext(plan.context),
          meals: change.meals ? change.meals(plan) : (plan.meals ?? []),
        });
        queryClient.setQueryData(keys.travelPlan(date, timezone), saved);
        return { ok: true, plan: saved };
      } catch (error) {
        if (error instanceof PlanConflictError) {
          await refetch().catch(() => undefined);
          toast({
            title: "Your plan changed elsewhere.",
            description: "It's been reloaded — review and save again.",
          });
          return { ok: false, conflict: true };
        }
        const offline = typeof navigator !== "undefined" && navigator.onLine === false;
        const rejected = statusOf(error) === 400;
        toast({
          variant: "destructive",
          title: failureTitle,
          description: offline
            ? "You're offline. Try again when you reconnect."
            : rejected
              ? "Some details weren't accepted. Keep meal windows under 120 characters and meal numbers at 0 or more."
              : "Nothing was changed. Please try again in a moment.",
        });
        return { ok: false, conflict: false };
      } finally {
        inFlight.current = false;
        setBusy(null);
      }
    },
    [queryClient, date, timezone, refetch, toast],
  );

  const setKept = useCallback(
    (meal: PlanMeal, kept: boolean) =>
      put(
        {
          meals: plan =>
            (plan.meals ?? []).map(m => (m.id === meal.id ? { ...m, status: kept ? "locked" : "planned" } : m)),
        },
        { kind: "keep", mealId: meal.id },
        "Couldn't update that meal",
      ),
    [put],
  );

  const addMeal = useCallback(
    async (meal: PlanMeal) => {
      const outcome = await put(
        { meals: plan => [...(plan.meals ?? []).filter(m => m.id !== meal.id), meal] },
        { kind: "add", mealId: meal.id },
        "Couldn't add that meal",
      );
      if (outcome.ok) toast({ title: "Fixed meal added", description: `${meal.name} is kept in your plan.` });
      return outcome;
    },
    [put, toast],
  );

  const removeMeal = useCallback(
    async (meal: PlanMeal) => {
      const outcome = await put(
        { meals: plan => (plan.meals ?? []).filter(m => m.id !== meal.id) },
        { kind: "remove", mealId: meal.id },
        "Couldn't remove that meal",
      );
      if (outcome.ok) {
        toast({
          title: "Fixed meal removed",
          description: meal.name,
          action: (
            <ToastAction
              altText={`Undo removing ${meal.name}`}
              onClick={() => {
                void put(
                  { meals: plan => [...(plan.meals ?? []).filter(m => m.id !== meal.id), meal] },
                  { kind: "add", mealId: meal.id },
                  "Couldn't put that meal back",
                );
              }}
            >
              Undo
            </ToastAction>
          ),
        });
      }
      return outcome;
    },
    [put, toast],
  );

  const saveContext = useCallback(
    async (context: PlanContext) => {
      const outcome = await put({ context }, { kind: "context" }, "Couldn't save your plan");
      if (outcome.ok) toast({ title: "Plan updated" });
      return outcome;
    },
    [put, toast],
  );

  return { busy, setKept, addMeal, removeMeal, saveContext };
}

export type PlanMutations = ReturnType<typeof usePlanMutations>;
