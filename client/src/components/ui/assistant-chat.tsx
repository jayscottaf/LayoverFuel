import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string[];
  imageUrl?: string;
}

export function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Initialize a thread when the component mounts
  useEffect(() => {
    const storedThreadId = localStorage.getItem("assistantThreadId");
    if (storedThreadId) {
      setThreadId(storedThreadId);
      fetchMessages(storedThreadId);
    } else {
      createThread();
    }
  }, []);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create a new thread
  const createThread = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest("POST", "/api/assistant/thread", {});
      if (!response.ok) {
        throw new Error("Failed to create thread");
      }
      const data = await response.json();
      setThreadId(data.threadId);
      localStorage.setItem("assistantThreadId", data.threadId);
      
      // Add welcome message
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: ["Welcome to Layover Fuel! I'm your personal nutrition and fitness assistant. I can help you analyze your meals, suggest workouts, and provide travel-friendly fitness tips. How can I help you today?"],
        },
      ]);
    } catch (error) {
      console.error("Error creating thread:", error);
      toast({
        title: "Error",
        description: "Failed to initialize chat. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch messages from a thread
  const fetchMessages = async (tid: string) => {
    try {
      setIsLoading(true);
      const response = await apiRequest("GET", `/api/assistant/messages/${tid}`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }
      const data = await response.json();
      
      // Format messages
      const formattedMessages = data.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content.map((content: any) => 
          content.type === "text" ? content.text.value : ""
        ).filter(Boolean),
        imageUrl: msg.content.find((c: any) => c.type === "image_file")?.image_file?.file_id,
      }));
      
      // Add welcome message if no messages
      if (formattedMessages.length === 0) {
        formattedMessages.push({
          id: "welcome",
          role: "assistant",
          content: ["Welcome to Layover Fuel! I'm your personal nutrition and fitness assistant. I can help you analyze your meals, suggest workouts, and provide travel-friendly fitness tips. How can I help you today?"],
        });
      }
      
      setMessages(formattedMessages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Error",
        description: "Failed to load chat history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Send a message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, imageData }: { message: string; imageData?: string }) => {
      if (!threadId) throw new Error("No thread ID");
      
      const response = await apiRequest("POST", "/api/assistant/message", {
        threadId,
        message,
        imageData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Update messages with the new ones
      const newMessages = data.messages.map((msg: any) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content.map((content: any) => 
          content.type === "text" ? content.text.value : ""
        ).filter(Boolean),
        imageUrl: msg.content.find((c: any) => c.type === "image_file")?.image_file?.file_id,
      }));
      
      setMessages(newMessages);
      setInput("");
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send a message
  const sendMessage = () => {
    if (!input.trim() && !tempImage) return;
    
    // Add user message to the UI immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: [input],
      imageUrl: tempImage || undefined,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    
    // Add processing message
    const processingMessage: Message = {
      id: "processing",
      role: "assistant",
      content: ["Thinking..."],
    };
    
    setMessages((prev) => [...prev, processingMessage]);
    
    // Send the message to the API
    sendMessageMutation.mutate({
      message: input,
      imageData: tempImage || undefined,
    });
    
    // Clear the input and image
    setInput("");
    setTempImage(null);
  };

  // Handle image upload
  const [tempImage, setTempImage] = useState<string | null>(null);
  
  const handleImageSelect = (file: File, preview: string) => {
    setTempImage(preview);
    toast({
      title: "Image added",
      description: "Your food photo is ready to be analyzed. Add a message or just send it as is.",
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-4 md:p-6">
      <div className="flex items-center mb-6">
        <span className="text-accent-600 bg-accent-100 p-2 rounded-lg mr-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </span>
        <h3 className="font-heading font-semibold text-lg text-gray-900">
          Layover Fuel Assistant
        </h3>
      </div>

      {/* Chat messages */}
      <div className="space-y-4 mb-4 max-h-[400px] overflow-y-auto">
        {messages.map((message, index) => (
          <div
            key={message.id + index}
            className={`p-3 rounded-lg ${
              message.role === "user"
                ? "bg-primary-100 ml-12"
                : "bg-gray-100 mr-12"
            }`}
          >
            {message.imageUrl && (
              <div className="mb-2">
                <img
                  src={
                    message.imageUrl.startsWith("data:")
                      ? message.imageUrl
                      : `https://api.openai.com/v1/files/${message.imageUrl}/content`
                  }
                  alt="Uploaded image"
                  className="rounded max-h-48 object-cover"
                />
              </div>
            )}
            {message.content.map((text, i) => (
              <p key={i} className="mb-1">
                {text}
              </p>
            ))}
            
            {message.id === "processing" && (
              <div className="flex items-center mt-1">
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse mr-1"></div>
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse delay-150 mr-1"></div>
                <div className="w-3 h-3 bg-gray-400 rounded-full animate-pulse delay-300"></div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Display image to be sent */}
      {tempImage && (
        <div className="mb-4 p-2 border rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-gray-700">Image to analyze:</p>
            <button
              onClick={() => setTempImage(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
          <img
            src={tempImage}
            alt="Preview"
            className="w-full max-h-40 object-cover rounded"
          />
        </div>
      )}

      {/* Input area */}
      <div className="relative">
        <textarea
          className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-20 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          placeholder="Ask about nutrition, fitness, or upload a meal photo..."
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={sendMessageMutation.isPending || isLoading}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <div className="absolute bottom-3 right-3 flex space-x-2">
          <ImageUpload
            onImageSelect={handleImageSelect}
            className="text-gray-400 hover:text-primary-500"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full bg-primary-100 text-primary-600 hover:bg-primary-200"
            onClick={sendMessage}
            disabled={sendMessageMutation.isPending || isLoading || (!input.trim() && !tempImage)}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}