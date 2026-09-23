import { useEffect, useRef, useState, type ReactNode } from "react";
import { useOffline } from "@/hooks/use-offline";
import type { EstimateResponse } from "../api";
import { isDateKey, useLocalDay } from "../local-date";
import type { CaptureRequest } from "./capture-context";
import { BarcodeStep } from "./barcode-step";
import { DescribeStep } from "./describe-step";
import {
  dayPhrase,
  draftFromBarcode,
  draftFromEstimate,
  draftFromLog,
  draftFromPartial,
  draftFromPhoto,
  draftFromRecent,
  manualDraft,
  type DraftContext,
  type ReviewDraft,
} from "./draft";
import { MealReview } from "./meal-review";
import { MethodMenu } from "./method-menu";
import { PhotoStep, type PhotoState } from "./photo-step";
import { RecentList } from "./recent-list";
import { CaptureSheet, SheetBody } from "./sheet";
import { btnSecondary } from "./ui";
import { useSaveMeal } from "./use-save-meal";

type Step = "menu" | "photo" | "describe" | "barcode" | "recent" | "review";

const TITLES: Record<Exclude<Step, "review">, string> = {
  menu: "Log food",
  photo: "Estimate from a photo",
  describe: "Describe your meal",
  barcode: "Scan a barcode",
  recent: "Recent meals",
};

const validDate = (d: unknown): string | undefined => (typeof d === "string" && isDateKey(d) ? d : undefined);

function initialFlow(request: CaptureRequest, ctx: DraftContext): { history: Step[]; draft: ReviewDraft | null } {
  if (request.editLog) return { history: ["review"], draft: draftFromLog(request.editLog, ctx) };
  if (request.draft) return { history: ["review"], draft: draftFromPartial(request.draft, ctx) };
  const mode = request.mode ?? "menu";
  if (mode === "menu") return { history: ["menu"], draft: null };
  if (mode === "manual") return { history: ["menu", "review"], draft: manualDraft(ctx) };
  return { history: ["menu", mode], draft: null };
}

/**
 * The whole "log a meal" interaction. Every path (photo, describe, barcode,
 * manual, recent, plan, edit) ends in MealReview; nothing saves without an
 * explicit tap on Save.
 */
export function CaptureFlow({ request, onClose }: { request: CaptureRequest; onClose: () => void }) {
  const { today, timezone } = useLocalDay();
  const { isOffline } = useOffline();

  // The target day is fixed when the sheet opens, even if midnight passes while it's open.
  const [date] = useState(
    () => validDate(request.editLog?.date) ?? validDate(request.draft?.date) ?? validDate(request.date) ?? today,
  );
  const ctx: DraftContext = { date, timezone };
  const [init] = useState(() => initialFlow(request, ctx));
  const editLog = request.editLog;

  const [history, setHistory] = useState<Step[]>(init.history);
  const [draft, setDraft] = useState<ReviewDraft | null>(init.draft);
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState<"close" | "back" | null>(null);
  const [photo, setPhoto] = useState<PhotoState>({ preview: null, analysis: null });
  const [describeText, setDescribeText] = useState("");
  const [lastEstimate, setLastEstimate] = useState<{ description: string; response: EstimateResponse } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  const { saving, error, saveNew, saveEdit, clearError } = useSaveMeal({ timezone, today, onSaved: onClose });

  const top = history[history.length - 1];
  const step: Step = top === "review" && !draft ? "menu" : top;

  // When a step changes (or the discard prompt closes) and focus was lost with the
  // removed content, move it to the title so keyboard and screen reader users land in context.
  const lastStep = useRef(step);
  useEffect(() => {
    const stepChanged = lastStep.current !== step;
    lastStep.current = step;
    if (!stepChanged && confirm) return;
    const title = titleRef.current;
    const dialog = title?.closest('[role="dialog"]');
    const active = document.activeElement;
    if (!title || !dialog) return;
    if (!active || active === document.body || active === dialog || !dialog.contains(active)) title.focus();
  }, [step, confirm]);

  const push = (s: Step) => setHistory(h => [...h, s]);
  const replaceTop = (s: Step) => setHistory(h => [...h.slice(0, -1), s]);

  const openReview = (next: ReviewDraft) => {
    setDraft(next);
    setDirty(false);
    setConfirm(null);
    clearError();
    push("review");
  };

  const goBack = () => {
    setConfirm(null);
    if (step === "review") {
      setDraft(null);
      setDirty(false);
      clearError();
    }
    setHistory(h => (h.length > 1 ? h.slice(0, -1) : h));
  };

  // Input worth protecting from an accidental close (e.g. a stray tap on the backdrop).
  const unsaved =
    (step === "review" && (dirty || draft?.origin === "photo" || draft?.origin === "describe")) ||
    (step === "describe" && describeText.trim().length > 0);

  const back = () => {
    if (saving) return;
    if (step === "review" && dirty) setConfirm("back");
    else goBack();
  };

  const requestClose = () => {
    if (saving || confirm) return;
    if (unsaved) setConfirm("close");
    else onClose();
  };

  const discard = () => {
    const action = confirm;
    setConfirm(null);
    if (action === "close") onClose();
    else goBack();
  };

  const onReviewChange = (next: ReviewDraft) => {
    setDraft(next);
    setDirty(true);
  };

  const onSave = () => {
    if (!draft) return;
    if (editLog) void saveEdit(draft, editLog.id);
    else void saveNew(draft);
  };

  let content: ReactNode;
  switch (step) {
    case "menu":
      content = (
        <MethodMenu
          today={today}
          offline={isOffline}
          onMethod={mode => (mode === "manual" ? openReview(manualDraft(ctx)) : push(mode))}
          onRecent={meal => openReview(draftFromRecent(meal, ctx))}
          onSeeAllRecent={() => push("recent")}
        />
      );
      break;
    case "recent":
      content = (
        <SheetBody>
          <RecentList
            today={today}
            offline={isOffline}
            onPick={meal => openReview(draftFromRecent(meal, ctx))}
            titleId="capture-all-recent-title"
            title="Last 30 days"
          />
        </SheetBody>
      );
      break;
    case "photo":
      content = (
        <PhotoStep
          state={photo}
          onState={setPhoto}
          offline={isOffline}
          onAnalyzed={(analysis, preview) => openReview(draftFromPhoto(analysis, preview, ctx))}
          onDescribe={() => replaceTop("describe")}
          onManual={() => openReview(manualDraft(ctx))}
        />
      );
      break;
    case "describe":
      content = (
        <DescribeStep
          text={describeText}
          onText={setDescribeText}
          offline={isOffline}
          lastEstimate={lastEstimate}
          onEstimated={(description, response) => {
            setLastEstimate({ description, response });
            openReview(draftFromEstimate(description, response, ctx));
          }}
          onManual={name => openReview(manualDraft(ctx, name))}
        />
      );
      break;
    case "barcode":
      content = (
        <BarcodeStep
          offline={isOffline}
          onProduct={product => openReview(draftFromBarcode(product, ctx))}
          onManual={() => openReview(manualDraft(ctx))}
        />
      );
      break;
    case "review":
      content = draft && (
        <MealReview
          draft={draft}
          onChange={onReviewChange}
          mode={editLog ? "edit" : "new"}
          offline={isOffline}
          saving={saving}
          error={error}
          onSave={onSave}
        />
      );
      break;
  }

  const title = step === "review" ? (editLog ? "Edit meal" : "Review meal") : TITLES[step];
  const dayLine = editLog ? `Editing a meal from ${dayPhrase(date, today)}` : `Adding to ${dayPhrase(date, today)}`;

  const banner = confirm && (
    <div
      role="alertdialog"
      aria-labelledby="capture-discard-title"
      aria-describedby="capture-discard-body"
      className="shrink-0 border-b bg-warning-soft px-4 py-3 md:px-6"
    >
      <p id="capture-discard-title" className="text-sm font-medium">
        {editLog ? "Discard your changes?" : "Discard this meal?"}
      </p>
      <p id="capture-discard-body" className="text-sm text-muted-foreground">
        {editLog ? "The saved meal stays as it was." : "What you've entered hasn't been saved."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" autoFocus onClick={() => setConfirm(null)} className={btnSecondary}>
          Keep editing
        </button>
        <button
          type="button"
          onClick={discard}
          className="inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-destructive transition-colors hover:bg-danger-soft"
        >
          Discard
        </button>
      </div>
    </div>
  );

  return (
    <CaptureSheet
      ref={titleRef}
      title={title}
      dayLine={dayLine}
      showDay={date !== today}
      onBack={history.length > 1 ? back : undefined}
      onRequestClose={requestClose}
      onEscapeKeyDown={e => {
        if (confirm) {
          e.preventDefault();
          setConfirm(null);
        }
      }}
      closeDisabled={saving}
      banner={banner}
    >
      {content}
    </CaptureSheet>
  );
}
