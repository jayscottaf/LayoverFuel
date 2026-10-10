import { useId } from "react";
import { Minus, Plus } from "lucide-react";
import { Panel, SkeletonBlock } from "../primitives";

const roundButton =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-card text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

/** Hydration count for the day. No cap at the target; the floor is zero. */
export function WaterPanel({
  glasses,
  target,
  reason,
  isOffline,
  onAdd,
  onRemove,
}: {
  glasses: number;
  target: number;
  reason?: string | null;
  isOffline: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const titleId = useId();
  const pct = target > 0 ? Math.min(glasses / target, 1) : 0;
  const offlineHint = "Water can be updated when you're back online";
  const unit = target === 1 ? "glass" : "glasses";

  return (
    <Panel labelledBy={titleId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="text-base font-semibold">
            Water
          </h2>
          <p className="text-sm text-muted-foreground tabular" aria-live="polite">
            <span className="font-medium text-foreground">{glasses}</span> of {target} {unit}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRemove}
            disabled={isOffline || glasses <= 0}
            title={isOffline ? offlineHint : undefined}
            aria-label="Remove a glass of water"
            className={roundButton}
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onAdd}
            disabled={isOffline}
            title={isOffline ? offlineHint : undefined}
            aria-label="Add a glass of water"
            className={roundButton}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-track" aria-hidden="true">
        <div className="h-full rounded-full bg-primary/80 transition-[width] duration-500" style={{ width: `${pct * 100}%` }} />
      </div>
      {reason && <p className="mt-2 text-xs text-muted-foreground">{reason}</p>}
      {isOffline && <p className="mt-2 text-xs text-muted-foreground">{offlineHint}.</p>}
    </Panel>
  );
}

export function WaterSkeleton() {
  return (
    <Panel>
      <div aria-hidden="true" className="flex items-center justify-between gap-3">
        <div>
          <SkeletonBlock className="h-5 w-16" />
          <SkeletonBlock className="mt-1.5 h-4 w-24" />
        </div>
        <div className="flex gap-2">
          <SkeletonBlock className="h-11 w-11" />
          <SkeletonBlock className="h-11 w-11" />
        </div>
      </div>
    </Panel>
  );
}
