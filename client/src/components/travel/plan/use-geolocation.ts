import { useCallback, useEffect, useRef, useState } from "react";

export type GeoState =
  | { status: "idle" }
  | { status: "locating" }
  | { status: "error"; message: string };

function errorMessage(error: GeolocationPositionError | null): string {
  switch (error?.code) {
    case 1:
      return "Location access is turned off for this site. You can type where you are instead, or allow location in your browser settings.";
    case 2:
      return "Your device couldn't find your location right now. Type where you are instead.";
    case 3:
      return "Finding your location took too long. Try again, or type where you are instead.";
    default:
      return "Your location isn't available. Type where you are instead.";
  }
}

/**
 * One-shot location lookup that only runs when the user asks for it.
 * Never watches position and never runs on mount.
 */
export function useGeolocation() {
  const supported = typeof navigator !== "undefined" && "geolocation" in navigator && !!navigator.geolocation;
  const [state, setState] = useState<GeoState>({ status: "idle" });
  const mounted = useRef(true);
  const request = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      request.current += 1;
    };
  }, []);

  const locate = useCallback(
    (onFound: (coords: { latitude: number; longitude: number }) => void) => {
      if (!supported) return;
      const id = ++request.current;
      setState({ status: "locating" });
      try {
        navigator.geolocation.getCurrentPosition(
          position => {
            if (!mounted.current || request.current !== id) return;
            setState({ status: "idle" });
            onFound({ latitude: position.coords.latitude, longitude: position.coords.longitude });
          },
          error => {
            if (!mounted.current || request.current !== id) return;
            setState({ status: "error", message: errorMessage(error) });
          },
          { enableHighAccuracy: false, timeout: 15_000, maximumAge: 5 * 60_000 },
        );
      } catch {
        setState({ status: "error", message: errorMessage(null) });
      }
    },
    [supported],
  );

  const reset = useCallback(() => {
    request.current += 1;
    setState({ status: "idle" });
  }, []);

  return { supported, state, locate, reset };
}
