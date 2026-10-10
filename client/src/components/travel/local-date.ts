import { useEffect, useState } from "react";

// UI-side date helpers. If Codex ships getLocalDateString/getUserTimezone in
// client/src/lib, these can be swapped for those without changing callers.

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function getLocalDateString(at: Date = new Date(), timeZone: string = getUserTimezone()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(at);
    const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    const y = at.getFullYear();
    const m = String(at.getMonth() + 1).padStart(2, "0");
    const d = String(at.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

export function isDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toUtcNoon(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function shiftDate(date: string, days: number): string {
  const dt = toUtcNoon(date);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function formatLongDate(date: string): string {
  return toUtcNoon(date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatShortDate(date: string): string {
  return toUtcNoon(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function formatDayLabel(date: string, today: string): string {
  if (date === today) return "Today";
  if (date === shiftDate(today, -1)) return "Yesterday";
  if (date === shiftDate(today, 1)) return "Tomorrow";
  return formatShortDate(date);
}

export function formatLocalTime(timeZone: string, at: Date = new Date()): string {
  try {
    return at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
}

export function timeZoneAbbreviation(timeZone: string, at: Date = new Date()): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "short" })
      .formatToParts(at)
      .find(p => p.type === "timeZoneName");
    return part?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

export function localHour(timeZone: string, at: Date = new Date()): number {
  try {
    const h = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(at);
    return Number(h) % 24;
  } catch {
    return at.getHours();
  }
}

/**
 * The user's current local day and timezone. Re-evaluates every 30s and when
 * the tab becomes visible, so crossing midnight or a timezone updates the UI.
 */
export function useLocalDay(): { today: string; timezone: string; now: Date } {
  const compute = () => {
    const timezone = getUserTimezone();
    const now = new Date();
    return { timezone, today: getLocalDateString(now, timezone), now };
  };
  const [state, setState] = useState(compute);

  useEffect(() => {
    const tick = () =>
      setState(prev => {
        const next = compute();
        const minuteChanged = Math.floor(next.now.getTime() / 60000) !== Math.floor(prev.now.getTime() / 60000);
        return next.today !== prev.today || next.timezone !== prev.timezone || minuteChanged ? next : prev;
      });
    const id = window.setInterval(tick, 30_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return state;
}
