import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { estimateNutrition, type EstimateResponse } from "../api";
import { Field, StateMessage, inputClass } from "../primitives";
import { SheetBody } from "./sheet";
import { btnPrimary, btnSecondary } from "./ui";

const MIN_LENGTH = 2;

export function DescribeStep({
  text,
  onText,
  offline,
  onEstimated,
  lastEstimate,
  onManual,
}: {
  /** Kept by the flow so the description survives going back from review. */
  text: string;
  onText: (t: string) => void;
  offline: boolean;
  onEstimated: (description: string, response: EstimateResponse) => void;
  /** Last successful estimate; reused without a new request while the text is unchanged. */
  lastEstimate: { description: string; response: EstimateResponse } | null;
  /** Switch to manual entry, using the description as the meal name. */
  onManual: (name: string) => void;
}) {
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const run = useRef(0);

  useEffect(() => {
    return () => {
      run.current += 1;
    };
  }, []);

  const description = text.trim();
  const loading = status === "loading";
  const reusable = lastEstimate && lastEstimate.description === description ? lastEstimate : null;
  const canEstimate = description.length >= MIN_LENGTH && !loading && (!offline || !!reusable);

  const submit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!canEstimate) return;
    if (reusable) {
      onEstimated(reusable.description, reusable.response);
      return;
    }
    const id = (run.current += 1);
    setStatus("loading");
    try {
      const response = await estimateNutrition(description);
      if (id !== run.current) return;
      setStatus("idle");
      onEstimated(description, response);
    } catch {
      if (id !== run.current) return;
      setStatus("error");
    }
  };

  return (
    <SheetBody>
      <form onSubmit={submit} className="space-y-4" aria-busy={loading}>
        <Field
          id="capture-describe"
          label="What did you eat?"
          hint="Include portions, sides and sauces if you know them. You'll review the estimate before anything is saved."
        >
          <textarea
            id="capture-describe"
            value={text}
            onChange={e => {
              onText(e.target.value);
              if (status === "error") setStatus("idle");
            }}
            onKeyDown={e => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void submit();
            }}
            rows={4}
            maxLength={600}
            autoFocus
            placeholder="e.g. Chicken burrito bowl, half rice, guac"
            className={`${inputClass} resize-y py-2.5 leading-relaxed`}
          />
        </Field>

        {offline && !reusable && (
          <StateMessage
            tone="offline"
            title="Estimates need a connection"
            body="You can still enter this meal yourself now. What you typed becomes the meal name."
            action={
              <button type="button" onClick={() => onManual(description)} className={btnPrimary}>
                Enter manually
              </button>
            }
          />
        )}

        {!offline && status === "error" && (
          <StateMessage
            tone="error"
            title="Couldn't get an estimate"
            body="Your description is still here. Try again, or enter the numbers yourself."
            action={
              <div className="flex flex-wrap gap-2">
                <button type="submit" className={btnPrimary}>
                  Try again
                </button>
                <button type="button" onClick={() => onManual(description)} className={btnSecondary}>
                  Enter manually
                </button>
              </div>
            }
          />
        )}

        {(reusable || (!offline && status !== "error")) && (
          <button type="submit" disabled={!canEstimate} className={`${btnPrimary} w-full`}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Estimating
              </>
            ) : reusable ? (
              "Review estimate"
            ) : (
              "Estimate"
            )}
          </button>
        )}
        {loading && (
          <p role="status" className="sr-only">
            Estimating nutrition for your meal
          </p>
        )}
      </form>
    </SheetBody>
  );
}
