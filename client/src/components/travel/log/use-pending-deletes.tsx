import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  deleteNutritionLog,
  keys,
  logDisplayName,
  refreshAfterNutritionChange,
  restoreNutritionLog,
  statusOf,
  type NutritionLog,
} from "../api";

/**
 * Delete with a real undo. DELETE soft-deletes on the server immediately; Undo
 * restores that same record, so nothing is re-created and nothing depends on
 * the screen staying mounted. The row hides while the request is in flight and
 * reappears if the delete fails.
 */
export function usePendingDeletes() {
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const setRowHidden = useCallback((id: number, value: boolean) => {
    if (!mounted.current) return;
    setHidden(prev => {
      if (prev.has(id) === value) return prev;
      const next = new Set(prev);
      if (value) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const restore = useCallback(
    async (log: NutritionLog) => {
      try {
        await restoreNutritionLog(log.id);
      } catch {
        toast({
          title: "Couldn't restore the meal",
          description: "Check your connection, then use Log again to add it back.",
          variant: "destructive",
        });
        return;
      }
      await refreshAfterNutritionChange(queryClient);
      toast({ title: "Meal restored", description: logDisplayName(log), duration: 2500 });
    },
    [queryClient],
  );

  const requestDelete = useCallback(
    async (log: NutritionLog, dayKey: string) => {
      setRowHidden(log.id, true);
      try {
        await deleteNutritionLog(log.id);
      } catch (error) {
        // 404: already gone (e.g. removed on another device) — treat as deleted.
        if (statusOf(error) !== 404) {
          setRowHidden(log.id, false);
          toast({
            title: "Couldn't delete the meal",
            description: navigator.onLine
              ? "It's still in your log. Try again in a moment."
              : "You're offline, so it's still in your log.",
            variant: "destructive",
            action: (
              <ToastAction altText="Retry deleting the meal" onClick={() => void requestDelete(log, dayKey)}>
                Retry
              </ToastAction>
            ),
          });
          return;
        }
      }
      queryClient.setQueryData<NutritionLog[]>(keys.nutritionDay(dayKey), old =>
        old ? old.filter(l => l.id !== log.id) : old,
      );
      await refreshAfterNutritionChange(queryClient);
      setRowHidden(log.id, false);
      toast({
        title: "Meal deleted",
        description: logDisplayName(log),
        duration: 8000,
        action: (
          <ToastAction altText="Undo delete" onClick={() => void restore(log)}>
            Undo
          </ToastAction>
        ),
      });
    },
    [queryClient, restore, setRowHidden],
  );

  return { hidden, requestDelete };
}
