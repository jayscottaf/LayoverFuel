import { useId, useState } from "react";
import { Link } from "wouter";
import { ChevronRight, Plus, Utensils } from "lucide-react";
import { apiUrl } from "@/lib/queryClient";
import {
  MEAL_SLOT_LABELS,
  logDisplayName,
  logSlot,
  logSource,
  nonNeg,
  type NutritionLog,
} from "../api";
import { useCapture } from "../capture/capture-context";
import { MacroLine, Panel, SectionTitle, SkeletonBlock, SourceBadge } from "../primitives";
import { buttonSecondary, headerLink } from "./shared";

/** Server-relative photo paths need the API origin when client and server are deployed apart. */
function photoSrc(url: string): string {
  return url.startsWith("/") && !url.startsWith("//") ? apiUrl(url) : url;
}

function MealThumb({ photoUrl, name }: { photoUrl?: string | null; name: string }) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    return (
      <img
        src={photoSrc(photoUrl)}
        alt={`Photo of ${name}`}
        loading="lazy"
        onError={() => setBroken(true)}
        className="h-12 w-12 shrink-0 rounded-lg bg-muted object-cover"
      />
    );
  }
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
      <Utensils className="h-5 w-5" aria-hidden="true" />
    </span>
  );
}

function byTimeLogged(a: NutritionLog, b: NutritionLog): number {
  const at = a.createdAt ?? "";
  const bt = b.createdAt ?? "";
  return at.localeCompare(bt) || a.id - b.id;
}

function MealRow({ log }: { log: NutritionLog }) {
  const { open } = useCapture();
  const name = logDisplayName(log);
  const slot = logSlot(log);
  const source = logSource(log);
  const macros = {
    calories: nonNeg(log.calories),
    protein: nonNeg(log.protein),
    carbs: nonNeg(log.carbs),
    fat: nonNeg(log.fat),
  };
  return (
    // The whole row is the tap target: the button's ::after covers the row, so
    // the macro text can stay a <p> outside the button.
    <li className="relative flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-secondary/60 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
      <MealThumb photoUrl={log.photoUrl} name={name} />
      <div className="min-w-0 flex-1">
        {slot && <p className="text-xs text-muted-foreground">{MEAL_SLOT_LABELS[slot]}</p>}
        <button
          type="button"
          onClick={() => open({ editLog: log })}
          className="block w-full truncate text-left font-medium after:absolute after:inset-0 after:rounded-lg after:content-[''] focus-visible:outline-none"
        >
          <span className="sr-only">Edit </span>
          {name}
        </button>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
          <MacroLine m={macros} />
          {source && <SourceBadge source={source} />}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </li>
  );
}

/** Meals logged today; tapping one opens it for review and correction. */
export function EatenTodayPanel({ meals, today }: { meals: NutritionLog[]; today: string }) {
  const titleId = useId();
  const { open } = useCapture();
  const sorted = [...meals].sort(byTimeLogged);

  return (
    <Panel labelledBy={titleId}>
      <SectionTitle
        id={titleId}
        action={
          <Link href="/log" className={headerLink}>
            Full log
          </Link>
        }
      >
        Eaten today
      </SectionTitle>

      {sorted.length > 0 ? (
        <ul className="-mx-2 flex flex-col gap-1">
          {sorted.map(log => (
            <MealRow key={log.id} log={log} />
          ))}
        </ul>
      ) : (
        <div>
          <p className="font-medium">Nothing logged yet today</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Take a photo, describe it, scan a barcode or enter it yourself. You review everything before it's saved.
          </p>
          <button type="button" onClick={() => open({ date: today })} className={`${buttonSecondary} mt-3`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Log a meal
          </button>
        </div>
      )}
    </Panel>
  );
}

export function EatenTodaySkeleton() {
  return (
    <Panel>
      <div aria-hidden="true">
        <SkeletonBlock className="h-5 w-28" />
        <div className="mt-4 flex flex-col gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBlock className="h-12 w-12 shrink-0" />
              <div className="flex-1">
                <SkeletonBlock className="h-3 w-16" />
                <SkeletonBlock className="mt-1.5 h-4 w-2/3" />
                <SkeletonBlock className="mt-1.5 h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
