// Class names shared by the Plan screen. Token colors only.
//
// Plan actions use aria-disabled (not the disabled attribute) for busy and
// read-only states so a focused button keeps focus when it becomes unavailable.
// Handlers must check the same condition before acting.

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-card";

/** Toggle button in its pressed state (e.g. a kept meal). */
export const btnSecondaryPressed =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-4 text-sm font-medium text-foreground transition-colors hover:bg-primary/15 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary/10";

/** Low-emphasis row action (Remove, Cancel, Discard changes). 44px tall. */
export const btnQuiet =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-muted-foreground";

/** Text-style button placed inline with copy; padding widens the tap area. */
export const btnLink =
  "inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:no-underline";

export const textareaClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-base md:text-sm placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y";

/** Compact numeric input (same look as inputClass, full width of its grid cell). */
export const numberInputClass =
  "w-full min-h-11 rounded-lg border border-input bg-background px-3 text-base tabular placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";
