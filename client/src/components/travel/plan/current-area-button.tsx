import { useEffect, useRef, useState } from "react";
import { Loader2, LocateFixed, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btnPrimary, btnQuiet, btnSecondary } from "./ui";

export function areaFromGeocode(data: unknown): string {
  if (!data || typeof data !== "object") throw new Error("Your area could not be identified. Enter a city instead.");
  const record = data as Record<string, unknown>;
  const read = (key: string) => typeof record[key] === "string" ? String(record[key]).trim().slice(0, 60) : "";
  if (read("lookupSource") !== "coordinates" && read("lookupSource") !== "reverseGeocoding") {
    throw new Error("The location service could not confirm your device location. Enter a city instead.");
  }
  if (!read("city") && !read("locality")) throw new Error("No city was found. Enter an area instead.");
  return [...new Set([read("locality"), read("city"), read("principalSubdivision"), read("countryName")].filter(Boolean))].join(", ").slice(0, 160);
}

export function CurrentAreaButton({ onFound, disabled, onBusyChange }: {
  onFound: (area: string) => void; disabled?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const callbacks = useRef({ onFound, onBusyChange });
  callbacks.current = { onFound, onBusyChange };
  const cancel = () => {
    controller.current?.abort(); controller.current = null;
    clearTimeout(timer.current); setBusy(false); callbacks.current.onBusyChange?.(false);
  };
  useEffect(() => () => { controller.current?.abort(); controller.current = null; clearTimeout(timer.current); }, []);

  const locate = () => {
    if (disabled) { setConsent(false); return; }
    setConsent(false); setError(""); setBusy(true); callbacks.current.onBusyChange?.(true);
    const request = new AbortController(); controller.current = request;
    const fail = (message: string) => {
      if (controller.current !== request) return;
      cancel(); setError(message);
    };
    timer.current = setTimeout(() => fail("Finding your area took too long. Enter a city or try again."), 25_000);
    try {
      if (!navigator.geolocation) { fail("Location is unavailable in this browser. Enter a city instead."); return; }
      navigator.geolocation.getCurrentPosition(async position => {
        if (controller.current !== request) return;
        try {
          const { latitude, longitude } = position.coords;
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Invalid device location. Enter a city instead.");
          const query = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), localityLanguage: "en" });
          const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`, {
            signal: request.signal, credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer",
          });
          if (!response.ok) throw new Error("The area lookup is unavailable. Enter a city instead.");
          const area = areaFromGeocode(await response.json());
          if (controller.current !== request) return;
          cancel(); callbacks.current.onFound(area);
        } catch (failure) { fail(failure instanceof Error ? failure.message : "Area lookup failed. Enter a city instead."); }
      }, failure => fail(failure.code === 1
        ? "Location permission was denied. Enter a city, or allow location in your browser settings."
        : "Your device could not find its location. Enter a city or try again."),
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 0 });
    } catch { fail("Location is unavailable. Enter a city instead."); }
  };
  return <>
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={btnSecondary} disabled={disabled || busy} onClick={() => setConsent(true)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />} {busy ? "Finding your area" : "Use current location"}
      </button>
      {busy && <button type="button" className={btnQuiet} onClick={cancel}><X className="h-4 w-4" />Cancel</button>}
    </div>
    {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
    <Dialog open={consent} onOpenChange={setConsent}>
      <DialogContent><DialogHeader><DialogTitle>Use your current area?</DialogTitle>
        <DialogDescription>Your browser shares this one-time device location and IP address with BigDataCloud to identify your area and improve its location data. Only the area name goes to LayoverFuel and OpenAI for menu search. Coordinates are not saved by LayoverFuel. You can enter a city instead.</DialogDescription>
      </DialogHeader>
      <a className="text-sm text-primary underline" href="https://www.bigdatacloud.com/privacy-and-cookie-policy" target="_blank" rel="noopener noreferrer">BigDataCloud privacy policy</a>
      <DialogFooter><button type="button" className={btnQuiet} onClick={() => setConsent(false)}>Not now</button>
        <button type="button" className={btnPrimary} onClick={locate}><LocateFixed className="h-4 w-4" />Use location once</button>
      </DialogFooter></DialogContent>
    </Dialog>
  </>;
}
