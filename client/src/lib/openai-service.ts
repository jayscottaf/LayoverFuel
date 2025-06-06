import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// Initialize the OpenAI client (API key is provided by the server through the proxy)
const openai = new OpenAI({
  baseURL: "/api/openai-proxy", // This will proxy our requests through the server
  dangerouslyAllowBrowser: true // We're using a proxy so this is safe
});

// The assistant ID for Layover Fuel
const ASSISTANT_ID = "asst_PZYE18wO7th5Fm9JoOkLEfDJ";

// Interface for thread messages
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
}

// Create a new thread or return an existing one from localStorage
export async function getOrCreateThread(): Promise<string> {
  // Check if we have a thread ID in localStorage
  const storedThreadId = localStorage.getItem('threadId');
  
  if (storedThreadId) {
    return storedThreadId;
  }
  
  // Create a new thread
  try {
    const thread = await openai.beta.threads.create();
    // Store the thread ID in localStorage
    localStorage.setItem('threadId', thread.id);
    return thread.id;
  } catch (error) {
    console.error("Error creating thread:", error);
    throw error;
  }
}

// Add a message to the thread
export async function addMessageToThread(
  threadId: string,
  content: string,
  imageData?: string
): Promise<void> {
  try {
    const messageContent: any[] = [{ type: "text", text: content }];
    
    // If we have image data, add it to the message
    if (imageData) {
      messageContent.push({
        type: "image_url",
        image_url: {
          url: imageData.startsWith('data:') 
            ? imageData 
            : `data:image/jpeg;base64,${imageData}`
        }
      });
    }
    
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: messageContent
    });
  } catch (error) {
    console.error("Error adding message to thread:", error);
    throw error;
  }
}

// Run the assistant on the thread
export async function runAssistant(threadId: string): Promise<Message[]> {
  try {
    // Create a run
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: ASSISTANT_ID
    });
    
    // Poll for the run to complete
    let runStatus = await waitForRunCompletion(threadId, run.id);
    
    if (runStatus === 'completed') {
      // Get the messages from the thread
      return await getMessagesFromThread(threadId);
    } else {
      throw new Error(`Run ended with status: ${runStatus}`);
    }
  } catch (error) {
    console.error("Error running assistant:", error);
    throw error;
  }
}

// Wait for a run to complete (polling)
async function waitForRunCompletion(threadId: string, runId: string): Promise<string> {
  let isCompleted = false;
  let run;
  
  while (!isCompleted) {
    // Wait for a second before polling
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get the run status
    run = await openai.beta.threads.runs.retrieve(threadId, runId);
    
    if (run.status === 'completed' || 
        run.status === 'failed' || 
        run.status === 'cancelled' || 
        run.status === 'expired') {
      isCompleted = true;
    }
  }
  
  return run!.status;
}

// Get messages from the thread
export async function getMessagesFromThread(threadId: string): Promise<Message[]> {
  try {
    const messages = await openai.beta.threads.messages.list(threadId);
    
    // Transform the messages to our simpler format
    return messages.data.map(message => {
      // Extract text content
      const textContent = message.content
        .filter(item => item.type === 'text')
        .map(item => (item.type === 'text' ? item.text.value : ''))
        .join('\n');
      
      // Extract image URL if present
      const imageContent = message.content.find(item => item.type === 'image_file');
      const imageUrl = imageContent?.type === 'image_file' ? imageContent.image_file.file_id : undefined;
      
      return {
        role: message.role as 'user' | 'assistant',
        content: textContent,
        imageUrl
      };
    });
  } catch (error) {
    console.error("Error getting messages from thread:", error);
    throw error;
  }
}