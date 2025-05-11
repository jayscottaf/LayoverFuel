import fetch from 'node-fetch';
import { uploadImageToCloudinary } from './cloudinary-service';

// API endpoint for OpenAI API proxying
export const OPENAI_API_BASE = 'https://api.openai.com';

// Forward a request to the OpenAI API
export async function proxyRequestToOpenAI(
  method: string,
  path: string,
  body?: any,
  apiKey: string = process.env.OPENAI_API_KEY || ''
) {
  try {
    // Create headers for the OpenAI request
    const headers: { [key: string]: string } = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2',
    };
    
    // Create a URL for the OpenAI request
    const url = `${OPENAI_API_BASE}${path}`;
    
    // Make the request to OpenAI
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    
    // Get the response
    const data = await response.json();
    
    return {
      status: response.status,
      data,
    };
  } catch (error) {
    console.error('Error proxying request to OpenAI:', error);
    throw error;
  }
}

// Get the thread ID from the session or create a new one
export async function getOrCreateThread(existingThreadId?: string) {
  if (existingThreadId) {
    return existingThreadId;
  }
  
  // Create a new thread
  const response = await proxyRequestToOpenAI('POST', '/v1/threads', {});
  
  if (response.status !== 200) {
    throw new Error(`Failed to create thread: ${JSON.stringify(response.data)}`);
  }
  
  return response.data.id;
}

// Add a message to a thread
export async function addMessageToThread(
  threadId: string, 
  content: string,
  imageData?: string | string[]
) {
  // Create a message content array
  let messageContent: any[] = [];

  // Add text content if provided
  if (content && content.trim() !== '') {
    messageContent.push({ type: "text", text: content });
  }
  
  // Handle either a single image or an array of images
  const imagesToProcess = Array.isArray(imageData) ? imageData : (imageData ? [imageData] : []);
  
  // If we have image data, upload each to Cloudinary and add to message content
  if (imagesToProcess.length > 0) {
    console.log(`Processing ${imagesToProcess.length} images...`);
    
    // Track successful and failed uploads
    let successfulUploads = 0;
    let failedUploads = 0;
    
    // Process each image in the array
    for (const imgData of imagesToProcess) {
      try {
        if (!imgData) continue;
        
        // Check image data size
        const imageSize = imgData.length;
        console.log(`Processing image ${successfulUploads + failedUploads + 1}: ${Math.round(imageSize / 1024)}KB`);
        
        // First, make sure we have a valid data URL
        let processedImageData = imgData;
        if (!imgData.startsWith('data:')) {
          processedImageData = `data:image/jpeg;base64,${imgData}`;
        }
        
        console.log(`Uploading image ${successfulUploads + failedUploads + 1} to Cloudinary...`);
        
        // Upload the image to Cloudinary and get a public URL
        const imageUrl = await uploadImageToCloudinary(processedImageData);
        console.log(`Image ${successfulUploads + 1} uploaded successfully to Cloudinary: ${imageUrl}`);
        
        // Add to content array as image_url with the public Cloudinary URL
        messageContent.push({
          type: "image_url",
          image_url: {
            url: imageUrl
          }
        });
        
        successfulUploads++;
        console.log(`Image ${successfulUploads} successfully added to message content`);
      } catch (error) {
        failedUploads++;
        console.error(`Error processing image ${successfulUploads + failedUploads}:`, error);
        
        // Continue with other images rather than stopping completely
        if (error instanceof Error) {
          console.error(`Cloudinary upload failed: ${error.message}`);
        } else {
          console.error(`Cloudinary upload failed: Unknown error`);
        }
      }
    }
    
    // Only add error message if ALL uploads failed
    if (failedUploads > 0 && successfulUploads === 0) {
      console.error(`All ${failedUploads} image uploads failed`);
      
      // In case of complete failure, we'll still send the user's message text if available
      // But we'll add a note about the image upload failure
      if (!messageContent.some(item => item.type === "text")) {
        messageContent.push({
          type: "text",
          text: "I tried to upload food images for analysis, but there was a technical issue. Could you help me with my nutrition or workout questions instead?"
        });
      } else {
        // Add a note about the image upload failure to the existing message
        messageContent.push({
          type: "text",
          text: "Note: There was an issue processing your images. Let me answer your other questions."
        });
      }
    } else if (failedUploads > 0 && successfulUploads > 0) {
      // Some uploads succeeded, some failed
      console.log(`${successfulUploads} images uploaded successfully, ${failedUploads} failed`);
      
      // Only add a note if there's already text content
      if (messageContent.some(item => item.type === "text")) {
        messageContent.push({
          type: "text",
          text: `Note: ${failedUploads} of your ${failedUploads + successfulUploads} images couldn't be processed, but I'll analyze the rest.`
        });
      }
    } else if (successfulUploads > 0) {
      console.log(`All ${successfulUploads} images uploaded successfully`);
    }
  }
  
  if (messageContent.length === 0) {
    throw new Error('Message must include text or at least one valid image');
  }
  
  console.log(`Adding message to thread ${threadId} with content types: ${messageContent.map(c => c.type).join(', ')}`);
  
  try {
    const response = await proxyRequestToOpenAI(
      'POST', 
      `/v1/threads/${threadId}/messages`,
      {
        role: "user",
        content: messageContent
      }
    );
    
    if (response.status !== 200) {
      console.error('OpenAI API error:', response.data);
      throw new Error(`Failed to add message to thread: ${JSON.stringify(response.data)}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error adding message to thread:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unknown error: ${String(error)}`);
    }
  }
}

// Run the assistant on a thread
export async function runAssistantOnThread(
  threadId: string, 
  assistantId: string = 'asst_PZYE18wO7th5Fm9JoOkLEfDJ'
) {
  const response = await proxyRequestToOpenAI(
    'POST',
    `/v1/threads/${threadId}/runs`,
    {
      assistant_id: assistantId
    }
  );
  
  if (response.status !== 200) {
    throw new Error(`Failed to run assistant: ${JSON.stringify(response.data)}`);
  }
  
  return response.data;
}

// Check the status of a run
export async function checkRunStatus(threadId: string, runId: string) {
  const response = await proxyRequestToOpenAI(
    'GET',
    `/v1/threads/${threadId}/runs/${runId}`
  );
  
  if (response.status !== 200) {
    throw new Error(`Failed to check run status: ${JSON.stringify(response.data)}`);
  }
  
  return response.data;
}

// Store the IDs of messages that have already been processed for nutrition logging
const processedMessageIds = new Set<string>();

// Get messages from a thread without any additional processing
export async function getMessagesFromThread(threadId: string) {
  const response = await proxyRequestToOpenAI(
    'GET',
    `/v1/threads/${threadId}/messages`
  );

  if (response.status !== 200) {
    throw new Error(`Failed to get messages: ${JSON.stringify(response.data)}`);
  }

  return response.data;
}

// Process a message for nutrition logging - only call this once per message
export async function processMessageForNutritionLogging(message: any): Promise<boolean> {
  // Skip if not an assistant message or already processed
  if (message.role !== 'assistant' || processedMessageIds.has(message.id)) {
    return false;
  }

  // Mark this message as processed to prevent duplicates
  processedMessageIds.add(message.id);
  console.log(`⚡ Processing NEW assistant message ${message.id} for nutrition logging`);
  
  let nutritionLogged = false;

  // Process the message content
  for (const part of message.content) {
    if (part.type === 'text' && part.text?.value) {
      try {
        // Get the text content from the message
        const text = part.text.value.trim();
        console.log(`Examining message content (${text.length} chars):\n${text.substring(0, 300)}${text.length > 300 ? '...' : ''}`);
        
        // Check for code blocks with json syntax highlighting
        const codeBlockMatches = text.match(/```json\s*([\s\S]*?)\s*```/g);
        let jsonMatches: string[] = [];
        
        // If we have code blocks, extract the content from them
        if (codeBlockMatches && codeBlockMatches.length > 0) {
          console.log(`Found ${codeBlockMatches.length} JSON code blocks`);
          
          for (const block of codeBlockMatches) {
            // Extract content between the code block markers
            const codeContent = block.replace(/```json\s*/, '').replace(/\s*```$/, '').trim();
            jsonMatches.push(codeContent);
          }
        }
        
        // Also look for raw JSON objects not in code blocks
        const rawJsonMatches = text.match(/\{[\s\S]*?\}/g);
        if (rawJsonMatches) {
          console.log(`Found ${rawJsonMatches.length} potential raw JSON objects`);
          jsonMatches = [...jsonMatches, ...rawJsonMatches];
        }
        
        if (jsonMatches && jsonMatches.length > 0) {
          console.log(`Processing ${jsonMatches.length} potential JSON objects`);
          
          for (const potentialJson of jsonMatches) {
            try {
              // Clean JSON
              const cleanJson = potentialJson
                .replace(/\/\/.*$/gm, '') // Remove single-line comments
                .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multiline comments
                .replace(/,\s*}/g, '}') // Remove trailing commas before closing braces
                .replace(/,\s*]/g, ']') // Remove trailing commas before closing arrays
                .trim();

              // Validate JSON structure
              if (!cleanJson || !cleanJson.startsWith('{') || !cleanJson.endsWith('}')) {
                console.warn("Skipping invalid JSON (empty or malformed)");
                continue;
              }
              
              // Parse JSON
              const parsed = JSON.parse(cleanJson);

              // Fix invalid or placeholder date
              if (!parsed.date || 
                  parsed.date.trim() === "" || 
                  parsed.date === "YYYY-MM-DD" || 
                  /^\d{4}-[A-Z]{2}-[A-Z]{2}$/i.test(parsed.date) ||
                  isNaN(new Date(parsed.date).getTime())) {
                // Format today as YYYY-MM-DD
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                console.warn(`⚠️ Invalid or placeholder date detected "${parsed.date}". Replacing with today's date: ${today}`);
                parsed.date = today;
              }

              // Validate required fields for log_nutrition action
              if (parsed && parsed.action === 'log_nutrition') {
                const requiredFields = ['action', 'date', 'calories', 'protein', 'carbs', 'fat', 'fiber', 'mealStyle', 'notes'];
                const toFloat = (val: any) => isNaN(parseFloat(val)) ? 0 : parseFloat(val);

                parsed.calories = toFloat(parsed.calories);
                parsed.protein = toFloat(parsed.protein);
                parsed.carbs = toFloat(parsed.carbs);
                parsed.fat = toFloat(parsed.fat);
                parsed.fiber = toFloat(parsed.fiber);
                
                const missingFields = requiredFields.filter(field => !(field in parsed));
                if (missingFields.length > 0) {
                  console.warn(`Skipping log_nutrition action due to missing fields: ${missingFields.join(', ')}`);
                  continue;
                }

                console.log("✨ Detected log_nutrition action. Logging to backend...");
                const baseUrl = 'http://localhost:5000';
                console.log(`🔄 Sending nutrition log to ${baseUrl}/api/logs/nutrition`);

                // Only process once per message to prevent duplicates
                if (!nutritionLogged) {
                  const logResponse = await fetch(`${baseUrl}/api/logs/nutrition`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(parsed),
                  });

                  if (logResponse.ok) {
                    const logResult = await logResponse.json();
                    console.log("✅ Nutrition log successfully sent:", logResult);
                    nutritionLogged = true;
                  } else {
                    console.error("❌ Failed to log nutrition:", await logResponse.text());
                  }
                } else {
                  console.log("⚠️ Skipping duplicate nutrition log within the same message");
                }
              }
            } catch (jsonError) {
              console.error("❌ Failed to parse JSON object:", jsonError);
              continue;
            }
          }
        }
      } catch (err) {
        console.error("Error processing message content:", err);
        // Continue processing other parts even if this one fails
      }
    }
  }

  return nutritionLogged;
}
