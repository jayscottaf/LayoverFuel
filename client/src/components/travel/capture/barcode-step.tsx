import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { lookupBarcode, statusOf, type BarcodeProduct } from "../api";
import { Field, InlineSpinner, StateMessage, inputClass } from "../primitives";
import { SheetBody } from "./sheet";
import { btnPrimary, btnSecondary } from "./ui";

type CameraState = "starting" | "scanning" | "denied" | "unavailable";
type Lookup =
  | { status: "idle" }
  | { status: "looking"; code: string }
  | { status: "notFound"; code: string }
  | { status: "error"; code: string };

const RETAIL_FORMATS = [
  BarcodeFormat.EAN_13,
  BarcodeFormat.EAN_8,
  BarcodeFormat.UPC_A,
  BarcodeFormat.UPC_E,
  BarcodeFormat.CODE_128,
];

function makeReader() {
  const hints = new Map<DecodeHintType, unknown>();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, RETAIL_FORMATS);
  return new BrowserMultiFormatReader(hints);
}

function cameraErrorState(err: unknown): CameraState {
  const name = err && typeof err === "object" && "name" in err ? String((err as { name: unknown }).name) : "";
  return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError"
    ? "denied"
    : "unavailable";
}

export function BarcodeStep({
  offline,
  onProduct,
  onManual,
}: {
  offline: boolean;
  onProduct: (product: BarcodeProduct) => void;
  onManual: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<CameraState>("starting");
  const [scanKey, setScanKey] = useState(0);
  const [lookup, setLookup] = useState<Lookup>({ status: "idle" });
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);
  const lookupRun = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      lookupRun.current += 1;
    };
  }, []);

  const runLookup = async (code: string) => {
    const id = (lookupRun.current += 1);
    setLookup({ status: "looking", code });
    try {
      const product = await lookupBarcode(code);
      if (!mounted.current || id !== lookupRun.current) return;
      if (!product) {
        setLookup({ status: "notFound", code });
        return;
      }
      onProduct(product);
    } catch (e) {
      if (!mounted.current || id !== lookupRun.current) return;
      setLookup({ status: statusOf(e) === 404 ? "notFound" : "error", code });
    }
  };
  // The decoder callback is created once per camera session; always call the latest lookup.
  const lookupRef = useRef(runLookup);
  lookupRef.current = runLookup;

  const cameraWanted = !offline && lookup.status === "idle";
  const cameraBlocked = camera === "denied" || camera === "unavailable";

  // Camera session: runs only while this step is showing and nothing is being looked up.
  // Cleanup stops the stream on unmount, step change, or when a code is found.
  useEffect(() => {
    if (!cameraWanted) return;
    const video = videoRef.current;
    if (!video) return;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setCamera("unavailable");
      return;
    }
    let cancelled = false;
    let handled = false;
    let controls: IScannerControls | null = null;
    setCamera("starting");

    makeReader()
      .decodeFromVideoDevice(undefined, video, (result, _err, ctrl) => {
        if (cancelled || handled || !result) return;
        handled = true;
        ctrl.stop();
        void lookupRef.current(result.getText());
      })
      .then(c => {
        if (cancelled || handled) {
          c.stop();
          return;
        }
        controls = c;
        setCamera("scanning");
      })
      .catch(err => {
        if (!cancelled) setCamera(cameraErrorState(err));
      });

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // scanKey restarts the session on request; camera state changes must not.
  }, [cameraWanted, scanKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const retryCamera = () => {
    setCamera("starting");
    setLookup({ status: "idle" });
    setScanKey(k => k + 1);
  };

  const submitTyped = (e: FormEvent) => {
    e.preventDefault();
    const code = typed.replace(/\D/g, "");
    if (code.length < 6 || code.length > 14) {
      setTypedError("Enter the 8 to 14 digit number printed under the barcode.");
      return;
    }
    setTypedError(null);
    void runLookup(code);
  };

  if (offline) {
    return (
      <SheetBody>
        <StateMessage
          tone="offline"
          title="Barcode lookup needs a connection"
          body="Enter the meal from the package label for now. It saves on this device and syncs when you're back online."
          action={
            <button type="button" onClick={onManual} className={btnPrimary}>
              Enter manually
            </button>
          }
        />
      </SheetBody>
    );
  }

  const busy = lookup.status === "looking";

  return (
    <SheetBody>
      <div className="space-y-5">
        {lookup.status === "idle" && !cameraBlocked && (
          <div className="space-y-2">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border bg-muted">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                playsInline
                muted
                aria-label="Camera preview for barcode scanning"
              />
              <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-1/3 w-3/4 rounded-lg border-2 border-primary/80" />
              </div>
              {camera === "starting" && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                  <InlineSpinner label="Starting camera" />
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground" role="status">
              {camera === "scanning"
                ? "Hold the barcode inside the frame. It scans automatically."
                : "Your browser may ask for camera access."}
            </p>
          </div>
        )}

        {lookup.status === "idle" && camera === "denied" && (
          <StateMessage
            title="Camera access is off"
            body="To scan, allow camera access for this site in your browser settings. You can also type the barcode number below."
            action={
              <button type="button" onClick={retryCamera} className={btnSecondary}>
                Try the camera again
              </button>
            }
          />
        )}

        {lookup.status === "idle" && camera === "unavailable" && (
          <StateMessage
            title="Camera not available"
            body="This device or browser can't scan right now. Type the barcode number below instead."
            action={
              <button type="button" onClick={retryCamera} className={btnSecondary}>
                Try again
              </button>
            }
          />
        )}

        {busy && (
          <div className="rounded-xl border bg-background p-4">
            <InlineSpinner label={`Looking up ${lookup.code}`} />
            <p className="mt-1 text-xs text-muted-foreground">Checking the food database.</p>
          </div>
        )}

        {lookup.status === "notFound" && (
          <StateMessage
            title="No match for this barcode"
            body={
              <>
                <span className="tabular">{lookup.code}</span> isn't in the food database yet. You can enter it from the
                package label.
              </>
            }
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={onManual} className={btnPrimary}>
                  Enter manually
                </button>
                <button type="button" onClick={retryCamera} className={btnSecondary}>
                  Scan again
                </button>
              </div>
            }
          />
        )}

        {lookup.status === "error" && (
          <StateMessage
            tone="error"
            title="Couldn't look that up"
            body="Check your connection and try again, or enter the meal from the label."
            action={
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void runLookup(lookup.code)} className={btnPrimary}>
                  Retry
                </button>
                <button type="button" onClick={onManual} className={btnSecondary}>
                  Enter manually
                </button>
              </div>
            }
          />
        )}

        <form onSubmit={submitTyped} className="space-y-1.5" noValidate>
          <Field id="capture-barcode" label="Or type the barcode number">
            <div className="flex gap-2">
              <input
                id="capture-barcode"
                value={typed}
                onChange={e => {
                  setTyped(e.target.value);
                  if (typedError) setTypedError(null);
                }}
                inputMode="numeric"
                autoComplete="off"
                enterKeyHint="search"
                placeholder="e.g. 0123456789012"
                aria-invalid={typedError ? true : undefined}
                aria-describedby={typedError ? "capture-barcode-error" : undefined}
                className={`${inputClass} min-w-0 flex-1 tabular`}
              />
              <button type="submit" disabled={busy || !typed.trim()} className={btnSecondary}>
                Look up
              </button>
            </div>
          </Field>
          {typedError && (
            <p id="capture-barcode-error" role="alert" className="text-xs text-destructive">
              {typedError}
            </p>
          )}
        </form>

        <p className="text-xs text-muted-foreground">
          Product data comes from Open Food Facts, a crowd-sourced food database. You'll check it before saving.
        </p>
      </div>
    </SheetBody>
  );
}
