import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { BarcodeScanner } from "@/components/ui/barcode-scanner";
import { Send, X, RotateCcw, Zap, ScanBarcode, Camera } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string[];
  imageUrls?: string[];
  createdAt?: number;
}

function getQuickPrompts(): string[] {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return [
    "What should I eat before my flight?",
    "Morning workout ideas?",
    "Is this breakfast choice good?",
  ];
  if (hour >= 11 && hour < 14) return [
    "Best airport meal options?",
    "Quick hotel room workout?",
    "Am I on track today?",
  ];
  if (hour >= 14 && hour < 18) return [
    "Afternoon energy tips?",
    "Hotel gym workout plan?",
    "Healthy snack ideas?",
  ];
  if (hour >= 18 && hour < 22) return [
    "Healthy room service options?",
    "How was my day?",
    "Dinner recommendations?",
  ];
  return [
    "How did I do today?",
    "Tomorrow's nutrition plan?",
    "Recovery tips for travel?",
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

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tempImages, setTempImages] = useState<string[]>([]);

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const quickPrompts = getQuickPrompts();

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
  }, [messages]);

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

  const sendMessage = async (text?: string) => {
    const msg = text ?? input;
    if (!msg.trim() && tempImages.length === 0) return;
    const currentInput = msg.trim();
    const currentImages = [...tempImages];

    setInput("");
    setTempImages([]);

    // Add helper text for photo-only messages
    const messageText = currentInput || (currentImages.length > 0 ? "Can you analyze this meal for me?" : "");
    if (!messageText) return;

    // All messages go through conversational chat (no bypass)
    setMessages(prev => [
      ...prev,
      {
        id: Date.now().toString(), role: "user",
        content: [messageText],
        imageUrls: currentImages.length > 0 ? currentImages : undefined,
        createdAt: Math.floor(Date.now() / 1000),
      },
      { id: "processing", role: "assistant", content: ["Thinking..."] },
    ]);

    // Send to assistant (with or without images)
    sendMessageMutation.mutate({ message: messageText, imageDataArray: currentImages.length > 0 ? currentImages : undefined });
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

  const isEmpty = messages.length === 0 && !isLoading;

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
              <p className="text-gray-400 text-sm max-w-xs">Your AI fitness coach for life on the road. Ask questions, get advice, and stay on track.</p>
              <p className="text-gray-600 text-xs mt-2">Tip: Send photos with questions to get personalized meal advice.</p>
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
            disabled={isLoading || sendMessageMutation.isPending}
          />
          <button
            onClick={() => setShowScanner(true)}
            disabled={isLoading || sendMessageMutation.isPending}
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
            placeholder={tempImages.length > 0 ? "Ask a question about this food..." : "Message your AI coach..."}
            className="flex-1 bg-transparent text-white text-sm resize-none outline-none min-h-[24px] max-h-[150px] placeholder-gray-500"
            rows={1}
            disabled={isLoading || sendMessageMutation.isPending}
          />
          <button
            onClick={() => sendMessage()}
            disabled={(!input.trim() && tempImages.length === 0) || isLoading || sendMessageMutation.isPending}
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
