import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { NutritionDraft, NutritionLog } from "../api";
import { CaptureFlow } from "./capture-flow";

export type CaptureMode = "menu" | "photo" | "describe" | "barcode" | "manual" | "recent";

export interface CaptureRequest {
  /** Which step to open on. Defaults to "menu" (choose a capture method). */
  mode?: CaptureMode;
  /** Local YYYY-MM-DD the meal belongs to. Defaults to the user's local today. */
  date?: string;
  /** Pre-filled draft (e.g. logging a planned meal). Opens straight into review. */
  draft?: Partial<NutritionDraft>;
  /** Existing log to edit. Opens review in edit mode; saving PATCHes. */
  editLog?: NutritionLog;
}

interface CaptureContextValue {
  open: (req?: CaptureRequest) => void;
  close: () => void;
  isOpen: boolean;
}

const CaptureContext = createContext<CaptureContextValue>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

export function CaptureProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<CaptureRequest | null>(null);
  const [instance, setInstance] = useState(0);

  const open = useCallback((req: CaptureRequest = {}) => {
    setInstance(i => i + 1);
    setRequest(req);
  }, []);
  const close = useCallback(() => setRequest(null), []);

  const value = useMemo(() => ({ open, close, isOpen: request !== null }), [open, close, request]);

  return (
    <CaptureContext.Provider value={value}>
      {children}
      {request && <CaptureFlow key={instance} request={request} onClose={close} />}
    </CaptureContext.Provider>
  );
}

export const useCapture = () => useContext(CaptureContext);
