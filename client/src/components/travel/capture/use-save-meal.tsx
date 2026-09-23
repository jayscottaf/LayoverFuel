import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { saveNutrition, undoNutrition } from "@/lib/nutrition";
import {
  draftToPayload,
  nonNeg,
  patchNutritionLog,
  refreshAfterNutritionChange,
  round1,
  statusOf,
  sumMacros,
} from "../api";
import { fmtInt } from "../primitives";
import { cleanItems, dayPhrase, type ReviewDraft } from "./draft";

type SaveResult = Awaited<ReturnType<typeof saveNutrition>>;

function saveErrorMessage(error: unknown): string {
  const status = statusOf(error);
  if (status === 400 || status === 422) return "Some values weren't accepted. Check the numbers and try again.";
  if (status === 401) return "You've been signed out. Sign in again, then retry — your entries are still here.";
  if (status === 404) return "This meal no longer exists. It may have been deleted on another device.";
  return "Your entries are still here. Check your connection and try again.";
}

/**
 * Save (new) or update (edit) a reviewed draft. On failure the caller keeps the
 * sheet open with the draft intact; retries reuse the draft's clientRequestId.
 */
export function useSaveMeal({
  timezone,
  today,
  onSaved,
}: {
  timezone: string;
  today: string;
  onSaved: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const undo = useCallback(
    async (result: SaveResult) => {
      try {
        await undoNutrition(result);
      } catch {
        toast({
          title: "Couldn't remove that meal",
          description: "It's still saved. You can delete it from the Log.",
        });
        return;
      }
      await refreshAfterNutritionChange(queryClient);
      toast({ title: "Removed" });
    },
    [queryClient, toast],
  );

  const run = useCallback(
    async (task: () => Promise<void>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      setError(null);
      try {
        await task();
      } catch (e) {
        if (mounted.current) setError(saveErrorMessage(e));
      } finally {
        inFlight.current = false;
        if (mounted.current) setSaving(false);
      }
    },
    [],
  );

  const saveNew = useCallback(
    (draft: ReviewDraft) =>
      run(async () => {
        const payload = draftToPayload(draft, timezone);
        const result = await saveNutrition(payload);
        void refreshAfterNutritionChange(queryClient);
        onSaved();
        const summary = `${payload.notes ?? "Meal"} · ${fmtInt(payload.calories)} kcal`;
        toast({
          title: result.queued ? "Saved on this device" : `Saved to ${dayPhrase(draft.date, today)}`,
          description: result.queued ? "It will sync when you're back online." : summary,
          action: (
            <ToastAction altText="Undo saving this meal" onClick={() => void undo(result)}>
              Undo
            </ToastAction>
          ),
        });
      }),
    [run, timezone, queryClient, onSaved, toast, today, undo],
  );

  const saveEdit = useCallback(
    (draft: ReviewDraft, logId: number) =>
      run(async () => {
        const items = cleanItems(draft.items);
        const totals = sumMacros(items);
        await patchNutritionLog(logId, {
          mealStyle: draft.mealStyle,
          notes: draft.name.trim() || null,
          context: draft.context ?? null,
          calories: Math.round(nonNeg(totals.calories)),
          protein: round1(nonNeg(totals.protein)),
          carbs: round1(nonNeg(totals.carbs)),
          fat: round1(nonNeg(totals.fat)),
          items,
        });
        void refreshAfterNutritionChange(queryClient);
        onSaved();
        toast({ title: "Meal updated" });
      }),
    [run, queryClient, onSaved, toast],
  );

  const clearError = useCallback(() => setError(null), []);

  return { saving, error, saveNew, saveEdit, clearError };
}
