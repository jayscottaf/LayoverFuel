import { useId } from "react";
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  logSlot,
  sumMacros,
  type MealSlot,
  type NutritionLog,
} from "../api";
import { Panel, SectionTitle, SkeletonBlock, fmtInt } from "../primitives";
import { logMacros } from "./log-again";
import { MealRow } from "./meal-row";

export type MealGroupKey = MealSlot | "other";

export interface MealGroup {
  key: MealGroupKey;
  label: string;
  logs: NutritionLog[];
  calories: number;
}

function createdMs(log: NutritionLog): number | null {
  if (!log.createdAt) return null;
  const ms = Date.parse(log.createdAt);
  return Number.isNaN(ms) ? null : ms;
}

/** Order logged: by createdAt when both rows have one, else by id. */
export function byLoggedOrder(a: NutritionLog, b: NutritionLog): number {
  const at = createdMs(a);
  const bt = createdMs(b);
  if (at !== null && bt !== null && at !== bt) return at - bt;
  return a.id - b.id;
}

/** Breakfast, Lunch, Dinner, Snack, then Other (legacy rows without a slot). Empty groups are dropped. */
export function groupLogs(logs: NutritionLog[]): MealGroup[] {
  const buckets = new Map<MealGroupKey, NutritionLog[]>();
  for (const log of logs) {
    const key: MealGroupKey = logSlot(log) ?? "other";
    const list = buckets.get(key);
    if (list) list.push(log);
    else buckets.set(key, [log]);
  }
  const order: MealGroupKey[] = [...MEAL_SLOTS, "other"];
  return order
    .filter(key => buckets.has(key))
    .map(key => {
      const rows = [...(buckets.get(key) ?? [])].sort(byLoggedOrder);
      return {
        key,
        label: key === "other" ? "Other" : MEAL_SLOT_LABELS[key],
        logs: rows,
        calories: sumMacros(rows.map(logMacros)).calories,
      };
    });
}

function GroupPanel({
  group,
  timezone,
  isOffline,
  offlineNoteId,
  onEdit,
  onLogAgain,
  onDelete,
}: {
  group: MealGroup;
  timezone: string;
  isOffline: boolean;
  offlineNoteId: string;
  onEdit: (log: NutritionLog) => void;
  onLogAgain: (log: NutritionLog) => void;
  onDelete: (log: NutritionLog) => void;
}) {
  const titleId = useId();
  return (
    <Panel labelledBy={titleId}>
      <SectionTitle
        id={titleId}
        action={
          <span className="text-sm text-muted-foreground tabular">
            <span className="sr-only">Subtotal </span>
            {fmtInt(group.calories)} kcal
          </span>
        }
      >
        {group.label}
      </SectionTitle>
      <ul className="divide-y">
        {group.logs.map(log => (
          <MealRow
            key={log.id}
            log={log}
            timezone={timezone}
            isOffline={isOffline}
            offlineNoteId={offlineNoteId}
            onEdit={onEdit}
            onLogAgain={onLogAgain}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </Panel>
  );
}

export function MealGroups({
  logs,
  ...rowProps
}: {
  logs: NutritionLog[];
  timezone: string;
  isOffline: boolean;
  offlineNoteId: string;
  onEdit: (log: NutritionLog) => void;
  onLogAgain: (log: NutritionLog) => void;
  onDelete: (log: NutritionLog) => void;
}) {
  return (
    <>
      {groupLogs(logs).map(group => (
        <GroupPanel key={group.key} group={group} {...rowProps} />
      ))}
    </>
  );
}

export function MealGroupsSkeleton() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">Loading meals</span>
      {[2, 1].map((rows, g) => (
        <Panel key={g}>
          <div className="flex items-center justify-between">
            <SkeletonBlock className="h-5 w-24" />
            <SkeletonBlock className="h-4 w-16" />
          </div>
          <div className="mt-4 flex flex-col gap-5">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i}>
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="mt-2 h-3 w-1/2" />
                <SkeletonBlock className="mt-2 h-3 w-24" />
                <div className="mt-3 flex gap-2">
                  <SkeletonBlock className="h-8 w-16" />
                  <SkeletonBlock className="h-8 w-24" />
                  <SkeletonBlock className="h-8 w-20" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}
