import { useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { keys, nonNeg, saveWater, type DashboardData } from "../api";

interface WaterJob {
  glasses: number;
  date: string;
  timezone: string;
}

interface WriterState {
  /** A save is running; later taps are coalesced into `pending`. */
  inFlight: boolean;
  /** Latest value the user asked for that hasn't been sent yet. */
  pending: WaterJob | null;
  /** Last value known to be on the server for the current burst of taps. */
  confirmed: number | null;
}

function withWater(data: DashboardData | undefined, glasses: number): DashboardData | undefined {
  return data ? { ...data, stats: { ...data.stats, water: glasses } } : data;
}

/**
 * Water +/- with an optimistic update on the day's dashboard cache.
 *
 * The endpoint stores an absolute count, so rapid taps are coalesced and sent
 * one at a time (never out of order). If a save fails, the count rolls back to
 * the last value the server confirmed and the user is told.
 */
export function useWaterControl(today: string, timezone: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const state = useRef<WriterState>({ inFlight: false, pending: null, confirmed: null });

  const flush = useCallback(async () => {
    const s = state.current;
    if (s.inFlight) return;
    s.inFlight = true;
    try {
      while (s.pending) {
        const job = s.pending;
        s.pending = null;
        try {
          await saveWater(job.glasses, job.date, job.timezone);
          s.confirmed = job.glasses;
        } catch {
          s.pending = null;
          const restored = s.confirmed;
          if (restored !== null) {
            queryClient.setQueryData<DashboardData>(keys.dashboard(job.date, job.timezone), old =>
              withWater(old, restored),
            );
          }
          toast({
            variant: "destructive",
            title: "Water not updated",
            description:
              restored !== null
                ? `That change didn't save, so your count is back to ${restored}. Try again.`
                : "That change didn't save. Try again.",
          });
          break;
        }
      }
    } finally {
      s.inFlight = false;
      s.confirmed = null;
      void queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
    }
  }, [queryClient, toast]);

  const change = useCallback(
    async (delta: 1 | -1) => {
      const key = keys.dashboard(today, timezone);
      // A refetch landing after the optimistic write would overwrite it.
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      const current = queryClient.getQueryData<DashboardData>(key);
      if (!current) return;
      const before = Math.round(nonNeg(current.stats?.water));
      const next = Math.max(0, before + delta);
      if (next === before) return;
      const s = state.current;
      if (s.confirmed === null) s.confirmed = before;
      queryClient.setQueryData<DashboardData>(key, old => withWater(old, next));
      s.pending = { glasses: next, date: today, timezone };
      void flush();
    },
    [queryClient, today, timezone, flush],
  );

  return {
    add: useCallback(() => void change(1), [change]),
    remove: useCallback(() => void change(-1), [change]),
  };
}
