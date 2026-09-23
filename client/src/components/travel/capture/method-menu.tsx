import { Camera, Keyboard, MessageSquareText, ScanBarcode, type LucideIcon } from "lucide-react";
import type { RecentMeal } from "../api";
import { RecentList } from "./recent-list";
import { SheetBody } from "./sheet";

export type CaptureMethod = "photo" | "describe" | "barcode" | "manual";

const METHODS: Array<{ mode: CaptureMethod; label: string; hint: string; Icon: LucideIcon; needsConnection: boolean }> = [
  { mode: "photo", label: "Photo", hint: "Estimate from a picture", Icon: Camera, needsConnection: true },
  { mode: "describe", label: "Describe it", hint: "Type what you ate", Icon: MessageSquareText, needsConnection: true },
  { mode: "barcode", label: "Barcode", hint: "Scan a packaged food", Icon: ScanBarcode, needsConnection: true },
  { mode: "manual", label: "Enter manually", hint: "Type in the numbers", Icon: Keyboard, needsConnection: false },
];

export function MethodMenu({
  today,
  offline,
  onMethod,
  onRecent,
  onSeeAllRecent,
}: {
  today: string;
  offline: boolean;
  onMethod: (mode: CaptureMethod) => void;
  onRecent: (meal: RecentMeal) => void;
  onSeeAllRecent: () => void;
}) {
  return (
    <SheetBody>
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="How do you want to log it?">
        {METHODS.map(({ mode, label, hint, Icon, needsConnection }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onMethod(mode)}
            className="flex min-h-16 items-start gap-3 rounded-xl border bg-background p-3 text-left transition-colors hover:bg-secondary"
          >
            <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{label}</span>
              <span className="block text-xs text-muted-foreground">
                {offline && needsConnection ? "Needs a connection" : hint}
              </span>
            </span>
          </button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">You'll review everything before it's saved.</p>
      <div className="mt-6">
        <RecentList
          today={today}
          offline={offline}
          limit={5}
          onPick={onRecent}
          onSeeAll={onSeeAllRecent}
          titleId="capture-recent-title"
          title="Recent"
        />
      </div>
    </SheetBody>
  );
}
