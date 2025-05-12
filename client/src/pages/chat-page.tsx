import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ui/image-upload";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Loader2, Send,} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string[];
  imageUrls?: string[]; // Changed to array of image URLs
}

export default function ChatPage() {
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
      
      // Format messages - ensure they're in chronological order (oldest first)
      // The API returns messages in reverse chronological order (newest first)
      // so we need to reverse them to display correctly
      const formattedMessages = data.messages
        .slice() // Create a copy of the array to avoid mutating the original
        .reverse() // Reverse to get oldest first
        .map((msg: any) => {
          // Extract all text contents
          const textContents = msg.content
            .filter((content: any) => content.type === "text")
            .map((content: any) => content.text.value)
            .filter(Boolean);
          
          // Extract all image URLs (both direct URLs and file references)
          const imageUrls = msg.content
            .filter((c: any) => c.type === "image_url" || c.type === "image_file")
            .map((c: any) => {
              if (c.type === "image_url") return c.image_url.url;
              if (c.type === "image_file") return c.image_file.file_id;
              return null;
            })
            .filter(Boolean);
          
          return {
            id: msg.id,
            role: msg.role,
            content: textContents,
            imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          };
        });
      
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
    mutationFn: async ({ 
      message, 
      imageData, 
      imageDataArray 
    }: { 
      message: string; 
      imageData?: string;
      imageDataArray?: string[];
    }) => {
      if (!threadId) throw new Error("No thread ID");
      
      const response = await apiRequest("POST", "/api/assistant/message", {
        threadId,
        message,
        imageData,
        imageDataArray,
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      // Update messages with the new ones - make sure they're in chronological order
      const newMessages = data.messages
        .slice() // Create a copy of the array to avoid mutating the original
        .reverse() // Reverse to get oldest first
        .map((msg: any) => {
          // Extract all text contents
          const textContents = msg.content
            .filter((content: any) => content.type === "text")
            .map((content: any) => content.text.value)
            .filter(Boolean);
          
          // Extract all image URLs (both direct URLs and file references)
          const imageUrls = msg.content
            .filter((c: any) => c.type === "image_url" || c.type === "image_file")
            .map((c: any) => {
              if (c.type === "image_url") return c.image_url.url;
              if (c.type === "image_file") return c.image_file.file_id;
              return null;
            })
            .filter(Boolean);
          
          return {
            id: msg.id,
            role: msg.role,
            content: textContents,
            imageUrls: imageUrls.length > 0 ? imageUrls : undefined,
          };
        });
      
      // Update the messages state with the processed messages from the server
      setMessages(newMessages);
    },
    onError: (error) => {
      console.error("Error sending message:", error);
      
      // Try to parse the detailed error information if available
      let errorMessage = "Failed to send message. Please try again.";
      let errorTitle = "Error";
      
      if (error instanceof Error) {
        // If there's a cause with structured error information
        if ('cause' in error) {
          const cause = error.cause as any;
          if (cause && cause.message) {
            errorMessage = cause.message;
          }
        }
        
        // Check for common error types in the error message
        const errorString = error.message.toLowerCase();
        
        // Handle different types of errors with specific messages
        if (errorString.includes('cloud') || errorString.includes('storage')) {
          errorTitle = "Cloud Storage Error";
          errorMessage = "Error uploading image to cloud storage. Please try again with a different image.";
        } else if (errorString.includes('image') || 
                  errorString.includes('file') || 
                  errorString.includes('too large') || 
                  errorString.includes('size')) {
          errorTitle = "Image Error";
          errorMessage = "Image too large. Please try with a smaller image or reduce its quality.";
        } else if (errorString.includes('format') || errorString.includes('invalid')) {
          errorTitle = "Format Error";
          errorMessage = "Invalid image format. Please try with a different image.";
        } else if (errorString.includes('timeout')) {
          errorTitle = "Timeout Error";
          errorMessage = "The AI took too long to respond. Please try again or ask a different question.";
        } else if (errorString.includes('rate limit') || errorString.includes('too many requests')) {
          errorTitle = "Rate Limit";
          errorMessage = "You've made too many requests. Please wait a moment and try again.";
        }
      }
      
      toast({
        title: errorTitle,
        description: errorMessage,
        variant: "destructive",
      });
      
      // Remove the processing message from the UI
      setMessages(messages => messages.filter(msg => msg.id !== "processing"));
    },
  });

  // Send a message
  const sendMessage = () => {
    if (!input.trim() && tempImages.length === 0) return;
    
    // Store the current images/input to use in the message
    const currentInput = input;
    const currentImages = [...tempImages];
    
    // Add user message to the UI immediately
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: currentInput.trim() ? [currentInput] : [], // Only include non-empty content
      imageUrls: currentImages.length > 0 ? currentImages : undefined,
    };
    
    setMessages((prev) => [...prev, userMessage]);
    
    // Add processing message
    const processingMessage: Message = {
      id: "processing",
      role: "assistant",
      content: ["Thinking..."],
    };
    
    setMessages((prev) => [...prev, processingMessage]);
    
    // Clear the input and images BEFORE sending the API request
    // This ensures the UI is ready for another image immediately
    setInput("");
    setTempImages([]);
    
    // Send the message with all images to the API
    try {
      sendMessageMutation.mutate({
        message: currentInput,
        imageDataArray: currentImages.length > 0 ? currentImages : undefined,
      });
    } catch (error) {
      console.error("Error preparing to send message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try with smaller images.",
        variant: "destructive",
      });
    }
  };

  // Handle multiple image uploads
  const [tempImages, setTempImages] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Function to automatically adjust the textarea height based on content
  const autoResizeTextarea = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      
      // Set the height to match the content (with a max of 150px)
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
    }
  };
  
  // Effect to resize the textarea whenever input changes
  useEffect(() => {
    autoResizeTextarea();
  }, [input]);
  
  const handleImageSelect = (_: File, preview: string) => {
    // Add the new image to the array
    setTempImages(prevImages => [...prevImages, preview]);
    // No toast notification needed - the image preview is visible
  };
  
  // Remove an image from the tempImages array
  const removeImage = (index: number) => {
    setTempImages(prevImages => prevImages.filter((_, i) => i !== index));
  };

  return (
    <div className="flex flex-col h-screen bg-black overflow-hidden">
      {/* Fixed Header */}
      <div className="flex items-center justify-between px-4 py-3 fixed top-0 left-0 right-0 z-20 border-b border-zinc-800 bg-black/40 backdrop-blur-md">
        <div className="flex items-center space-x-2">
          <h1 className="text-xl font-semibold text-white">Layover Fuel Assistant</h1>
        </div>
        <Link href="/dashboard">
          <Button className="bg-transparent hover:bg-blue-500 text-gray-300 hover:text-white border border-gray-800 hover:border-transparent">
            Dashboard
          </Button>
        </Link>
      </div>

      
      {/* Spacer to account for fixed header */}
      <div className="h-14"></div>

      {/* Messages container - scrollable area between fixed header and input */}
      <div className="flex-1 overflow-y-auto p-4 bg-black pb-32">
        <div className="flex flex-col space-y-4">
          {messages.map((message, index) => (
            <div
              key={message.id + index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            ><div className="flex flex-col space-y-2 max-w-[75%]">
                {message.imageUrls && message.imageUrls.length > 0 && (
                  <div className={`flex flex-wrap gap-1 max-w-[85%] ${
                      message.role === "user" ? "ml-auto justify-end" : "mr-auto justify-start"
                    }`}>
                    {message.imageUrls.map((imageUrl, imgIndex) => (
                      <div key={imgIndex} className={`rounded-lg overflow-hidden inline-block ${
                        message.role === "user" ? "ml-1" : "mr-1"
                      }`}>
                        <img
                          src={
                            imageUrl && imageUrl.startsWith("data:")
                              ? imageUrl
                              : imageUrl && imageUrl.startsWith("http")
                                ? imageUrl // Direct URL (like Cloudinary)
                                : imageUrl ? `https://api.openai.com/v1/files/${imageUrl}/content` : '' // OpenAI file reference
                          }
                          alt={`Uploaded image ${imgIndex + 1}`}
                          className="max-h-[160px] max-w-[160px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                          onClick={() => {
                            if (imageUrl) {
                              const fullImageUrl = imageUrl.startsWith("data:")
                                ? imageUrl
                                : imageUrl.startsWith("http")
                                  ? imageUrl
                                  : `https://api.openai.com/v1/files/${imageUrl}/content`;
                              window.open(fullImageUrl, '_blank');
                            }
                          }}
                          title="Click to view full-size image"
                        />
                      </div>
                    ))}
                  </div>
                )}
                
                {((message.content.length > 0 && message.content[0]?.trim() !== "") || message.id === "processing") && (
              
              // Message Bubble Component
              <>
                <div
                  className={`rounded-2xl px-5 py-4 text-2xl shadow-md inline-block relative ${
                    message.role === "user"
                      ? "bg-sky-500/90 text-white" // 🎨 softened blue for user
                      : "bg-neutral-900 text-white" // 🎨 cleaner gray for assistant
                  }`}
                >
                  {/* 💬 Text Content (supports lists, paragraphs) */}
                  {message.content.map((text, i) => {
                    const hasListItems = text.includes("- ") || 
                                        /\d+\.\s/.test(text) || 
                                        text.includes("* ") ||
                                        text.includes("• ");

                    if (hasListItems) {
                      const lines = text.split(/\n/);
                      return (
                        <div key={i} className="mb-2">
                          {lines.map((line, lineIndex) => {
                            const isListItem = line.trim().startsWith("- ") || 
                                               /^\d+\.\s/.test(line.trim()) ||
                                               line.trim().startsWith("* ") ||
                                               line.trim().startsWith("• ");

                            if (isListItem) {
                              return (
                                <div key={lineIndex} className="flex mb-1">
                                  <div className="mr-2 flex-shrink-0">
                                    {(line.trim().startsWith("- ") || line.trim().startsWith("* ") || line.trim().startsWith("• "))
                                      ? "•"
                                      : line.trim().match(/^\d+\./)?.[0]}
                                  </div>
                                  <div>{line.replace(/^[-*•]\s|^\d+\.\s/, "")}</div>
                                </div>
                              );
                            } else {
                              return <p key={lineIndex} className="mb-1">{line}</p>;
                            }
                          })}
                        </div>
                      );
                    } else {
                      return (
                        <p key={i} className="mb-1">
                          {text}
                        </p>
                      );
                    }
                  })}

                  {/* ⏳ Loading State */}
                  {message.id === "processing" && (
                    <div className="flex items-center mt-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse mr-1"></div> {/* ⚫ animated pulse dot */}
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-150 mr-1"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse delay-300"></div>
                    </div>
                  )}
                </div>
              </>

              // 🔧 Style notes:
              // px-5 = left/right padding
              // py-4 = top/bottom padding
              // text-2xl = large readable font
              // shadow-md = bubble depth

                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input area - fixed at bottom */}
      <div className="p-4 border-t border-zinc-800 bg-black/40 backdrop-blur-lg fixed bottom-0 left-0 right-0 z-20">
        {/* Display images to be sent - as thumbnails */}
        {tempImages.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center mb-2">
              <p className="text-sm text-gray-300">{tempImages.length} {tempImages.length === 1 ? 'image' : 'images'} ready to analyze</p>
              <p className="text-xs text-gray-400 ml-2">Add a message or send as is. Click images to preview full size.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {tempImages.map((img, index) => (
                <div key={index} className="relative">
                  <img
                    src={img}
                    alt={`Preview ${index + 1}`}
                    className="h-20 w-20 object-cover rounded-lg border border-gray-600 hover:opacity-90 transition-opacity"
                    onClick={() => window.open(img, '_blank')}
                    title="Click to view full-size image"
                  />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-gray-800 rounded-full p-1 text-gray-400 hover:text-gray-200 hover:bg-gray-700"
                    title="Remove image"
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
              ))}
            </div>
          </div>
        )}

        <div className="flex items-end space-x-2">
          <ImageUpload
            onImageSelect={handleImageSelect}
            className="text-gray-400 hover:text-gray-200 p-2"
          />
          <div className="flex-1 bg-gray-800 rounded-2xl overflow-hidden">
            <textarea
              ref={textareaRef}
              className="w-full bg-gray-800 text-white border-none px-4 py-3 focus:outline-none resize-none"
              placeholder="Message..."
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={sendMessageMutation.isPending || isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              style={{ 
                overflowY: 'hidden', // Changed from 'auto' for better auto-resizing
                minHeight: '40px',
              }}
              // Standard spelling attributes
              spellCheck="true"
              // iOS/Safari specific
              autoCorrect="on"
              autoCapitalize="sentences"
              // Chrome-specific attributes
              data-gramm="true"
              data-gramm_editor="true"
              data-enable-grammarly="true"
            />
          </div>
          <Button
            size="icon"
            variant="ghost"
            className="h-10 w-10 rounded-full bg-blue-500 text-white hover:bg-blue-600"
            onClick={sendMessage}
            disabled={sendMessageMutation.isPending || isLoading || (!input.trim() && tempImages.length === 0)}
          >
            {sendMessageMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}