// Shared class names for the capture flow. Token colors only.

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-primary transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

/** Round icon-only button (header back/close, remove item). Always pair with aria-label. */
export const iconBtn =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

/** Square stepper button used by quantity controls. */
export const stepBtn =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40";

/**
 * Compact numeric input for dense rows (quantity, macros). Same look as the
 * shared inputClass but with tighter padding and no width, so callers set it.
 */
export const numberInputClass =
  "min-h-11 rounded-lg border border-input bg-background px-2 text-base tabular placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm";
