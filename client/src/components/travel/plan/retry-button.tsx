import { LoaderCircle, RotateCw } from "lucide-react";
import { btnSecondary } from "./ui";

/** Retry for a failed plan query. Shows progress while the refetch runs. */
export function RetryButton({ onRetry, busy, label = "Retry" }: { onRetry: () => void; busy: boolean; label?: string }) {
  return (
    <button
      type="button"
      aria-disabled={busy || undefined}
      onClick={() => {
        if (!busy) onRetry();
      }}
      className={btnSecondary}
    >
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
