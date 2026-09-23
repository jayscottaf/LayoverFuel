import { forwardRef, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft, CalendarDays, X } from "lucide-react";
import { iconBtn } from "./ui";

/**
 * Bottom sheet on phones, centered modal on md+. Radix gives focus trapping,
 * Esc handling and scroll locking; closing always goes through onRequestClose
 * so the flow can protect unsaved input.
 */
export const CaptureSheet = forwardRef<
  HTMLHeadingElement,
  {
    title: string;
    /** Which day the meal belongs to. Shown when `showDay`, otherwise announced only. */
    dayLine: string;
    showDay: boolean;
    onBack?: () => void;
    onRequestClose: () => void;
    onEscapeKeyDown?: (e: KeyboardEvent) => void;
    closeDisabled?: boolean;
    banner?: ReactNode;
    children: ReactNode;
  }
>(function CaptureSheet(
  { title, dayLine, showDay, onBack, onRequestClose, onEscapeKeyDown, closeDisabled, banner, children },
  titleRef,
) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={open => {
        if (!open) onRequestClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-background/80" />
        <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
          <DialogPrimitive.Content
            onEscapeKeyDown={onEscapeKeyDown}
            className="pointer-events-auto flex max-h-[92dvh] min-h-[50dvh] w-full flex-col overflow-hidden rounded-t-xl border bg-card text-foreground shadow-lg duration-200 focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 md:max-h-[85dvh] md:min-h-0 md:max-w-lg md:rounded-lg"
          >
            <header className="flex shrink-0 items-center gap-1 border-b px-2 py-1.5">
              {onBack ? (
                <button type="button" onClick={onBack} aria-label="Back" className={iconBtn}>
                  <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                </button>
              ) : (
                <span className="w-2 shrink-0" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1 py-1">
                <DialogPrimitive.Title
                  ref={titleRef}
                  tabIndex={-1}
                  className="truncate text-base font-semibold focus-visible:outline-none"
                >
                  {title}
                </DialogPrimitive.Title>
                <DialogPrimitive.Description
                  className={showDay ? "mt-0.5 flex items-center gap-1.5 text-xs font-medium text-highlight" : "sr-only"}
                >
                  {showDay && <CalendarDays className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  <span className="truncate">{dayLine}</span>
                </DialogPrimitive.Description>
              </div>
              <button
                type="button"
                onClick={onRequestClose}
                disabled={closeDisabled}
                aria-label="Close"
                className={iconBtn}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>
            {banner}
            {children}
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
});

/** The scrollable middle of a step. Adds safe-area padding when there is no footer. */
export function SheetBody({ children, hasFooter = false }: { children: ReactNode; hasFooter?: boolean }) {
  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-touch px-4 pt-4 md:px-6 md:pt-5 ${
        hasFooter ? "pb-4" : "pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-6"
      }`}
    >
      {children}
    </div>
  );
}

/** Sticky action area pinned under the scroll body. */
export function SheetFooter({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 space-y-3 border-t bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-4">
      {children}
    </div>
  );
}
