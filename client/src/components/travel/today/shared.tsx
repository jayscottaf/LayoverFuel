import { useSyncExternalStore } from "react";
import { LoaderCircle, RotateCw } from "lucide-react";

/** Secondary action button: bordered, card surface, 44px touch target. */
export const buttonSecondary =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Inline text link. Vertical padding on an inline element widens the tap area
 * without changing line layout.
 */
export const textLink =
  "py-3 text-sm font-medium text-primary underline-offset-4 hover:underline";

/**
 * Link placed in a flex row (e.g. a SectionTitle action). Negative margins keep
 * the row compact while the link keeps a 44px tap target.
 */
export const headerLink =
  "-my-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline";

/** Retry for a failed query. Shows progress while the refetch is running. */
export function RetryButton({
  onRetry,
  busy,
  label = "Retry",
}: {
  onRetry: () => void;
  busy: boolean;
  label?: string;
}) {
  return (
    <button type="button" onClick={onRetry} disabled={busy} className={buttonSecondary}>
      {busy ? (
        <>
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Retrying
        </>
      ) : (
        <>
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          {label}
        </>
      )}
    </button>
  );
}

/** Tailwind's md breakpoint, read synchronously so the first paint uses the right layout. */
const DESKTOP_QUERY = "(min-width: 768px)";

function subscribe(onChange: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function snapshot() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(DESKTOP_QUERY).matches
    : false;
}

export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
