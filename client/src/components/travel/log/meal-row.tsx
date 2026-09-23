import { useState } from "react";
import { ChevronDown, CopyPlus, MapPin, Pencil, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/queryClient";
import { MEAL_CONTEXT_LABELS, logDisplayName, logSource, type NutritionItem, type NutritionLog } from "../api";
import { formatLocalTime, timeZoneAbbreviation } from "../local-date";
import { MacroLine, SourceBadge, fmtInt } from "../primitives";
import { isMealContextValue, isNutritionSource, logMacros } from "./log-again";
import { btnRowAction } from "./ui";

/** Server-relative photo paths need the API origin when client and server are deployed apart. */
function photoSrc(url: string): string {
  return url.startsWith("/") && !url.startsWith("//") ? apiUrl(url) : url;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * When the meal was logged, in the timezone it was logged in. If that differs
 * from where the user is now, the zone is named so "7:30 AM" isn't ambiguous.
 */
function loggedAt(log: NutritionLog, currentTimezone: string): { label: string; iso: string } | null {
  if (!log.createdAt) return null;
  const at = new Date(log.createdAt);
  if (Number.isNaN(at.getTime())) return null;
  const tz = log.timezone && isValidTimeZone(log.timezone) ? log.timezone : currentTimezone;
  const time = formatLocalTime(tz, at);
  return {
    label: tz === currentTimezone ? time : `${time} ${timeZoneAbbreviation(tz, at)}`,
    iso: at.toISOString(),
  };
}

const qtyFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

function quantityLabel(item: NutritionItem): string {
  const unit = typeof item.unit === "string" ? item.unit.trim() : "";
  const q = Number(item.quantity);
  if (Number.isFinite(q) && q > 0) return unit ? `${qtyFormat.format(q)} ${unit}` : qtyFormat.format(q);
  return unit;
}

function Thumb({ url, name }: { url: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    <img
      src={photoSrc(url)}
      alt={`Photo of ${name}`}
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-14 w-14 shrink-0 rounded-lg bg-muted object-cover"
    />
  );
}

function ItemsDisclosure({ items, mealName }: { items: NutritionItem[]; mealName: string }) {
  return (
    <details className="group mt-1">
      <summary className="-ml-2.5 inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-primary transition-colors hover:bg-secondary [&::-webkit-details-marker]:hidden">
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        {items.length} {items.length === 1 ? "item" : "items"}
        <span className="sr-only"> in {mealName}</span>
      </summary>
      <ul className="mt-1 divide-y rounded-lg bg-secondary/60 px-3">
        {items.map((item, index) => {
          const qty = quantityLabel(item);
          return (
            <li key={`${index}-${item.name}`} className="flex items-start justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="break-words text-sm">{item.name?.trim() || "Item"}</p>
                {qty && <p className="text-xs text-muted-foreground tabular">{qty}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <p className="text-sm tabular">{fmtInt(logMacros(item).calories)} kcal</p>
                {isNutritionSource(item.source) && <SourceBadge source={item.source} />}
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function MealRow({
  log,
  timezone,
  isOffline,
  offlineNoteId,
  onEdit,
  onLogAgain,
  onDelete,
}: {
  log: NutritionLog;
  timezone: string;
  isOffline: boolean;
  offlineNoteId: string;
  onEdit: (log: NutritionLog) => void;
  onLogAgain: (log: NutritionLog) => void;
  onDelete: (log: NutritionLog) => void;
}) {
  const name = logDisplayName(log);
  const source = logSource(log);
  const time = loggedAt(log, timezone);
  const context = isMealContextValue(log.context) ? MEAL_CONTEXT_LABELS[log.context] : null;
  const items = (log.items ?? []).filter(i => i && typeof i === "object");
  const needsConnection = isOffline
    ? { "aria-disabled": true as const, "aria-describedby": offlineNoteId }
    : {};

  return (
    <li className="py-4 first:pt-1 last:pb-0">
      <div className="flex gap-3">
        {log.photoUrl && <Thumb url={log.photoUrl} name={name} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 break-words font-medium leading-snug">
              {name}
            </h3>
            {time && (
              <time dateTime={time.iso} className="shrink-0 pt-0.5 text-xs text-muted-foreground tabular">
                {time.label}
              </time>
            )}
          </div>
          <MacroLine m={logMacros(log)} className="mt-1" />
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
            {source ? (
              <SourceBadge source={source} />
            ) : (
              <span className="text-xs text-muted-foreground">Source not recorded</span>
            )}
            {context && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" aria-hidden="true" />
                {context}
              </span>
            )}
          </div>
        </div>
      </div>

      {items.length > 0 && <ItemsDisclosure items={items} mealName={name} />}

      <div className="-ml-2.5 mt-1 flex flex-wrap items-center gap-1">
        <button
          type="button"
          {...needsConnection}
          onClick={() => !isOffline && onEdit(log)}
          className={`${btnRowAction} aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground`}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          Edit<span className="sr-only">: {name}</span>
        </button>
        <button type="button" onClick={() => onLogAgain(log)} className={btnRowAction}>
          <CopyPlus className="h-4 w-4" aria-hidden="true" />
          Log again<span className="sr-only"> today: {name}</span>
        </button>
        <button
          type="button"
          {...needsConnection}
          onClick={() => !isOffline && onDelete(log)}
          className={`${btnRowAction} hover:text-destructive aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete<span className="sr-only">: {name}</span>
        </button>
      </div>
    </li>
  );
}
