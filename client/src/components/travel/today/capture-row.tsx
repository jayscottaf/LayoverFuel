import { useId } from "react";
import { Camera, PenLine, ScanBarcode, Type, type LucideIcon } from "lucide-react";
import { useCapture, type CaptureMode } from "../capture/capture-context";

const METHODS: Array<{ mode: CaptureMode; label: string; Icon: LucideIcon }> = [
  { mode: "photo", label: "Photo", Icon: Camera },
  { mode: "describe", label: "Describe", Icon: Type },
  { mode: "barcode", label: "Barcode", Icon: ScanBarcode },
  { mode: "manual", label: "Manual", Icon: PenLine },
];

/** Compact row of the four capture methods. Each opens a reviewable draft; nothing saves on its own. */
export function CaptureRow({ today }: { today: string }) {
  const { open } = useCapture();
  const titleId = useId();
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="sr-only">
        Log a meal
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {METHODS.map(({ mode, label, Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => open({ mode, date: today })}
            className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg border bg-card px-1 py-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary sm:text-sm lg:flex-row lg:gap-2 lg:px-3"
          >
            <Icon className="h-5 w-5 shrink-0 text-primary lg:h-4 lg:w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}
