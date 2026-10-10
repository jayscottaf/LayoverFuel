import { isDateKey } from "@shared/dates";
import type { HealthLog } from "@shared/schema";

export interface WeightEntry {
  date: string;
  weight: number;
}

export function validWeightEntries(data: readonly WeightEntry[]): WeightEntry[] {
  return data
    .filter(entry => isDateKey(entry.date) && Number.isFinite(entry.weight) && entry.weight > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function weightHistoryFromHealthLogs(logs: readonly Pick<HealthLog, "date" | "weight">[]): WeightEntry[] {
  // A health entry can record other metrics without recording a weigh-in.
  return validWeightEntries(logs.flatMap(log =>
    typeof log.weight === "number" && Number.isFinite(log.weight) && log.weight > 0
      ? [{ date: log.date, weight: log.weight * 2.20462 }]
      : []
  ));
}

export function weightAxisDomain(data: readonly WeightEntry[], goalWeight?: number): [number, number] {
  const weights = validWeightEntries(data).map(entry => entry.weight);
  if (goalWeight !== undefined && Number.isFinite(goalWeight) && goalWeight > 0) weights.push(goalWeight);
  if (weights.length === 0) return [150, 200];
  return [Math.max(0, Math.min(...weights) - 5), Math.max(...weights) + 5];
}
