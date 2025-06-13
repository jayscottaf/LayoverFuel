import { cn } from "@/lib/utils";

// Props interface for the ChatBubble component
interface ChatBubbleProps {
  message: string; // The text content to display in the bubble
  isUser?: boolean; // Whether this message is from the user (affects styling and positioning)
  isTyping?: boolean; // Whether to show typing indicator instead of message content
}

/**
 * ChatBubble Component
 * 
 * A reusable chat message bubble component that displays messages in a conversation UI.
 * Supports both user and assistant messages with different styling and positioning.
 * Can also display a typing indicator when the AI is processing a response.
 * 
 * Features:
 * - Distinct styling for user vs assistant messages
 * - Avatar icons for both user and assistant
 * - Typing indicator with animated dots
 * - Responsive design with proper spacing
 * - Conditional positioning (user messages align right, assistant messages align left)
 */
export function ChatBubble({
  message,
  isUser = false,
  isTyping = false
}: ChatBubbleProps) {
  return (
    <div className={cn(
      "chat-message flex items-start",
      isUser && "justify-end" // User messages align to the right
    )}>
      {/* Assistant Avatar - only shown for non-user messages */}
      {!isUser && (
        <div className="w-10 h-10 rounded-full bg-bla-100 flex items-center justify-center flex-shrink-0 mr-4">
          {/* Thumbs up icon representing the AI assistant */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905a3.61 3.61 0 01-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
          </svg>
        </div>
      )}
      
      {/* Message Bubble */}
      <div className={cn(
        "rounded-lg p-6 max-w-[80%] inline-block",
        // Conditional styling based on message sender
        isUser ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-800"
      )}>
        {isTyping ? (
          // Typing indicator with animated dots and text
          <div className="flex items-center space-x-3">
            <div className="dot-typing"></div> {/* CSS animated dots (defined elsewhere) */}
            <span className="text-gray-600 text-sm">Typing...</span>
          </div>
        ) : (
          // Regular message content
          <p>{message}</p>
        )}
      </div>
      
      {/* User Avatar - only shown for user messages */}
      {isUser && (
        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 ml-4">
          {/* User profile icon */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
}
