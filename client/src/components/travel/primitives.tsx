import type { ReactNode } from "react";
import { Link } from "wouter";
import { AlertCircle, CircleUserRound, Loader2, WifiOff } from "lucide-react";
import type { Macros, NutritionSource } from "./api";
import { SOURCE_LABELS } from "./api";

export const fmtInt = (n: number) => Math.round(n).toLocaleString();
export const fmtG = (n: number) => `${Math.round(n)} g`;

/** Page scaffold: one scroll area per screen, consistent gutters and max width. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-touch">
      <div
        className={`mx-auto w-full px-4 pb-32 pt-4 md:px-8 md:pb-12 md:pt-8 ${
          wide ? "max-w-5xl" : "max-w-2xl"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm text-muted-foreground tabular">{eyebrow}</p>}
        <h1 className="mt-0.5 text-2xl font-semibold tracking-normal md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {actions}
        <Link
          href="/profile"
          aria-label="Profile and settings"
          className="flex h-10 w-10 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-foreground md:hidden"
        >
          <CircleUserRound className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

/** Unframed page section; only individual items and dialogs use card surfaces. */
export function Panel({
  children,
  className = "",
  as: Tag = "section",
  labelledBy,
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div" | "article";
  labelledBy?: string;
}) {
  return (
    <Tag aria-labelledby={labelledBy} className={`border-t py-5 ${className}`}>
      {children}
    </Tag>
  );
}

export function SectionTitle({
  id,
  children,
  action,
}: {
  id?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-base font-semibold">
        {children}
      </h2>
      {action}
    </div>
  );
}

/**
 * Remaining calories, stated neutrally. Negative remaining is shown as "over"
 * without alarm colors — the target itself never changes.
 */
export function CalorieSummary({
  consumed,
  target,
  basis = "Based on logged meals",
}: {
  consumed: number;
  target: number;
  basis?: string;
}) {
  const remaining = Math.round(target - consumed);
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const over = remaining < 0;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-4xl font-semibold tabular tracking-normal">
          {fmtInt(Math.abs(remaining))}
          <span className="ml-1.5 text-base font-normal text-muted-foreground">
            kcal {over ? "over target" : "left"}
          </span>
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-track"
        role="meter"
        aria-label="Calories eaten"
        aria-valuemin={0}
        aria-valuemax={Math.max(target, 1)}
        aria-valuenow={Math.round(consumed)}
      >
        <div
          className="h-full rounded-full bg-foreground/80 transition-[width] duration-500"
          style={{ width: `${pct * 100}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground tabular">
        {fmtInt(consumed)} eaten of {fmtInt(target)} kcal target · {basis}
      </p>
    </div>
  );
}

const MACRO_TONES = {
  protein: { bar: "bg-protein", text: "text-protein", label: "Protein" },
  carbs: { bar: "bg-carbs", text: "text-carbs", label: "Carbs" },
  fat: { bar: "bg-fat", text: "text-fat", label: "Fat" },
} as const;

export function MacroMeter({
  macro,
  consumed,
  target,
}: {
  macro: keyof typeof MACRO_TONES;
  consumed: number;
  target: number;
}) {
  const tone = MACRO_TONES[macro];
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const left = Math.round(target - consumed);
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-col items-start gap-0.5 text-sm">
        <span className="font-medium">{tone.label}</span>
        <span className="break-words text-xs tabular text-muted-foreground">
          {Math.round(consumed)}/{Math.round(target)} g
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-track"
        role="meter"
        aria-label={`${tone.label} eaten`}
        aria-valuemin={0}
        aria-valuemax={Math.max(target, 1)}
        aria-valuenow={Math.round(consumed)}
      >
        <div className={`h-full rounded-full ${tone.bar} transition-[width] duration-500`} style={{ width: `${pct * 100}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground tabular">
        {left >= 0 ? `${left} g left` : `${Math.abs(left)} g over`}
      </p>
    </div>
  );
}

export function MacroLine({ m, className = "" }: { m: Macros; className?: string }) {
  return (
    <p className={`text-xs text-muted-foreground tabular ${className}`}>
      <span className="text-foreground font-medium">{fmtInt(m.calories)} kcal</span>
      <span aria-hidden="true"> · </span>
      <span>P {Math.round(m.protein)}</span>
      <span aria-hidden="true"> · </span>
      <span>C {Math.round(m.carbs)}</span>
      <span aria-hidden="true"> · </span>
      <span>F {Math.round(m.fat)}</span>
    </p>
  );
}

const SOURCE_DOT: Record<NutritionSource, string> = {
  label: "bg-protein",
  database: "bg-protein",
  manual: "bg-fat",
  estimate: "bg-highlight",
};

export function SourceBadge({ source, className = "" }: { source: NutritionSource; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs text-muted-foreground ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${SOURCE_DOT[source]}`} aria-hidden="true" />
      {SOURCE_LABELS[source]}
    </span>
  );
}

export function StateMessage({
  tone = "neutral",
  title,
  body,
  action,
  icon,
}: {
  tone?: "neutral" | "error" | "offline";
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  const Icon = tone === "offline" ? WifiOff : AlertCircle;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-lg border p-4 ${
        tone === "error" ? "bg-danger-soft" : tone === "offline" ? "bg-warning-soft" : "bg-card"
      }`}
    >
      <span className="mt-0.5 text-muted-foreground">{icon ?? <Icon className="h-5 w-5" aria-hidden="true" />}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        {body && <div className="mt-0.5 text-sm text-muted-foreground">{body}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function InlineSpinner({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      {label}
    </span>
  );
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted ${className}`} aria-hidden="true" />;
}

/** Accessible single-choice control for small option sets. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className = "",
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex flex-wrap gap-1 rounded-lg bg-secondary p-1 ${className}`}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`min-h-9 flex-1 rounded-md px-3 text-sm transition-colors ${
              active ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Label + control stack with consistent spacing. */
export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-lg border border-input bg-background px-3 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";
