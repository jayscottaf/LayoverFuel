// Class names shared by the Log screen. Token colors only.

export const btnPrimary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

export const btnSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

/** Low-emphasis row action (Edit / Log again / Delete). Always visible, 44px tall. */
export const btnRowAction =
  "inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-muted-foreground";

/** Round icon-only button. Always pair with aria-label. */
export const btnIcon =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";
