import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";
import { Send, X, Check, Pencil, RotateCcw, Zap, ScanBarcode, ChevronRight, Camera, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string[];
  imageUrls?: string[];
  createdAt?: number;
}

interface MealLog {
  description: string;
  calories: number;
  macros: { protein: number; carbs: number; fat: number };
  image?: string;
}

interface MealAnalysisApiResponse {
  message: string;
  result: {
    estimate: { calories: number; protein: number; carbs: number; fat: number };
    foodItems: string[];
    analysis: string;
    suggestions: string;
  };
}

interface DashboardStats {
  stats: {
    currentCalories: number;
    currentProtein: number;
    macros: { targetCalories: number; protein: number };
  };
}

function getQuickPrompts(): string[] {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return [
    "Log my breakfast",
    "What should I eat before my flight?",
    "Morning workout idea",
    "How much protein do I need today?",
  ];
  if (hour >= 11 && hour < 14) return [
    "Log my lunch",
    "Best airport meal options",
    "How am I doing on calories today?",
    "Quick hotel room workout",
  ];
  if (hour >= 14 && hour < 18) return [
    "Log a snack",
    "Afternoon energy tips",
    "Hotel gym workout plan",
    "Am I on track for my goal?",
  ];
  if (hour >= 18 && hour < 22) return [
    "Log my dinner",
    "Summarize my day",
    "How was my protein intake?",
    "Healthy room service options",
  ];
  return [
    "Log a late meal",
    "How did I do today?",
    "Tomorrow's nutrition plan",
    "Recovery tips for travel",
  ];
}

function getDateLabel(ts: number): string {
  const d = new Date(ts * 1000);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function MealLogCard({
  log,
  onLog,
  onDismiss,
  remainingCal,
  remainingPro,
  isLogging,
}: {
  log: MealLog;
  onLog: (updated: MealLog) => void;
  onDismiss: () => void;
  remainingCal: number;
  remainingPro: number;
  isLogging: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [desc, setDesc] = useState(log.description);
  const [macros, setMacros] = useState(log.macros);
  const [cal, setCal] = useState(log.calories);

  const current = editing ? { description: desc, calories: cal, macros } : log;

  return (
    <div className="bg-gray-900 border border-indigo-500/40 rounded-2xl p-4 w-full max-w-sm mx-auto">
      <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-2">Log this meal?</p>

      {log.image && (
        <img src={log.image} alt="Meal" className="w-full rounded-xl mb-3 max-h-40 object-cover" />
      )}

      {editing ? (
        <div className="space-y-2">
          <input
            className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700 focus:outline-none focus:border-indigo-500"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            placeholder="Meal description"
          />
          <div className="grid grid-cols-4 gap-1.5">
            <div>
              <p className="text-xs text-gray-500 mb-1">Cal</p>
              <input
                type="number"
                className="w-full bg-gray-800 text-white text-xs rounded-xl px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-indigo-500 text-center"
                value={cal}
                onChange={e => setCal(Number(e.target.value))}
              />
            </div>
            {(["protein", "carbs", "fat"] as const).map(k => (
              <div key={k}>
                <p className="text-xs text-gray-500 mb-1 capitalize">{k}</p>
                <input
                  type="number"
                  className="w-full bg-gray-800 text-white text-xs rounded-xl px-2 py-1.5 border border-gray-700 focus:outline-none focus:border-indigo-500 text-center"
                  value={macros[k]}
                  onChange={e => setMacros(prev => ({ ...prev, [k]: Number(e.target.value) }))}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-white font-medium text-sm">{log.description}</p>
          <div className="flex gap-3 mt-1.5">
            <span className="text-xs text-white font-semibold">{log.calories} cal</span>
            <span className="text-xs text-gray-400">P: {log.macros.protein}g · C: {log.macros.carbs}g · F: {log.macros.fat}g</span>
          </div>
        </div>
      )}

      {/* Fits your day */}
      {remainingCal > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-gray-800 flex items-center justify-between">
          <span className="text-xs text-gray-500">Remaining today</span>
          <span className="text-xs font-medium text-gray-300">{remainingCal} cal · {remainingPro}g protein</span>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => setEditing(p => !p)}
          className="flex items-center gap-1 flex-1 justify-center py-2 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5" /> {editing ? "Done" : "Edit"}
        </button>
        <button
          onClick={() => onLog(current)}
          disabled={isLogging}
          className="flex items-center gap-1 flex-1 justify-center py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
        >
          {isLogging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Log it
        </button>
        <button
          onClick={onDismiss}
          className="flex items-center gap-1 flex-1 justify-center py-2 rounded-xl bg-gray-800 text-gray-400 text-sm hover:bg-gray-700 transition-colors"
        >
          <X className="h-3.5 w-3.5" /> Skip
        </button>
      </div>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tempImages, setTempImages] = useState<string[]>([]);

  const [pendingLog, setPendingLog] = useState<MealLog | null>(null);
  const [inlineLog, setInlineLog] = useState<MealLog | null>(null);
  const [inlineLogExpanded, setInlineLogExpanded] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [isLogging, setIsLogging] = useState(false);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quickPrompts = getQuickPrompts();

  const { data: dashboard } = useQuery<DashboardStats>({ queryKey: ["/api/dashboard"] });
  const targetCal = dashboard?.stats?.macros?.targetCalories ?? 0;
  const targetPro = dashboard?.stats?.macros?.protein ?? 0;
  const remainingCal = Math.max(targetCal - (dashboard?.stats?.currentCalories ?? 0), 0);
  const remainingPro = Math.max(targetPro - (dashboard?.stats?.currentProtein ?? 0), 0);

  useEffect(() => {
    const prefill = sessionStorage.getItem("chatPrefill");
    if (prefill) {
      setInput(prefill);
      sessionStorage.removeItem("chatPrefill");
    }
  }, []);

  useEffect(() => {
    const storedThreadId = localStorage.getItem("assistantThreadId");
    if (storedThreadId) {
      setThreadId(storedThreadId);
      fetchMessages(storedThreadId);
    } else {
      createThread();
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingLog, inlineLog, analysisLoading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  const createThread = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/assistant/thread", {});
      if (!response.ok) throw new Error("Failed to create thread");
      const data = await response.json();
      setThreadId(data.threadId);
      localStorage.setItem("assistantThreadId", data.threadId);
      setMessages([]);
    } catch {
      toast({ title: "Error", description: "Failed to initialize chat.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    localStorage.removeItem("assistantThreadId");
    setMessages([]);
    setThreadId(null);
    setShowClearConfirm(false);
    setPendingLog(null);
    setInlineLog(null);
    await createThread();
  };

  const fetchMessages = async (tid: string) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("GET", `/api/assistant/messages/${tid}`);
      if (!response.ok) throw new Error("Failed to fetch messages");
      const data = await response.json();
      const formatted = data.messages.slice().reverse().map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text.value).filter(Boolean),
        imageUrls: msg.content
          .filter((c: any) => c.type === "image_url" || c.type === "image_file")
          .map((c: any) => c.type === "image_url" ? c.image_url.url : c.image_file.file_id)
          .filter(Boolean) || undefined,
        createdAt: msg.created_at,
      }));
      setMessages(formatted);
    } catch {
      toast({ title: "Error", description: "Failed to load chat history.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, imageDataArray }: { message: string; imageDataArray?: string[] }) => {
      if (!threadId) throw new Error("No thread ID");
      const response = await apiRequest("POST", "/api/assistant/message", { threadId, message, imageDataArray });
      if (!response.ok) throw new Error("Failed to send message");
      return response.json();
    },
    onSuccess: (data) => {
      const newMessages = data.messages.slice().reverse().map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content.filter((c: any) => c.type === "text").map((c: any) => c.text.value).filter(Boolean),
        imageUrls: msg.content
          .filter((c: any) => c.type === "image_url" || c.type === "image_file")
          .map((c: any) => c.type === "image_url" ? c.image_url.url : c.image_file.file_id)
          .filter(Boolean) || undefined,
        createdAt: msg.created_at,
      }));
      setMessages(newMessages);
    },
    onError: (error) => {
      console.error("Send error:", error);
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
      setMessages(prev => prev.filter(m => m.id !== "processing"));
    },
  });

  const runMealAnalysis = async (imageData: string): Promise<MealLog | null> => {
    try {
      const res = await apiRequest("POST", "/api/meal-analysis", { imageData });
      const data: MealAnalysisApiResponse = await res.json();
      if (!data.result) return null;
      const r = data.result;
      return {
        description: r.foodItems?.length ? r.foodItems.join(", ") : "Detected meal",
        calories: r.estimate.calories,
        macros: { protein: r.estimate.protein, carbs: r.estimate.carbs, fat: r.estimate.fat },
        image: imageData,
      };
    } catch {
      return null;
    }
  };

  const sendMessage = async (text?: string) => {
    const msg = text ?? input;
    if (!msg.trim() && tempImages.length === 0) return;
    const currentInput = msg.trim();
    const currentImages = [...tempImages];

    setInput("");
    setTempImages([]);
    setInlineLog(null);
    setInlineLogExpanded(false);

    // Path A: Photo-only — bypass chat UI entirely; show only analysis card
    if (currentImages.length > 0 && !currentInput) {
      setAnalysisLoading(true);
      setPendingLog(null);
      const log = await runMealAnalysis(currentImages[0]);
      setAnalysisLoading(false);
      if (log) {
        setPendingLog(log);
      } else {
        toast({
          title: "Analysis failed",
          description: "Couldn't identify this meal. Add a text question to chat instead.",
          variant: "destructive",
        });
      }
      return;
    }

    // Path B: Text (+ optional photo) — conversational chat + gated inline log chip
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(), role: "user",
        content: currentInput ? [currentInput] : [],
        imageUrls: currentImages.length > 0 ? currentImages : undefined,
        createdAt: Math.floor(Date.now() / 1000),
      },
      { id: "processing", role: "assistant", content: ["Thinking..."] },
    ]);

    if (currentImages.length > 0) {
      // Wait for BOTH chat + analysis to complete before showing the chip
      try {
        const [, log] = await Promise.all([
          sendMessageMutation.mutateAsync({ message: currentInput, imageDataArray: currentImages }),
          runMealAnalysis(currentImages[0]),
        ]);
        if (log) {
          setInlineLog(log);
          setInlineLogExpanded(false);
        }
      } catch {
        // sendMessageMutation.onError already shows a toast; analysis errors are swallowed silently
      }
    } else {
      sendMessageMutation.mutate({ message: currentInput });
    }
  };

  const logMeal = async (log: MealLog, onSuccess: () => void) => {
    setIsLogging(true);
    try {
      await apiRequest("POST", "/api/logs/nutrition", {
        date: new Date().toISOString().slice(0, 10),
        calories: log.calories,
        protein: log.macros.protein,
        carbs: log.macros.carbs,
        fat: log.macros.fat,
        mealStyle: log.description,
        notes: "Photo analysis",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      toast({ title: "Logged!", description: `${log.description} added to today's log.` });
      onSuccess();
    } catch {
      toast({ title: "Error", description: "Failed to log. Please try again.", variant: "destructive" });
    } finally {
      setIsLogging(false);
    }
  };

  const messagesWithSeparators: Array<
    | { type: "separator"; label: string }
    | { type: "message"; message: Message; index: number }
  > = [];
  let lastDateLabel = "";
  messages.forEach((message, index) => {
    if (message.createdAt) {
      const label = getDateLabel(message.createdAt);
      if (label !== lastDateLabel) {
        messagesWithSeparators.push({ type: "separator", label });
        lastDateLabel = label;
      }
    }
    messagesWithSeparators.push({ type: "message", message, index });
  });

  const isEmpty = messages.length === 0 && !isLoading && !analysisLoading;

  return (
    <div className="flex flex-col bg-black flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-black/80 backdrop-blur-md shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Layover Fuel AI</h1>
          <p className="text-xs text-gray-400">Your travel fitness companion</p>
        </div>
        <button
          onClick={() => setShowClearConfirm(true)}
          className="p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          title="Start fresh"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Clear confirm dialog */}
      {showClearConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mx-6 text-center">
            <p className="text-white font-semibold mb-1">Start a new conversation?</p>
            <p className="text-gray-400 text-sm mb-5">Your chat history will be cleared. Your logged meals and workouts are safe.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-800 text-gray-300 text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearChat}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
              >
                Start fresh
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 pb-4 space-y-4" style={{ WebkitOverflowScrolling: "touch" }}>

        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-indigo-400" />
              </div>
              <h2 className="text-white font-semibold text-lg mb-1">Layover Fuel AI</h2>
              <p className="text-gray-400 text-sm max-w-xs">Log meals, get workout ideas, and stay on track — no matter where you're flying.</p>
              <p className="text-gray-600 text-xs mt-2">Tip: send a food photo with no text to instantly log it.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-xs">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => sendMessage(prompt)}
                  className="bg-gray-900 border border-gray-800 rounded-2xl px-3 py-3 text-left text-sm text-gray-300 hover:border-indigo-500/50 hover:bg-gray-800 transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messagesWithSeparators.map((item, i) => {
          if (item.type === "separator") {
            return (
              <div key={`sep-${item.label}-${i}`} className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-gray-800" />
                <span className="text-xs text-gray-500 font-medium shrink-0">{item.label}</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
            );
          }

          const { message, index } = item;
          return (
            <div key={message.id + index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className="flex flex-col gap-1 max-w-[80%]">
                {message.imageUrls && message.imageUrls.length > 0 && (
                  <div className={`flex flex-wrap gap-1 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    {message.imageUrls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url.startsWith("data:") || url.startsWith("http") ? url : `https://api.openai.com/v1/files/${url}/content`}
                        alt={`Image ${idx + 1}`}
                        className="max-h-40 max-w-40 rounded-xl object-cover cursor-pointer"
                        onClick={() => window.open(url, "_blank")}
                      />
                    ))}
                  </div>
                )}
                {(message.content.length > 0 && message.content[0]?.trim() !== "") || message.id === "processing" ? (
                  <div className={`rounded-2xl px-4 py-3 text-sm ${
                    message.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-900 text-gray-100"
                  }`}>
                    {message.content.map((text, ti) => (
                      <div key={ti} className={message.role === "assistant" ? "prose prose-invert prose-sm max-w-none" : ""}>
                        <ReactMarkdown>{text}</ReactMarkdown>
                      </div>
                    ))}
                    {message.id === "processing" && (
                      <div className="flex gap-1 mt-1">
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Analysis loading state (photo-only path) */}
        {analysisLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-900 rounded-2xl px-4 py-3 flex items-center gap-3 max-w-[80%]">
              <Loader2 className="h-4 w-4 text-indigo-400 animate-spin shrink-0" />
              <p className="text-sm text-gray-300">Analysing your meal...</p>
            </div>
          </div>
        )}

        {/* Full log card (photo-only path) */}
        {pendingLog && !analysisLoading && (
          <MealLogCard
            log={pendingLog}
            onLog={updated => logMeal(updated, () => { setPendingLog(null); })}
            onDismiss={() => setPendingLog(null)}
            remainingCal={remainingCal}
            remainingPro={remainingPro}
            isLogging={isLogging}
          />
        )}

        {/* Inline log chip (photo + text path) */}
        {inlineLog && !pendingLog && (
          inlineLogExpanded ? (
            <MealLogCard
              log={inlineLog}
              onLog={updated => logMeal(updated, () => { setInlineLog(null); setInlineLogExpanded(false); })}
              onDismiss={() => { setInlineLog(null); setInlineLogExpanded(false); }}
              remainingCal={remainingCal}
              remainingPro={remainingPro}
              isLogging={isLogging}
            />
          ) : (
            <div
              className="flex items-center gap-3 bg-gray-900 border border-indigo-500/30 rounded-2xl px-4 py-3 mx-auto max-w-sm cursor-pointer hover:border-indigo-500/60 transition-colors"
              onClick={() => setInlineLogExpanded(true)}
            >
              <div className="bg-indigo-600/20 rounded-xl p-2 shrink-0">
                <Camera className="h-4 w-4 text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{inlineLog.description}</p>
                <p className="text-gray-400 text-xs">{inlineLog.calories} cal · Tap to log</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
            </div>
          )
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Image previews */}
      {tempImages.length > 0 && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0 border-t border-gray-800">
          {tempImages.map((img, i) => (
            <div key={i} className="relative shrink-0">
              <img src={img} alt={`Preview ${i + 1}`} className="h-16 w-16 rounded-xl object-cover" />
              <button
                onClick={() => setTempImages(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 bg-gray-800 rounded-full p-0.5"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Quick prompt chips */}
      {!isEmpty && (
        <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0 scrollbar-hide">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => sendMessage(prompt)}
              disabled={isLoading || sendMessageMutation.isPending}
              className="shrink-0 bg-gray-900 border border-gray-700 rounded-full px-3 py-1.5 text-xs text-gray-300 hover:border-indigo-500/50 hover:bg-gray-800 disabled:opacity-40 transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div className="shrink-0 border-t border-gray-800 bg-black/90 backdrop-blur-md px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}>
        <div className="flex items-end gap-2 bg-gray-900 rounded-2xl px-3 py-2 border border-gray-800 focus-within:border-indigo-500/50 transition-colors">
          <ImageUpload
            onImageSelect={(_, preview) => setTempImages(prev => [...prev, preview])}
            disabled={isLoading || sendMessageMutation.isPending || analysisLoading}
          />
          <button
            onClick={() => setShowScanner(true)}
            disabled={isLoading || sendMessageMutation.isPending || analysisLoading}
            className="shrink-0 p-1.5 text-gray-500 hover:text-indigo-400 disabled:opacity-30 transition-colors"
            title="Scan barcode"
          >
            <ScanBarcode className="h-5 w-5" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={tempImages.length > 0 ? "Ask a question, or send without text to log…" : "Message your AI coach..."}
            className="flex-1 bg-transparent text-white text-sm resize-none outline-none min-h-[24px] max-h-[150px] placeholder-gray-500"
            rows={1}
            disabled={isLoading || sendMessageMutation.isPending || analysisLoading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && tempImages.length === 0) || isLoading || sendMessageMutation.isPending || analysisLoading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Barcode Scanner */}
      {showScanner && (
        <BarcodeScanner
          onClose={() => setShowScanner(false)}
          onLogSuccess={() => queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] })}
        />
      )}
    </div>
  );
}
