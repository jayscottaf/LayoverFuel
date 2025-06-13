import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { ChatBubble } from "./ChatBubble";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface OnboardingChatProps {
  initialQuestion: string;
}

export function OnboardingChat({ initialQuestion }: OnboardingChatProps) {
  const [messages, setMessages] = useState<Array<{ text: string; isUser: boolean }>>([
    { text: initialQuestion, isUser: false }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Scroll to bottom when messages change
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim() || isLoading) return;
    
    // Add user message to chat
    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { text: userMessage, isUser: true }]);
    setInputValue("");
    setIsLoading(true);
    
    try {
      // Send message to backend
      const response = await apiRequest("POST", "/api/onboarding/message", {
        message: userMessage
      });
      
      if (!response.ok) {
        throw new Error("Failed to send message");
      }
      
      const data = await response.json();
      
      // If there's a next question, add it to the chat
      if (data.nextQuestion) {
        setMessages(prev => [...prev, { text: data.nextQuestion.text, isUser: false }]);
      }
      
      // If onboarding is complete, show a success message
      if (data.isComplete) {
        setIsComplete(true);
        setTimeout(() => {
          navigate("/dashboard");
        }, 2000);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    navigate("/dashboard");
  };

  return (
    <div className="w-2/3 p-8 overflow-y-auto flex flex-col">
      <div className="max-w-2xl mx-auto w-full flex-1 flex flex-col">
        <div 
          className="flex-1 overflow-y-auto" 
          id="chat-container"
          ref={chatContainerRef}
        >
          <div className="space-y-6 pb-4">
            {messages.map((message, index) => (
              <ChatBubble
                key={index}
                message={message.text}
                isUser={message.isUser}
              />
            ))}
            
            {isLoading && (
              <ChatBubble
                message=""
                isUser={false}
                isTyping={true}
              />
            )}
          </div>
        </div>
        
        <div className="mt-4 border-t pt-4">
          <form id="chat-form" className="flex items-center" onSubmit={handleSubmit}>
            <input
              type="text"
              className="flex-1 border border-gray-300 rounded-l-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Type your response..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading || isComplete}
            />
            <button 
              type="submit" 
              className="bg-primary-500 hover:bg-primary-600 text-white px-6 py-3 rounded-r-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading || isComplete || !inputValue.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </form>
          
          <div className="mt-3 text-center">
            <button 
              onClick={handleSkip}
              className="text-gray-500 text-sm hover:text-gray-700"
              disabled={isComplete}
            >
              Skip and complete later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
