import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/ui/image-upload";
import { MealCamera } from "@/components/ui/meal-camera";
import { analyzeMealPhoto, type PhotoAnalysis } from "../api";
import { StateMessage } from "../primitives";
import { SheetBody } from "./sheet";
import { btnPrimary, btnSecondary } from "./ui";

/** Kept by the flow so going back from review doesn't lose the photo or re-run analysis. */
export interface PhotoState {
  preview: string | null;
  analysis: PhotoAnalysis | null;
}

export function PhotoStep({
  state,
  onState,
  offline,
  onAnalyzed,
  onDescribe,
  onManual,
}: {
  state: PhotoState;
  onState: (s: PhotoState) => void;
  offline: boolean;
  onAnalyzed: (analysis: PhotoAnalysis, preview: string) => void;
  onDescribe: () => void;
  onManual: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "analyzing" | "error">("idle");
  const run = useRef(0);
  const request = useRef<AbortController | null>(null);

  // Ignore results that land after the user has left this step.
  useEffect(() => {
    return () => {
      run.current += 1;
      request.current?.abort();
    };
  }, []);

  const analyze = async (preview: string) => {
    const id = (run.current += 1);
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60_000);
    setStatus("analyzing");
    try {
      const analysis = await analyzeMealPhoto(preview, controller.signal);
      if (id !== run.current) return;
      setStatus("idle");
      onState({ preview, analysis });
      onAnalyzed(analysis, preview);
    } catch {
      if (id !== run.current) return;
      setStatus("error");
    } finally {
      clearTimeout(timeout);
    }
  };

  const selectPreview = (preview: string) => {
    onState({ preview, analysis: null });
    if (!offline) void analyze(preview);
    else setStatus("idle");
  };
  const onImageSelect = (_file: File, preview: string) => selectPreview(preview);

  const { preview, analysis } = state;
  const analyzing = status === "analyzing";

  if (!preview) {
    return (
      <SheetBody>
        {offline ? (
          <StateMessage
            tone="offline"
            title="Photo estimates need a connection"
            body="You can still log this meal now by entering it yourself, or type a description and estimate it once you're back online."
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onManual} className={btnPrimary}>
                  Enter manually
                </button>
                <button type="button" onClick={onDescribe} className={btnSecondary}>
                  Describe it
                </button>
              </div>
            }
          />
        ) : (
          <MealCamera onCapture={selectPreview} onImageSelect={onImageSelect} />
        )}
      </SheetBody>
    );
  }

  return (
    <SheetBody>
      <div className="space-y-4">
        <img
          src={preview}
          alt="Your meal photo"
          className="max-h-72 w-full rounded-lg border bg-muted object-cover"
        />

        {analyzing && (
          <div role="status" className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Check className="h-4 w-4 text-primary" aria-hidden="true" />
              Photo prepared
            </p>
            <p className="flex items-center gap-2 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Estimating nutrition from your photo
            </p>
            <p className="text-xs text-muted-foreground">Usually takes a few seconds.</p>
          </div>
        )}

        {!analyzing && status === "error" && !offline && (
          <StateMessage
            tone="error"
            title="Couldn't estimate this photo"
            body="Your photo is still here. Try again, or log the meal another way."
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void analyze(preview)} className={btnPrimary}>
                  Try again
                </button>
                <button type="button" onClick={onDescribe} className={btnSecondary}>
                  Describe instead
                </button>
              </div>
            }
          />
        )}

        {!analyzing && offline && !analysis && (
          <StateMessage
            tone="offline"
            title="You're offline"
            body="Photo estimates need a connection. Your photo stays here while this sheet is open, or you can enter the meal yourself."
            action={
              <button type="button" onClick={onManual} className={btnPrimary}>
                Enter manually
              </button>
            }
          />
        )}

        {!analyzing && status !== "error" && (analysis || !offline) && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {analysis ? (
              <button type="button" onClick={() => onAnalyzed(analysis, preview)} className={`${btnPrimary} flex-1`}>
                Review estimate
              </button>
            ) : (
              <button type="button" onClick={() => void analyze(preview)} className={`${btnPrimary} flex-1`}>
                Estimate this photo
              </button>
            )}
          </div>
        )}

        {!analyzing && (
          <ImageUpload onImageSelect={onImageSelect} className={`${btnSecondary} w-full`}>
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            Use a different photo
          </ImageUpload>
        )}
      </div>
    </SheetBody>
  );
}
