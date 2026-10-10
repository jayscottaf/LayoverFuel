import { useCallback, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { compareDates, isDateKey, shiftDate } from "../local-date";

/** A real calendar day in YYYY-MM-DD form (rejects shapes like 2026-02-31). */
export function isValidDay(value: string | null | undefined): value is string {
  return typeof value === "string" && isDateKey(value) && shiftDate(value, 0) === value;
}

/** Earliest selectable day. Also keeps half-typed years (e.g. 0202) in the picker from navigating. */
export const MIN_LOG_DAY = "2000-01-01";

/** Any valid day from MIN_LOG_DAY to today; future days clamp to today; anything else falls back to today. */
export function resolveLogDate(raw: string | null | undefined, today: string): string {
  if (!isValidDay(raw) || compareDates(raw, MIN_LOG_DAY) < 0) return today;
  return compareDates(raw, today) > 0 ? today : raw;
}

/**
 * The Log screen's selected day, stored in the URL (?date=YYYY-MM-DD) so deep
 * links and the back button work. Today is the default and carries no param,
 * so an open Log tab follows the user across midnight and timezones.
 */
export function useLogDate(today: string) {
  const search = useSearch();
  const [path, navigate] = useLocation();
  const raw = new URLSearchParams(search).get("date");
  const date = resolveLogDate(raw, today);

  const setDate = useCallback(
    (next: string) => {
      const target = resolveLogDate(next, today);
      const params = new URLSearchParams(search);
      if (target === today) params.delete("date");
      else params.set("date", target);
      const qs = params.toString();
      navigate(qs ? `${path}?${qs}` : path, { replace: true });
    },
    [search, path, navigate, today],
  );

  // Rewrite invalid or future values so the address bar matches the day shown.
  useEffect(() => {
    if (raw !== null && raw !== date) setDate(date);
  }, [raw, date, setDate]);

  return { date, setDate, isToday: date === today };
}
