import { cn } from "@/lib/utils";

interface ChatBubbleProps {
  message: string;
  isUser?: boolean;
  isTyping?: boolean;
}

export function ChatBubble({
  message,
  isUser = false,
  isTyping = false
}: ChatBubbleProps) {
  return (
    <div className={cn(
      "chat-message flex items-start",
      isUser && "justify-end"
    )}>
      {!isUser && (
        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mr-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
        </div>
      )}
      <div className={cn(
        "rounded-lg p-4 max-w-[80%] inline-block",
        isUser ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-800"
      )}>
        {isTyping ? (
          <div className="flex items-center space-x-3">
            <div className="dot-typing"></div>
            <span className="text-gray-600 text-sm">Typing...</span>
          </div>
        ) : (
          <p>{message}</p>
        )}
      </div>
      {isUser && (
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 ml-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
}
