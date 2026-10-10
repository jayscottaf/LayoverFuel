import { useEffect, useRef, useState } from "react";
import { Camera, ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { ImageUpload } from "./image-upload";

type CameraState = "starting" | "ready" | "denied" | "unavailable" | "waiting";

export function MealCamera({ onCapture, onImageSelect }: {
  onCapture: (preview: string) => void;
  onImageSelect: (file: File, preview: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("starting");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | undefined;
    let expired = false;
    setState("starting");
    const timeout = setTimeout(() => {
      expired = true;
      stream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      if (!cancelled) setState("waiting");
    }, 15_000);
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera unavailable");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 960 } },
          audio: false,
        });
        if (cancelled || expired) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) throw new Error("Camera preview unavailable");
        video.srcObject = stream;
        await video.play();
        if (!cancelled && !expired) {
          clearTimeout(timeout);
          setState("ready");
        }
      } catch (error) {
        clearTimeout(timeout);
        stream?.getTracks().forEach(track => track.stop());
        if (cancelled || expired) return;
        streamRef.current = null;
        const denied = error instanceof DOMException && ["NotAllowedError", "PermissionDeniedError"].includes(error.name);
        setState(denied ? "denied" : "unavailable");
      }
    };
    void start();
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      stream?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [attempt]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || state !== "ready" || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d");
    if (!context) { setState("unavailable"); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const preview = canvas.toDataURL("image/jpeg", 0.8);
    streamRef.current?.getTracks().forEach(track => track.stop());
    onCapture(preview);
  };

  const blocked = state === "denied" || state === "unavailable" || state === "waiting";
  const title = state === "denied" ? "Camera access is off" : state === "waiting" ? "Still waiting for the camera" : "Camera not available";
  const message = state === "denied"
    ? "Allow camera access for this site in your browser settings, then try again. You can also choose a photo below."
    : state === "waiting"
      ? "Check your browser's camera permission prompt, then try again, or choose a photo."
      : "Your camera may be in use by another app or this device may not have one. You can choose a photo instead.";

  return (
    <div className="mx-auto w-full max-w-lg space-y-4">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-gray-800 bg-gray-900">
        <video ref={videoRef} autoPlay playsInline muted aria-label="Meal camera preview" className={`h-full w-full object-cover ${state === 'ready' ? '' : 'invisible'}`} />
        {state === "starting" && (
          <div role="status" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center text-gray-300">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
            <p>Opening camera...</p>
            <p className="text-sm text-gray-400">Your browser may ask for camera access.</p>
          </div>
        )}
        {blocked && (
          <div role="alert" className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center">
            <Camera className="h-8 w-8 text-gray-400" aria-hidden="true" />
            <p className="font-semibold text-white">{title}</p>
            <p className="max-w-sm text-sm text-gray-400">{message}</p>
          </div>
        )}
      </div>
      {blocked ? (
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500">
          <RefreshCw className="h-5 w-5" aria-hidden="true" /> Try camera again
        </button>
      ) : (
        <button type="button" onClick={capture} disabled={state !== "ready"} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
          <Camera className="h-5 w-5" aria-hidden="true" /> Take photo
        </button>
      )}
      <ImageUpload onImageSelect={onImageSelect} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-medium text-gray-200 hover:bg-gray-800">
        <ImagePlus className="h-5 w-5" aria-hidden="true" /> Choose a photo
      </ImageUpload>
    </div>
  );
}
