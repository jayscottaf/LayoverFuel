import { LoaderCircle, RotateCw } from "lucide-react";
import { btnSecondary } from "./ui";

/** Retry for a failed query; shows progress while the refetch runs. */
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
    <button type="button" onClick={onRetry} disabled={busy} className={btnSecondary}>
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
