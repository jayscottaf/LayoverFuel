import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { registerSchema, loginSchema, onboardingSchema } from "@shared/schema";
import { 
  calculateTDEE, 
  calculateMacros 
} from "./services/tdee-service";
import { 
  processOnboardingMessage, 
  generateDailyMotivation,
  processFeedback,
  type OnboardingQuestion 
} from "./services/openai-service";
import {
  getOrCreateThread,
  addMessageToThread,
  runAssistantOnThread,
  checkRunStatus,
  getMessagesFromThread
} from "./services/assistant-service";
import { generateMealPlan } from "./services/meal-service";
import { generateWorkoutPlan } from "./services/workout-service";
import { analyzeMealImage } from "./services/image-analysis-service";
import nutritionRoutes from "./routes/api/logs/nutrition";
declare module "express-session" {
  interface SessionData {
    userId: number;
    onboarding?: {
      currentQuestion: OnboardingQuestion;
      userData: any;
    };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware with PostgreSQL store
  app.use(
    session({
      store: storage.sessionStore,
      secret: process.env.SESSION_SECRET || "layover-fuel-secret",
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      },
    })
  );
  app.use("/api/logs/nutrition", nutritionRoutes);
  // Auth Routes
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const data = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }
      
      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.password, salt);
      
      // Create user
      const user = await storage.createUser({
        email: data.email,
        password: hashedPassword,
        name: "",
      });
      
      // Start onboarding
      req.session.userId = user.id;
      req.session.onboarding = {
        currentQuestion: {
          text: "Hi there! I'm your Layover Fuel fitness coach. I'll help you stay fit while traveling. Let's get to know each other better. What's your name?",
          field: "name",
        },
        userData: {},
      };
      
      res.status(201).json({ message: "User created", userId: user.id });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const data = loginSchema.parse(req.body);
      
      // Find user
      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
      }
      
      // Check password
      const isMatch = await bcrypt.compare(data.password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid email or password" });
      }
      
      // Set session
      req.session.userId = user.id;
      
      // Check if user has completed onboarding
      const isOnboardingComplete = Boolean(user.name && user.age && user.height && user.weight);
      
      if (!isOnboardingComplete) {
        req.session.onboarding = {
          currentQuestion: {
            text: "Welcome back! Let's continue where we left off. What's your name?",
            field: "name",
          },
          userData: {},
        };
      }
      
      res.status(200).json({ 
        message: "Login successful", 
        userId: user.id,
        isOnboardingComplete
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Could not log out" });
      }
      res.status(200).json({ message: "Logout successful" });
    });
  });

  // Onboarding Routes
  app.get("/api/onboarding/current-question", (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const onboarding = req.session.onboarding;
    if (!onboarding) {
      return res.status(400).json({ message: "No onboarding in progress" });
    }
    
    res.status(200).json({ question: onboarding.currentQuestion });
  });

  app.post("/api/onboarding/message", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }
    
    const onboarding = req.session.onboarding;
    if (!onboarding) {
      return res.status(400).json({ message: "No onboarding in progress" });
    }
    
    try {
      const response = await processOnboardingMessage(
        message,
        onboarding.currentQuestion,
        onboarding.userData
      );
      
      // Update session with the new data
      if (req.session.onboarding) {
        req.session.onboarding.userData = {
          ...onboarding.userData,
          [response.field]: response.value,
        };
        
        // If there's a next question, update it
        if (response.nextQuestion) {
          req.session.onboarding.currentQuestion = response.nextQuestion;
        }
      }
      
      // If onboarding is complete, save user data
      if (response.isComplete && req.session.onboarding) {
        const userData = req.session.onboarding.userData;
        
        // Update user record with all collected data
        await storage.updateUser(req.session.userId, {
          name: userData.name,
          email: userData.email,
          age: userData.biometrics?.age,
          height: userData.biometrics?.height,
          weight: userData.biometrics?.weight,
          gender: userData.gender,
          fitnessGoal: userData.fitnessGoal,
          activityLevel: userData.activityLevel,
          dietaryRestrictions: userData.dietaryRestrictions,
          gymMemberships: userData.gymMemberships,
          maxCommuteMinutes: userData.maxCommuteMinutes,
        });
        
        // Calculate TDEE and update user
        const user = await storage.getUser(req.session.userId);
        if (user) {
          const tdee = calculateTDEE(user);
          await storage.updateUser(req.session.userId, { tdee });
        }
        
        // Clear onboarding data from session
        delete req.session.onboarding;
      }
      
      res.status(200).json({
        field: response.field,
        value: response.value,
        nextQuestion: response.nextQuestion,
        isComplete: response.isComplete,
      });
    } catch (error) {
      console.error("Onboarding error:", error);
      res.status(500).json({ message: "Error processing message" });
    }
  });

  app.post("/api/onboarding/complete", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const data = onboardingSchema.parse(req.body);
      
      // Update user with onboarding data
      await storage.updateUser(req.session.userId, data);
      
      // Calculate TDEE and update user
      const user = await storage.getUser(req.session.userId);
      if (user) {
        const tdee = calculateTDEE(user);
        await storage.updateUser(req.session.userId, { tdee });
      }
      
      // Clear onboarding data from session if it exists
      if (req.session.onboarding) {
        delete req.session.onboarding;
      }
      
      res.status(200).json({ message: "Onboarding completed successfully" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      res.status(500).json({ message: "Server error" });
    }
  });

  // User Routes
  app.get("/api/user/profile", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Don't return password
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Dashboard Routes
  app.get("/api/dashboard", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Calculate nutritional needs based on TDEE
      const tdee = user.tdee || calculateTDEE(user);
      const macros = calculateMacros(user, tdee);
      
      // Get today's date for logs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get today's health log if it exists
      const healthLog = await storage.getHealthLogByDate(user.id, today);
      
      // Get today's nutrition log if it exists
      const nutritionLog = await storage.getNutritionLogByDate(user.id, today);
      
      // Get today's workout log if it exists
      const workoutLog = await storage.getWorkoutLogByDate(user.id, today);
      
      // Get today's plan or generate a new one
      let dailyPlan = await storage.getDailyPlanByDate(user.id, today);
      
      if (!dailyPlan) {
        // Generate a new plan
        const mealPlan = await generateMealPlan(
          user,
          macros.protein,
          macros.carbs,
          macros.fat,
          tdee
        );
        
        const workoutPlan = await generateWorkoutPlan(user);
        
        const motivation = await generateDailyMotivation(user);
        
        // Create a new daily plan
        dailyPlan = await storage.createDailyPlan({
          date: today.toISOString().split('T')[0], // Convert Date to string format
          userId: user.id,
          meals: mealPlan,
          workout: workoutPlan,
          gymRecommendations: workoutPlan.gymRecommendation,
          motivation,
        });
      }
      
      // Calculate progress percentages for stats
      const proteinProgress = nutritionLog?.protein 
        ? Math.round((nutritionLog.protein / macros.protein) * 100) 
        : 0;
      
      const calorieProgress = nutritionLog?.calories 
        ? Math.round((nutritionLog.calories / tdee) * 100) 
        : 0;
      
      // Response with dashboard data
      res.status(200).json({
        user: {
          name: user.name,
          goal: user.fitnessGoal,
        },
        stats: {
          tdee,
          macros,
          currentCalories: nutritionLog?.calories || 0,
          calorieProgress,
          currentProtein: nutritionLog?.protein || 0,
          proteinProgress,
          currentSteps: healthLog?.steps || 0,
          stepsProgress: healthLog?.steps ? Math.round((healthLog.steps / 10000) * 100) : 0,
          water: 0, // Would need to track this separately
          waterProgress: 0,
        },
        dailyPlan,
        healthLog,
        nutritionLog,
        workoutLog,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Health Log Routes
  app.post("/api/logs/health", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { date, ...logData } = req.body;
      const logDate = date ? new Date(date) : new Date();
      
      // Check if a log already exists for this date
      const existingLog = await storage.getHealthLogByDate(req.session.userId, logDate);
      
      let healthLog;
      if (existingLog) {
        // Update existing log
        healthLog = await storage.updateHealthLog(existingLog.id, logData);
      } else {
        // Create new log
        healthLog = await storage.createHealthLog({
          date: logDate.toISOString().split('T')[0], // Format date as string
          userId: req.session.userId,
          ...logData,
        });
      }
      
      res.status(200).json(healthLog);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Additional nutrition log handler to catch requests with the erroneous newline character
  app.post("/api/logs/nutrition%0A", (req, res) => {
    console.log("⚠️ Received request to the incorrect nutrition endpoint with newline character");
    console.log("⚠️ Redirecting to correct endpoint");
    
    // Redirect to the correct URL
    res.redirect(307, "/api/logs/nutrition");
  });

  // Workout Log Routes
  app.post("/api/logs/workout", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { date, ...logData } = req.body;
      const logDate = date ? new Date(date) : new Date();
      
      // Check if a log already exists for this date
      const existingLog = await storage.getWorkoutLogByDate(req.session.userId, logDate);
      
      let workoutLog;
      if (existingLog) {
        // Update existing log
        workoutLog = await storage.updateWorkoutLog(existingLog.id, logData);
      } else {
        // Create new log
        workoutLog = await storage.createWorkoutLog({
          date: logDate.toISOString().split('T')[0], // Format date as string
          userId: req.session.userId,
          ...logData,
        });
      }
      
      res.status(200).json(workoutLog);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Feedback Route
  app.post("/api/feedback", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { mood, message } = req.body;
      if (!mood) {
        return res.status(400).json({ message: "Mood is required" });
      }
      
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Process feedback with AI
      const feedbackResponse = await processFeedback(
        `Mood: ${mood}. ${message || ''}`,
        user
      );
      
      res.status(200).json({ 
        message: "Feedback received",
        response: feedbackResponse
      });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });
  
  // Meal Photo Analysis Route
  app.post("/api/meal-analysis", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      const { imageData } = req.body;
      if (!imageData) {
        return res.status(400).json({ message: "Image data is required" });
      }
      
      // Process the image with OpenAI's GPT-4 Vision
      const analysisResult = await analyzeMealImage(imageData);
      
      // Return the analysis
      res.status(200).json({
        message: "Meal analysis complete",
        result: analysisResult
      });
    } catch (error) {
      console.error("Meal analysis error:", error);
      res.status(500).json({ message: "Failed to analyze meal image" });
    }
  });

  // Assistant Chat API Routes
  
  // Initialize or retrieve a thread
  app.post("/api/assistant/thread", async (req: Request, res: Response) => {
    try {
      const { threadId } = req.body;
      const newThreadId = await getOrCreateThread(threadId);
      res.status(200).json({ threadId: newThreadId });
    } catch (error) {
      console.error("Error creating thread:", error);
      res.status(500).json({ message: "Failed to create or retrieve thread" });
    }
  });
  
  // Send a message to the assistant
  app.post("/api/assistant/message", async (req: Request, res: Response) => {
    try {
      const { threadId, message, imageData, imageDataArray } = req.body;
      
      if (!threadId) {
        return res.status(400).json({ message: "Thread ID is required" });
      }
      
      // Support both single imageData and multiple imageDataArray
      const images = imageDataArray || (imageData ? [imageData] : []);
      
      if (!message && images.length === 0) {
        return res.status(400).json({ message: "Message or at least one image is required" });
      }
      
      // Process and validate all image data
      const validatedImages: string[] = [];
      for (const img of images) {
        try {
          if (!img) continue;
          
          const imageSizeKB = Math.round(img.length / 1024);
          console.log(`Processing image of approximately ${imageSizeKB}KB`);
          
          // Check if image data is too large (OpenAI limit is ~20MB, but we'll be more conservative)
          if (imageSizeKB > 5000) { // 5MB limit
            return res.status(413).json({ 
              message: "Image is too large. Please use a smaller image (maximum 5MB)." 
            });
          }
          
          validatedImages.push(img);
        } catch (imgError) {
          console.error("Error processing image data:", imgError);
          // Continue with other images rather than failing completely
        }
      }
      
      try {
        // Add the message to the thread
        console.log(`Adding message to thread ${threadId}`);
        
        // For debugging, log the image data sizes
        if (validatedImages.length > 0) {
          console.log(`Processing ${validatedImages.length} images for upload`);
          console.log(`Images will be uploaded to Cloudinary and then sent to OpenAI`);
        }
        
        // When sending just images, don't add default text - the assistant should know what to do
        await addMessageToThread(threadId, message || "", validatedImages);
        console.log("Message and images added successfully");
      } catch (messageError) {
        console.error("Error adding message to thread:", messageError);
        
        // Provide more detailed error messages for common issues
        let errorMessage = "Failed to add message to thread";
        let statusCode = 500;
        
        if (messageError instanceof Error) {
          const errorText = messageError.message.toLowerCase();
          
          // Check for common errors
          if (errorText.includes('cloudinary')) {
            errorMessage = "Error uploading image to cloud storage. Please try again or use a different image.";
            statusCode = 502; // Bad Gateway - issue with external service
          } else if (errorText.includes('too large') || errorText.includes('file size')) {
            errorMessage = "Image is too large. Please try with a smaller image.";
            statusCode = 413; // Request Entity Too Large
          } else if (errorText.includes('rate limit') || errorText.includes('too many requests')) {
            errorMessage = "Rate limit exceeded. Please try again in a few moments.";
            statusCode = 429; // Too Many Requests
          } else if (errorText.includes('invalid') && errorText.includes('format')) {
            errorMessage = "Invalid image format. Please try a different image.";
            statusCode = 400; // Bad Request
          }
        }
        
        return res.status(statusCode).json({ 
          message: errorMessage, 
          error: messageError instanceof Error ? messageError.message : String(messageError) 
        });
      }
      
      // Run the assistant on the thread
      console.log(`Running assistant on thread ${threadId}`);
      let run;
      try {
        run = await runAssistantOnThread(threadId);
        console.log(`Run created with ID: ${run.id}`);
      } catch (runError) {
        console.error("Error running assistant:", runError);
        return res.status(500).json({ 
          message: "Failed to run assistant", 
          error: runError instanceof Error ? runError.message : String(runError) 
        });
      }
      
      // Poll for completion
      let runStatus;
      let attempts = 0;
      const maxAttempts = 30; // Maximum 30 attempts (30 seconds)
      
      try {
        runStatus = await checkRunStatus(threadId, run.id);
        console.log(`Initial run status: ${runStatus.status}`);
        
        while (runStatus.status !== "completed" && attempts < maxAttempts) {
          // Wait for 1 second
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check the status again
          runStatus = await checkRunStatus(threadId, run.id);
          attempts++;
          
          if (attempts % 5 === 0) {
            console.log(`Run status after ${attempts} attempts: ${runStatus.status}`);
          }
        }
      } catch (statusError) {
        console.error("Error checking run status:", statusError);
        return res.status(500).json({ 
          message: "Failed to check run status", 
          error: statusError instanceof Error ? statusError.message : String(statusError) 
        });
      }
      
      if (runStatus.status !== "completed") {
        return res.status(408).json({ message: "Assistant processing timed out" });
      }
      
      // Get the messages from the thread
      console.log(`Getting messages from thread ${threadId}`);
      let messages;
      try {
        messages = await getMessagesFromThread(threadId);
      } catch (messagesError) {
        console.error("Error getting messages:", messagesError);
        return res.status(500).json({ 
          message: "Failed to get messages", 
          error: messagesError instanceof Error ? messagesError.message : String(messagesError) 
        });
      }
      
      res.status(200).json({ messages: messages.data });
    } catch (error) {
      console.error("Error processing message:", error);
      res.status(500).json({ 
        message: "Failed to process message",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Get all messages from a thread
  app.get("/api/assistant/messages/:threadId", async (req: Request, res: Response) => {
    try {
      const { threadId } = req.params;
      
      if (!threadId) {
        return res.status(400).json({ message: "Thread ID is required" });
      }
      
      // Get the messages from the thread
      const messages = await getMessagesFromThread(threadId);
      
      res.status(200).json({ messages: messages.data });
    } catch (error) {
      console.error("Error retrieving messages:", error);
      res.status(500).json({ message: "Failed to retrieve messages" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
