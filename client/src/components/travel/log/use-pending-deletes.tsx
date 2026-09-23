import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  deleteNutritionLog,
  keys,
  logDisplayName,
  refreshAfterNutritionChange,
  statusOf,
  type NutritionLog,
} from "../api";

/** How long a deleted meal can be restored before the delete is sent. */
export const UNDO_MS = 5000;

interface PendingDelete {
  log: NutritionLog;
  /** Day key of the list the row was shown in, for the optimistic cache update. */
  dayKey: string;
  timer: number;
  dismissToast: () => void;
}

/**
 * Delete with a real undo: the row hides immediately and a toast offers Undo
 * for UNDO_MS. Only then is DELETE sent. Pending deletes are committed when
 * the screen unmounts or the page is hidden. A failed delete restores the row
 * and offers Retry.
 */
export function usePendingDeletes() {
  const queryClient = useQueryClient();
  const [hidden, setHidden] = useState<ReadonlySet<number>>(() => new Set());
  const pendingRef = useRef(new Map<number, PendingDelete>());
  const mountedRef = useRef(false);

  const controller = useMemo(() => {
    const setRowHidden = (id: number, value: boolean) => {
      if (!mountedRef.current) return;
      setHidden(prev => {
        if (prev.has(id) === value) return prev;
        const next = new Set(prev);
        if (value) next.add(id);
        else next.delete(id);
        return next;
      });
    };

    const send = async (log: NutritionLog, dayKey: string): Promise<void> => {
      try {
        await deleteNutritionLog(log.id);
      } catch (error) {
        // 404 means it is already gone (e.g. deleted on another device): treat as done.
        if (statusOf(error) !== 404) {
          setRowHidden(log.id, false);
          toast({
            title: "Couldn't delete the meal",
            description:
              typeof navigator !== "undefined" && !navigator.onLine
                ? "You're offline, so it's still in your log."
                : "It's still in your log. Try again in a moment.",
            duration: 10_000,
            action: (
              <ToastAction altText="Retry deleting the meal" onClick={() => retry(log, dayKey)}>
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
    };

    // The user already confirmed this delete once, so a retry sends it immediately.
    function retry(log: NutritionLog, dayKey: string) {
      setRowHidden(log.id, true);
      void send(log, dayKey);
    }

    const commit = (id: number) => {
      const pending = pendingRef.current.get(id);
      if (!pending) return;
      pendingRef.current.delete(id);
      window.clearTimeout(pending.timer);
      pending.dismissToast();
      void send(pending.log, pending.dayKey);
    };

    const commitAll = () => {
      for (const id of Array.from(pendingRef.current.keys())) commit(id);
    };

    const undo = (id: number) => {
      const pending = pendingRef.current.get(id);
      if (!pending) return;
      pendingRef.current.delete(id);
      window.clearTimeout(pending.timer);
      setRowHidden(id, false);
      toast({ title: "Meal restored", duration: 2500 });
    };

    const request = (log: NutritionLog, dayKey: string) => {
      if (pendingRef.current.has(log.id)) return;
      // Only one toast shows at a time, so an earlier delete would lose its Undo: send it now.
      commitAll();
      setRowHidden(log.id, true);
      const handle = toast({
        title: "Meal deleted",
        description: logDisplayName(log),
        duration: UNDO_MS,
        action: (
          <ToastAction altText="Undo delete" onClick={() => undo(log.id)}>
            Undo
          </ToastAction>
        ),
      });
      const timer = window.setTimeout(() => commit(log.id), UNDO_MS);
      pendingRef.current.set(log.id, { log, dayKey, timer, dismissToast: handle.dismiss });
    };

    return { request, commitAll };
  }, [queryClient]);

  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") controller.commitAll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", controller.commitAll);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", controller.commitAll);
      // Leaving the screen ends the undo window: send what's pending.
      controller.commitAll();
    };
  }, [controller]);

  return { hidden, requestDelete: controller.request };
}
