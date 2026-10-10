import { z } from "zod";

export function isDateKey(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const dateKeySchema = z.string().refine(isDateKey, "Use a valid YYYY-MM-DD date");
export const timezoneSchema = z.string().max(100).refine(value => {
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; }
  catch { return false; }
}, "Use an IANA timezone");

export function localDateKey(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezoneSchema.parse(timezone), year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

// Date-only values are calendar labels, never converted through the server's timezone.
export function dateKeyToDate(value: string): Date {
  return new Date(`${dateKeySchema.parse(value)}T12:00:00Z`);
}

export function shiftDateKey(value: string, days: number): string {
  const date = dateKeyToDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
