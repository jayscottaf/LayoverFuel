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

  return (
    <div
      role="group"
      aria-label="Choose a day"
      className="flex flex-col gap-2 rounded-lg border bg-card p-2 md:flex-row md:items-center md:justify-between md:gap-6 md:p-3"
    >
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
  );
}
