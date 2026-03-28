import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { Send, X, Check, Pencil } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string[];
  imageUrls?: string[];
}

interface PendingLog {
  description: string;
  macros: { protein: number; carbs: number; fat: number };
  image?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [tempImages, setTempImages] = useState<string[]>([]);
  const [pendingLog, setPendingLog] = useState<PendingLog | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  // Load prefill from sessionStorage (set by travel shortcuts on home screen)
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
      setMessages([{
        id: "welcome",
        role: "assistant",
        content: ["Hey! I'm your Layover Fuel assistant. I can log meals, suggest workouts, and help you stay on track while traveling. What do you need?"],
      }]);
    } catch {
      toast({ title: "Error", description: "Failed to initialize chat.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
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
      }));
      if (formatted.length === 0) {
        formatted.push({ id: "welcome", role: "assistant", content: ["Hey! I'm your Layover Fuel assistant. What do you need today?"] });
      }
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
      }));
      setMessages(newMessages);
    },
    onError: (error) => {
      console.error("Send error:", error);
      toast({ title: "Error", description: "Failed to send message. Please try again.", variant: "destructive" });
      setMessages(prev => prev.filter(m => m.id !== "processing"));
    },
  });

  const sendMessage = () => {
    if (!input.trim() && tempImages.length === 0) return;
    const currentInput = input;
    const currentImages = [...tempImages];

    setMessages(prev => [
      ...prev,
      { id: Date.now().toString(), role: "user", content: currentInput.trim() ? [currentInput] : [], imageUrls: currentImages.length > 0 ? currentImages : undefined },
      { id: "processing", role: "assistant", content: ["Thinking..."] },
    ]);
    setInput("");
    setTempImages([]);
    sendMessageMutation.mutate({ message: currentInput, imageDataArray: currentImages.length > 0 ? currentImages : undefined });
  };

  const handleConfirmLog = async () => {
    if (!pendingLog) return;
    try {
      await fetch("/api/logs/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingLog),
      });
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: ["✅ Meal logged successfully!"] }]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: ["⚠️ Failed to log meal."] }]);
    } finally {
      setPendingLog(null);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col bg-black" style={{ height: "100dvh" }}>
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-gray-800 bg-black/80 backdrop-blur-md shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Layover Fuel AI</h1>
          <p className="text-xs text-gray-400">Your travel fitness companion</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 pb-4 space-y-4" style={{ WebkitOverflowScrolling: "touch" }}>
        {messages.map((message, index) => (
          <div key={message.id + index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className="flex flex-col gap-1 max-w-[80%]">
              {/* Images */}
              {message.imageUrls && message.imageUrls.length > 0 && (
                <div className={`flex flex-wrap gap-1 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  {message.imageUrls.map((url, i) => (
                    <img
                      key={i}
                      src={url.startsWith("data:") || url.startsWith("http") ? url : `https://api.openai.com/v1/files/${url}/content`}
                      alt={`Image ${i + 1}`}
                      className="max-h-40 max-w-40 rounded-xl object-cover cursor-pointer"
                      onClick={() => window.open(url, "_blank")}
                    />
                  ))}
                </div>
              )}

              {/* Bubble */}
              {(message.content.length > 0 && message.content[0]?.trim() !== "") || message.id === "processing" ? (
                <div className={`rounded-2xl px-4 py-3 text-sm ${
                  message.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-900 text-gray-100"
                }`}>
                  {message.content.map((text, i) => (
                    <div key={i} className={message.role === "assistant" ? "prose prose-invert prose-sm max-w-none" : ""}>
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
        ))}

        {/* Pending Log Confirmation Card */}
        {pendingLog && (
          <div className="bg-gray-900 border border-indigo-500/40 rounded-2xl p-4 mx-auto max-w-sm">
            <p className="text-xs text-indigo-400 font-semibold uppercase tracking-wider mb-2">Log this meal?</p>
            {pendingLog.image && (
              <img src={pendingLog.image} alt="Meal" className="w-full rounded-xl mb-3 max-h-40 object-cover" />
            )}
            {isEditing ? (
              <div className="space-y-2">
                <input
                  className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700 focus:outline-none focus:border-indigo-500"
                  value={pendingLog.description}
                  onChange={e => setPendingLog(prev => prev ? { ...prev, description: e.target.value } : prev)}
                  placeholder="Meal description"
                />
                <div className="flex gap-2">
                  {(["protein", "carbs", "fat"] as const).map(macro => (
                    <input
                      key={macro}
                      type="number"
                      className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-2 py-2 border border-gray-700 focus:outline-none focus:border-indigo-500"
                      value={pendingLog.macros[macro]}
                      onChange={e => setPendingLog(prev => prev ? { ...prev, macros: { ...prev.macros, [macro]: Number(e.target.value) } } : prev)}
                      placeholder={macro}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-white font-medium text-sm">{pendingLog.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  P: {pendingLog.macros.protein}g · C: {pendingLog.macros.carbs}g · F: {pendingLog.macros.fat}g
                </p>
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setIsEditing(p => !p)}
                className="flex items-center gap-1 flex-1 justify-center py-2 rounded-xl bg-gray-800 text-gray-300 text-sm hover:bg-gray-700"
              >
                <Pencil className="h-3.5 w-3.5" /> {isEditing ? "Done" : "Edit"}
              </button>
              <button
                onClick={handleConfirmLog}
                className="flex items-center gap-1 flex-1 justify-center py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500"
              >
                <Check className="h-3.5 w-3.5" /> Log it
              </button>
              <button
                onClick={() => { setPendingLog(null); setIsEditing(false); }}
                className="flex items-center gap-1 flex-1 justify-center py-2 rounded-xl bg-gray-800 text-gray-400 text-sm hover:bg-gray-700"
              >
                <X className="h-3.5 w-3.5" /> Skip
              </button>
            </div>
          </div>
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

      {/* Input area */}
      <div className="shrink-0 border-t border-gray-800 bg-black/90 backdrop-blur-md px-4 py-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 80px)" }}>
        <div className="flex items-end gap-2 bg-gray-900 rounded-2xl px-3 py-2 border border-gray-800 focus-within:border-indigo-500/50 transition-colors">
          <ImageUpload
            onImageSelect={(_, preview) => setTempImages(prev => [...prev, preview])}
            disabled={isLoading || sendMessageMutation.isPending}
          />
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
            placeholder="Message your AI coach..."
            className="flex-1 bg-transparent text-white text-sm resize-none outline-none min-h-[24px] max-h-[150px] placeholder-gray-500"
            rows={1}
            disabled={isLoading || sendMessageMutation.isPending}
          />
          <button
            onClick={sendMessage}
            disabled={(!input.trim() && tempImages.length === 0) || isLoading || sendMessageMutation.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors shrink-0"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
