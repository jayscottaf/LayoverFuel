import { useEffect, useId, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { compareDates, formatDayLabel, formatLongDate, shiftDate } from "../local-date";
import { inputClass } from "../primitives";
import { btnIcon, btnSecondary } from "./ui";
import { MIN_LOG_DAY, isValidDay } from "./use-log-date";

/**
 * Day switcher for the food log: previous/next, a label for the selected day,
 * a native date picker for jumping, and a way back to today. Future days are
 * never offered.
 */
export function DateNav({
  date,
  today,
  onChange,
}: {
  date: string;
  today: string;
  onChange: (date: string) => void;
}) {
  const inputId = useId();
  const isToday = date === today;
  const atLatest = compareDates(date, today) >= 0;
  const atEarliest = compareDates(date, MIN_LOG_DAY) <= 0;

  // Local copy so typing a date digit by digit doesn't navigate on every keystroke.
  const [typed, setTyped] = useState(date);
  useEffect(() => setTyped(date), [date]);

  const onPick = (value: string) => {
    setTyped(value);
    if (isValidDay(value) && compareDates(value, MIN_LOG_DAY) >= 0 && compareDates(value, today) <= 0) {
      onChange(value);
    }
  };

  // Seven days ending today, or around the selected day when it is further back.
  const stripEnd = compareDates(date, shiftDate(today, -6)) >= 0 ? today
    : compareDates(shiftDate(date, 3), today) > 0 ? today : shiftDate(date, 3);
  const strip = Array.from({ length: 7 }, (_, i) => shiftDate(stripEnd, i - 6));
  const part = (day: string, options: Intl.DateTimeFormatOptions) =>
    new Date(`${day}T12:00:00Z`).toLocaleDateString(undefined, { ...options, timeZone: "UTC" });

  return (
    <div role="group" aria-label="Choose a day" className="flex flex-col gap-2 rounded-[22px] bg-card p-2 md:p-3">
      <div className="grid grid-cols-7 gap-1">
        {strip.map(day => {
          const selected = day === date;
          return (
            <button
              key={day}
              type="button"
              aria-pressed={selected}
              aria-label={`${formatLongDate(day)}${day === today ? ", today" : ""}`}
              onClick={() => onChange(day)}
              className={`flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[14px] transition-colors ${
                selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-secondary"
              }`}
            >
              <span className={`text-[11px] font-semibold uppercase ${selected ? "" : "text-muted-foreground"}`}>
                {part(day, { weekday: "short" })}
              </span>
              <span className="text-[17px] font-semibold tabular">{part(day, { day: "numeric" })}</span>
              <span className={`h-1 w-1 rounded-full ${day === today ? (selected ? "bg-primary-foreground" : "bg-primary") : "bg-transparent"}`} aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 border-t pt-2 md:flex-row md:items-center md:justify-between md:gap-6">
      <div className="flex items-center gap-2 md:min-w-[20rem]">
        <button
          type="button"
          aria-label="Previous day"
          disabled={atEarliest}
          onClick={() => onChange(shiftDate(date, -1))}
          className={btnIcon}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1 text-center" aria-live="polite" aria-atomic="true">
          <p className="truncate text-lg font-semibold tracking-normal">{formatDayLabel(date, today)}</p>
          <p className="truncate text-sm text-muted-foreground">{formatLongDate(date)}</p>
        </div>
        <button
          type="button"
          aria-label="Next day"
          disabled={atLatest}
          onClick={() => onChange(shiftDate(date, 1))}
          className={btnIcon}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-end gap-2 border-t px-2 pb-1 pt-3 md:border-t-0 md:p-0">
        <div className="min-w-0 flex-1 md:w-48 md:flex-none">
          <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
            Pick a date
          </label>
          <input
            id={inputId}
            type="date"
            min={MIN_LOG_DAY}
            max={today}
            value={typed}
            onChange={e => onPick(e.target.value)}
            onBlur={() => setTyped(date)}
            className={`${inputClass} mt-1 tabular`}
          />
        </div>
        {!isToday && (
          <button type="button" onClick={() => onChange(today)} className={btnSecondary}>
            Today
          </button>
        )}
      </div>
      </div>
    </div>
  );
}
