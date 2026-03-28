import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, Check, ScanBarcode, Loader2, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ProductInfo {
  name: string;
  brand: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

type BarcodeApiResponse =
  | { notFound: true }
  | { notFound?: false; name: string; brand: string; servingSize: string; calories: number; protein: number; carbs: number; fat: number };

interface BarcodeScannerProps {
  onClose: () => void;
  onLogSuccess?: () => void;
}

export function BarcodeScanner({ onClose, onLogSuccess }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanKey, setScanKey] = useState(0);
  const [scanning, setScanning] = useState(true);
  const [lookingUp, setLookingUp] = useState(false);
  const [product, setProduct] = useState<ProductInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [servings, setServings] = useState(1);
  const [isLogging, setIsLogging] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  useEffect(() => {
    let cancelled = false;
    let localControls: { stop: () => void } | null = null;
    const codeReader = new BrowserMultiFormatReader();

    const lookupBarcode = (code: string) => {
      apiRequest("GET", `/api/barcode/${encodeURIComponent(code)}`)
        .then(res => res.json())
        .then((data: BarcodeApiResponse) => {
          if (cancelled) return;
          if (data.notFound) {
            setNotFound(true);
          } else {
            setProduct(data);
            setServings(1);
          }
        })
        .catch(() => { if (!cancelled) setNotFound(true); })
        .finally(() => { if (!cancelled) setLookingUp(false); });
    };

    (async () => {
      try {
        if (!videoRef.current) return;
        localControls = await codeReader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, _error, controls) => {
            if (cancelled || !result) return;
            controls.stop();
            setScanning(false);
            setLookingUp(true);
            lookupBarcode(result.getText());
          }
        );
      } catch {
        if (!cancelled) {
          setScanning(false);
          setCameraError(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      localControls?.stop();
    };
  // scanKey is the only restart signal; scanning is intentionally excluded
  // so state changes inside the decode callback don't trigger cleanup
  }, [scanKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLog = async () => {
    if (!product) return;
    setIsLogging(true);
    try {
      await apiRequest("POST", "/api/logs/nutrition", {
        date: new Date().toISOString().slice(0, 10),
        calories: Math.round(product.calories * servings),
        protein: Math.round(product.protein * servings * 10) / 10,
        carbs: Math.round(product.carbs * servings * 10) / 10,
        fat: Math.round(product.fat * servings * 10) / 10,
        mealStyle: `${product.name}${product.brand ? ` (${product.brand})` : ""}`,
        notes: `Barcode scan · ${servings} serving${servings !== 1 ? "s" : ""} · ${product.servingSize}`,
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Logged!", description: `${product.name} added to today's log.` });
      onLogSuccess?.();
      onClose();
    } catch {
      toast({ title: "Error", description: "Failed to log. Please try again.", variant: "destructive" });
    } finally {
      setIsLogging(false);
    }
  };

  const tryAgain = () => {
    setNotFound(false);
    setCameraError(false);
    setProduct(null);
    setScanning(true);
    setScanKey(k => k + 1);
  };

  const openChat = () => {
    onClose();
    navigate("/chat");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      style={{ paddingTop: "max(env(safe-area-inset-top), 16px)" }}
    >
      <style>{`
        @keyframes scanLine {
          0%, 100% { top: 10%; opacity: 0.4; }
          50% { top: 85%; opacity: 1; }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <ScanBarcode className="h-5 w-5 text-indigo-400" />
          <h2 className="text-white font-semibold">Scan Barcode</h2>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">

        {/* Camera view */}
        {scanning && (
          <>
            <p className="text-gray-400 text-sm">Point camera at a product barcode</p>
            <div
              className="relative w-full max-w-sm rounded-2xl overflow-hidden bg-gray-950 border border-gray-800"
              style={{ aspectRatio: "4/3" }}
            >
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Corner bracket overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative w-56 h-36">
                  <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-indigo-400 rounded-tl" />
                  <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-indigo-400 rounded-tr" />
                  <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-indigo-400 rounded-bl" />
                  <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-indigo-400 rounded-br" />
                  <div
                    className="absolute inset-x-2 h-px bg-indigo-400"
                    style={{ animation: "scanLine 1.8s ease-in-out infinite" }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-600">Works with UPC, EAN, and most retail barcodes</p>
          </>
        )}

        {/* Looking up */}
        {lookingUp && (
          <div className="text-center space-y-3">
            <Loader2 className="h-12 w-12 text-indigo-400 animate-spin mx-auto" />
            <p className="text-white font-medium">Looking up product...</p>
            <p className="text-gray-500 text-sm">Checking Open Food Facts database</p>
          </div>
        )}

        {/* Not found */}
        {notFound && !lookingUp && (
          <div className="text-center space-y-4 max-w-xs w-full">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto">
              <ScanBarcode className="h-8 w-8 text-gray-600" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Product not found</p>
              <p className="text-gray-400 text-sm mt-1">
                This barcode isn't in the database. Try describing it in the AI chat instead.
              </p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={tryAgain}
                className="flex-1 py-3 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Try again
              </button>
              <button
                onClick={openChat}
                className="flex-1 py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5"
              >
                <MessageCircle className="h-4 w-4" />
                Search in chat
              </button>
            </div>
          </div>
        )}

        {/* Camera unavailable */}
        {cameraError && (
          <div className="text-center space-y-4 max-w-xs w-full">
            <div className="w-16 h-16 rounded-2xl bg-gray-900 border border-gray-800 flex items-center justify-center mx-auto">
              <X className="h-8 w-8 text-red-500" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">Camera unavailable</p>
              <p className="text-gray-400 text-sm mt-1">
                Camera access was denied or your device doesn't support scanning. You can still log food via the AI chat.
              </p>
            </div>
            <button
              onClick={openChat}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors flex items-center justify-center gap-1.5"
            >
              <MessageCircle className="h-4 w-4" />
              Log food in chat
            </button>
          </div>
        )}

        {/* Product found */}
        {product && !lookingUp && (
          <div className="w-full max-w-sm space-y-3">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
              <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-2">
                Product Found
              </p>
              <p className="text-white font-semibold text-base leading-snug">{product.name}</p>
              {product.brand && (
                <p className="text-gray-400 text-sm mt-0.5">{product.brand}</p>
              )}
              <p className="text-gray-500 text-xs mt-1.5">Per serving · {product.servingSize}</p>

              <div className="grid grid-cols-4 gap-2 mt-3">
                {[
                  { label: "Cal", value: Math.round(product.calories * servings), unit: "", color: "text-white" },
                  { label: "Protein", value: Math.round(product.protein * servings), unit: "g", color: "text-blue-400" },
                  { label: "Carbs", value: Math.round(product.carbs * servings), unit: "g", color: "text-emerald-400" },
                  { label: "Fat", value: Math.round(product.fat * servings), unit: "g", color: "text-amber-400" },
                ].map(({ label, value, unit, color }) => (
                  <div key={label} className="bg-gray-800 rounded-xl p-2.5 text-center">
                    <p className={`text-sm font-bold ${color}`}>
                      {value}<span className="text-xs font-normal opacity-60">{unit}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <p className="text-white text-sm font-medium">Servings</p>
                <p className="text-xs text-gray-500">Adjust the amount</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setServings(s => Math.max(0.5, Math.round((s - 0.5) * 10) / 10))}
                  className="w-9 h-9 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 transition-colors text-lg"
                >
                  −
                </button>
                <span className="text-white font-bold text-base w-8 text-center">{servings}</span>
                <button
                  onClick={() => setServings(s => Math.round((s + 0.5) * 10) / 10)}
                  className="w-9 h-9 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 transition-colors text-lg"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={handleLog}
              disabled={isLogging}
              className="w-full py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {isLogging
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <Check className="h-5 w-5" />
              }
              {isLogging ? "Logging..." : "Log it"}
            </button>

            <div className="flex gap-3">
              <button
                onClick={tryAgain}
                className="flex-1 py-2.5 text-gray-500 text-sm hover:text-gray-300 transition-colors"
              >
                Scan different barcode
              </button>
              <button
                onClick={openChat}
                className="flex-1 py-2.5 text-indigo-500 text-sm hover:text-indigo-400 transition-colors flex items-center justify-center gap-1"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Search in chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
