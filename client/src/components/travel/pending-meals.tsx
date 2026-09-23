import { useCallback, useEffect, useState } from "react";
import { CloudOff, RefreshCw, X } from "lucide-react";
import { cancelQueuedNutrition, getPendingItems, type QueueItem } from "@/lib/offline-queue";
import { useOffline } from "@/hooks/use-offline";
import { useToast } from "@/hooks/use-toast";
import { fmtInt } from "./primitives";

export interface PendingMeal {
  id: string;
  date: string;
  name: string;
  calories: number;
  status: QueueItem["status"];
  error?: string;
}

function toPendingMeal(item: QueueItem): PendingMeal | null {
  if (item.type !== "nutrition" || item.cancelled || item.status === "synced") return null;
  const d = item.data as Record<string, unknown>;
  const name =
    (typeof d.notes === "string" && d.notes.trim()) ||
    (typeof d.mealStyle === "string" && d.mealStyle) ||
    "Meal";
  return {
    id: item.id,
    date: typeof d.date === "string" ? d.date : "",
    name,
    calories: Number(d.calories) || 0,
    status: item.status,
    error: item.error,
  };
}

/** Meals saved on this device that the server has not confirmed yet (optionally for one day). */
export function usePendingMeals(date?: string) {
  const [meals, setMeals] = useState<PendingMeal[]>([]);

  const refresh = useCallback(async () => {
    try {
      const items = await getPendingItems();
      const list = items.map(toPendingMeal).filter((m): m is PendingMeal => m !== null);
      setMeals(date ? list.filter(m => m.date === date) : list);
    } catch {
      setMeals([]);
    }
  }, [date]);

  useEffect(() => {
    void refresh();
    const on = () => void refresh();
    window.addEventListener("nutrition-queue-changed", on);
    window.addEventListener("account-changed", on);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("nutrition-queue-changed", on);
      window.removeEventListener("account-changed", on);
      window.removeEventListener("online", on);
    };
  }, [refresh]);

  return { meals, refresh };
}

/**
 * Queued meals are shown apart from the day's totals: they are not counted as
 * eaten until the server confirms them.
 */
export function PendingMealsNotice({ date }: { date: string }) {
  const { meals } = usePendingMeals(date);
  const { isOffline, manualSync, syncStatus } = useOffline();
  const { toast } = useToast();
  if (!meals.length) return null;

  const failed = meals.some(m => m.status === "failed");

  const cancel = async (meal: PendingMeal) => {
    try {
      await cancelQueuedNutrition(meal.id);
      toast({ title: "Removed from this device", description: meal.name });
    } catch {
      toast({ title: "Couldn't remove it", description: "Try again in a moment.", variant: "destructive" });
    }
  };

  return (
    <section aria-labelledby={`pending-${date}`} className="rounded-xl border border-dashed bg-warning-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="min-w-0">
            <h2 id={`pending-${date}`} className="text-sm font-semibold">
              {meals.length === 1 ? "1 meal waiting to sync" : `${meals.length} meals waiting to sync`}
            </h2>
            <p className="text-xs text-muted-foreground">
              Saved on this device. Not counted in this day's totals until the server confirms it.
            </p>
          </div>
        </div>
        {!isOffline && (
          <button
            type="button"
            onClick={() => void manualSync()}
            disabled={syncStatus === "syncing"}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-foreground hover:bg-card disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${syncStatus === "syncing" ? "animate-spin" : ""}`} aria-hidden="true" />
            {failed ? "Retry" : "Sync now"}
          </button>
        )}
      </div>
      <ul className="mt-3 divide-y divide-border">
        {meals.map(meal => (
          <li key={meal.id} className="flex items-center justify-between gap-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{meal.name}</p>
              <p className="text-xs text-muted-foreground tabular">
                {fmtInt(meal.calories)} kcal ·{" "}
                {meal.status === "failed"
                  ? `Didn't sync${meal.error ? `: ${meal.error}` : ""}`
                  : meal.status === "syncing"
                    ? "Syncing"
                    : "Waiting for a connection"}
              </p>
            </div>
            {meal.status !== "syncing" && (
              <button
                type="button"
                onClick={() => void cancel(meal)}
                aria-label={`Remove ${meal.name} from this device`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-card hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
