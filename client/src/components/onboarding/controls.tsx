import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";

export const primaryButtonClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

export const textButtonClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50";

/** Inline validation message, announced when it appears. */
export function FieldError({ id, message }: { id: string; message: string | null }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

function SelectionMark({ selected, round }: { selected: boolean; round: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-5 w-5 shrink-0 items-center justify-center border ${round ? "rounded-full" : "rounded"} ${
        selected ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background"
      }`}
    >
      {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}

/**
 * Single-choice cards with radio semantics: one tab stop, arrow keys move the
 * selection, Space selects, Enter selects and asks the flow to continue.
 */
export function RadioCards<T extends string>({
  labelledBy,
  value,
  options,
  onChange,
  onEnter,
}: {
  labelledBy: string;
  value: T | "";
  options: Array<{ value: T; label: string; description: string }>;
  onChange: (v: T) => void;
  onEnter?: (v: T) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedIndex = options.findIndex(o => o.value === value);
  const tabIndexFor = (i: number) => (selectedIndex === -1 ? (i === 0 ? 0 : -1) : i === selectedIndex ? 0 : -1);

  const move = (to: number) => {
    const i = (to + options.length) % options.length;
    onChange(options[i].value);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowRight":
        e.preventDefault();
        move(i + 1);
        break;
      case "ArrowUp":
      case "ArrowLeft":
        e.preventDefault();
        move(i - 1);
        break;
      case "Home":
        e.preventDefault();
        move(0);
        break;
      case "End":
        e.preventDefault();
        move(options.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        onChange(options[i].value);
        onEnter?.(options[i].value);
        break;
    }
  };

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="grid gap-2">
      {options.map((o, i) => {
        const selected = o.value === value;
        const descId = `${labelledBy}-${o.value}-desc`;
        return (
          <button
            key={o.value}
            ref={el => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-describedby={descId}
            tabIndex={tabIndexFor(i)}
            onClick={() => onChange(o.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={`flex min-h-11 w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
              selected ? "border-primary bg-primary/5" : "bg-card hover:bg-secondary"
            }`}
          >
            <span className="mt-0.5">
              <SelectionMark selected={selected} round />
            </span>
            <span className="min-w-0">
              <span className={`block text-base ${selected ? "font-semibold" : "font-medium"}`}>{o.label}</span>
              <span id={descId} className="mt-0.5 block text-sm text-muted-foreground">
                {o.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Multi-select option shown as a button with toggle semantics (aria-pressed). */
export function ToggleOption({
  pressed,
  onToggle,
  children,
}: {
  pressed: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg border px-3 text-left text-sm transition-colors ${
        pressed ? "border-primary bg-primary/5 font-medium" : "bg-card hover:bg-secondary"
      }`}
    >
      <SelectionMark selected={pressed} round={false} />
      <span className="min-w-0">{children}</span>
    </button>
  );
}
