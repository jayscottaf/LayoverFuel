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
  getMessagesFromThread,
  processMessageForNutritionLogging
} from "./services/assistant-service";
import { generateMealPlan } from "./services/meal-service";
import { generateWorkoutPlan } from "./services/workout-service";
import { analyzeMealImage } from "./services/image-analysis-service";
import nutritionRoutes from "./routes/api/logs/nutrition";
import healthRoutes from "./routes/api/logs/health";
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
  app.use("/api/logs/health", healthRoutes);
  // Auth Routes
  // Dev-only instant login — only works in development
  app.post("/api/auth/dev-login", async (req: Request, res: Response) => {
    if (process.env.NODE_ENV !== "development") {
      return res.status(404).json({ message: "Not found" });
    }
    try {
      const devEmail = "dev@layoverfuel.dev";
      let user = await storage.getUserByEmail(devEmail);
      if (!user) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash("devpassword", salt);
        user = await storage.createUser({ email: devEmail, password: hashedPassword, name: "Dev User" });
      }
      req.session.userId = user.id;
      await new Promise<void>((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      console.error("Dev login error:", error);
      res.status(500).json({ message: "Dev login failed" });
    }
  });

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
        name: data.name || "",
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
      console.error("[REGISTER ERROR]", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      // Log helpful details about the error
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
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
      console.error("[LOGIN ERROR]", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      // Log helpful details about the error
      if (error instanceof Error) {
        console.error("Error name:", error.name);
        console.error("Error message:", error.message);
        console.error("Error stack:", error.stack);
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

  // Health check endpoint - useful for deployment debugging
  app.get("/api/health", async (req: Request, res: Response) => {
    const health: any = {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      checks: {}
    };

    try {
      // Check database connection by attempting to query users table
      try {
        const userCount = await storage.getUser(1); // Try to access database
        health.checks.database = {
          status: "connected",
          details: "Database connection successful"
        };
        health.checks.usersTable = {
          status: "ok",
          details: "Users table accessible"
        };
      } catch (dbError) {
        health.checks.database = {
          status: "error",
          message: dbError instanceof Error ? dbError.message : "Database connection failed",
          hint: "Check DATABASE_URL in Replit Secrets"
        };
        health.checks.usersTable = {
          status: "error",
          message: "Users table may not exist",
          hint: "Run: npm run db:push on Replit"
        };
      }

      // Check environment variables
      health.checks.environment = {
        databaseUrl: process.env.DATABASE_URL ? "set" : "missing",
        sessionSecret: process.env.SESSION_SECRET ? "set" : "using default",
        openaiKey: process.env.OPENAI_API_KEY ? "set" : "missing",
        cloudinary: process.env.CLOUDINARY_CLOUD_NAME ? "set" : "missing"
      };

      // Check session store
      health.checks.sessionStore = {
        status: "configured",
        details: "PostgreSQL session store initialized"
      };

    } catch (error) {
      health.status = "error";
      health.checks.general = {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error"
      };
      return res.status(503).json(health);
    }

    res.status(200).json(health);
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

  // Auth check endpoint
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch {
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
      if (!user) return res.status(404).json({ message: "User not found" });
      const { password, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/user/profile", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const allowed = ["name", "age", "height", "weight", "gender", "fitnessGoal", "activityLevel", "dietaryRestrictions", "gymMemberships", "maxCommuteMinutes", "quickLogMode"];
      const updates: Record<string, any> = {};
      for (const key of allowed) {
        if (req.body[key] !== undefined) updates[key] = req.body[key];
      }
      const user = await storage.updateUser(req.session.userId, updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      // Recalculate and persist TDEE whenever any profile field changes
      const freshTDEE = calculateTDEE(user);
      const updatedUser = await storage.updateUser(req.session.userId, { tdee: freshTDEE });
      const { password, ...userWithoutPassword } = updatedUser ?? user;
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
      
      // Always recalculate fresh — never use stale cached value
      const tdee = calculateTDEE(user);
      const macros = calculateMacros(user, tdee);
      
      // Get today's date for logs
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get today's health log if it exists
      const healthLog = await storage.getHealthLogByDate(user.id, today);
      
      // Get ALL nutrition logs for today (supports multiple meals per day)
      const nutritionLogs = await storage.getNutritionLogsByDate(user.id, today);

      // Aggregate nutrition totals from all logs
      const nutritionTotals = nutritionLogs.reduce((acc, log) => ({
        calories: acc.calories + (log.calories || 0),
        protein: acc.protein + (log.protein || 0),
        carbs: acc.carbs + (log.carbs || 0),
        fat: acc.fat + (log.fat || 0),
      }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

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
          macros.targetCalories
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
      const proteinProgress = nutritionTotals.protein
        ? Math.round((nutritionTotals.protein / macros.protein) * 100)
        : 0;

      const calorieProgress = nutritionTotals.calories
        ? Math.round((nutritionTotals.calories / macros.targetCalories) * 100)
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
          currentCalories: nutritionTotals.calories,
          calorieProgress,
          currentProtein: nutritionTotals.protein,
          proteinProgress,
          currentSteps: healthLog?.steps || 0,
          stepsProgress: healthLog?.steps ? Math.round((healthLog.steps / 10000) * 100) : 0,
          water: healthLog?.water || 0,
          waterProgress: healthLog?.water ? Math.round((healthLog.water / 8) * 100) : 0,
        },
        dailyPlan,
        healthLog,
        nutritionLog: {
          ...nutritionTotals,
          meals: nutritionLogs, // Array of all individual meal logs
        },
        workoutLog,
      });
    } catch (error) {
      console.error("Dashboard error:", error);
      res.status(500).json({ message: "Server error" });
    }
  });

  // Water tracking shortcut
  app.post("/api/logs/water", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { glasses } = req.body;
      const today = new Date();
      const existingLog = await storage.getHealthLogByDate(req.session.userId, today);
      const todayStr = today.toISOString().split('T')[0];
      let healthLog;
      if (existingLog) {
        healthLog = await storage.updateHealthLog(existingLog.id, { water: glasses });
      } else {
        healthLog = await storage.createHealthLog({ date: todayStr, userId: req.session.userId, water: glasses });
      }
      res.status(200).json(healthLog);
    } catch (error) {
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
  
  // Initialize or retrieve a thread — persists to user account when logged in
  app.post("/api/assistant/thread", async (req: Request, res: Response) => {
    try {
      // If user is logged in, prefer their saved thread ID over the client-provided one
      let clientThreadId = req.body.threadId as string | undefined;
      
      if (req.session.userId) {
        const user = await storage.getUser(req.session.userId);
        if (user?.assistantThreadId) {
          // Verify OpenAI still knows about this thread (getOrCreateThread handles invalid IDs)
          const resolvedId = await getOrCreateThread(user.assistantThreadId);
          if (resolvedId !== user.assistantThreadId) {
            // Thread was re-created; save new ID
            await storage.updateUser(req.session.userId, { assistantThreadId: resolvedId });
          }
          return res.status(200).json({ threadId: resolvedId });
        }
        // No saved thread — create one from client hint or fresh
        const newThreadId = await getOrCreateThread(clientThreadId);
        await storage.updateUser(req.session.userId, { assistantThreadId: newThreadId });
        return res.status(200).json({ threadId: newThreadId });
      }

      // Guest (not logged in) — just create/return thread without saving
      const newThreadId = await getOrCreateThread(clientThreadId);
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

      // Build user profile context if logged in
      let profileContext = "";
      if (req.session.userId) {
        try {
          const user = await storage.getUser(req.session.userId);
          if (user) {
            const GOAL_LABELS: Record<string, string> = {
              lose_weight: "Lose Weight", maintain: "Maintain Weight",
              gain_muscle: "Build Muscle", endurance: "Improve Endurance",
            };
            const ACTIVITY_LABELS: Record<string, string> = {
              sedentary: "Sedentary", lightly_active: "Lightly Active",
              moderately_active: "Moderately Active", very_active: "Very Active",
              extra_active: "Extra Active",
            };
            const userTDEE = calculateTDEE(user);
            const userMacros = calculateMacros(user, userTDEE);
            profileContext = [
              `[User Profile]`,
              `Name: ${user.name}`,
              user.age ? `Age: ${user.age}` : null,
              user.gender ? `Gender: ${user.gender}` : null,
              user.weight ? `Weight: ${user.weight} lbs` : null,
              user.height ? `Height: ${user.height} cm` : null,
              user.fitnessGoal ? `Goal: ${GOAL_LABELS[user.fitnessGoal] ?? user.fitnessGoal}` : null,
              user.activityLevel ? `Activity: ${ACTIVITY_LABELS[user.activityLevel] ?? user.activityLevel}` : null,
              user.dietaryRestrictions?.length ? `Dietary: ${user.dietaryRestrictions.join(", ")}` : null,
              user.gymMemberships?.length ? `Gym memberships: ${user.gymMemberships.join(", ")}` : null,
              `Daily targets: ${userMacros.targetCalories} kcal | Protein: ${userMacros.protein}g | Carbs: ${userMacros.carbs}g | Fat: ${userMacros.fat}g`,
              `[End Profile]`,
            ].filter(Boolean).join("\n");
          }
        } catch { /* continue without profile context */ }
      }
      
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
        
        // Prepend user profile context (invisible to UI, helpful to AI)
        const fullMessage = profileContext
          ? `${profileContext}\n\n${message || ""}`
          : (message || "");
        await addMessageToThread(threadId, fullMessage, validatedImages);
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
        
        // Only process the first message (newest) for nutrition logging
        if (messages.data && messages.data.length > 0) {
          const latestMessage = messages.data[0];
          // Process latest message for nutrition logging only if it's from the assistant
          if (latestMessage.role === 'assistant') {
            await processMessageForNutritionLogging(latestMessage);
          }
        }
        
        // Just log that messages were retrieved, not their entire content
        console.log(`Retrieved ${messages.data?.length || 0} messages from thread ${threadId}`);
      } catch (messagesError) {
        console.error("Error getting messages:", messagesError);
        if (messagesError instanceof Error && messagesError.message.includes("SyntaxError")) {
          return res.status(400).json({ 
            message: "Invalid response format from assistant. Please try rephrasing your request or contact support.",
            error: messagesError.message
          });
        }
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
  
  // Get all messages from a thread - for display only, no nutrition processing
  app.get("/api/assistant/messages/:threadId", async (req: Request, res: Response) => {
    try {
      const { threadId } = req.params;
      
      if (!threadId) {
        return res.status(400).json({ message: "Thread ID is required" });
      }
      
      // Get the messages from the thread (without processing for nutrition)
      const messages = await getMessagesFromThread(threadId);
      
      // DO NOT process messages for nutrition logging when just displaying them
      // This prevents duplicate processing
      
      res.status(200).json({ messages: messages.data });
    } catch (error) {
      console.error("Error retrieving messages:", error);
      res.status(500).json({ message: "Failed to retrieve messages" });
    }
  });

  interface OFFNutriments {
    "energy-kcal_serving"?: number;
    "energy-kcal_100g"?: number;
    "energy_serving"?: number;
    "energy_100g"?: number;
    "proteins_serving"?: number;
    "proteins_100g"?: number;
    "carbohydrates_serving"?: number;
    "carbohydrates_100g"?: number;
    "fat_serving"?: number;
    "fat_100g"?: number;
  }
  interface OFFResponse {
    status: number;
    product?: {
      product_name?: string;
      brands?: string;
      serving_size?: string;
      serving_quantity?: string | number;
      nutriments?: OFFNutriments;
    };
  }

  // Barcode lookup — proxies Open Food Facts to avoid CORS issues
  app.get("/api/barcode/:code", async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`
      );
      const data = await response.json() as OFFResponse;

      if (data.status !== 1 || !data.product) {
        return res.status(200).json({ notFound: true });
      }

      const p = data.product;
      const n = p.nutriments || {};
      const servingQty = p.serving_quantity ? Number(p.serving_quantity) : 100;
      const scale = servingQty / 100;

      // Prefer per-serving values; fall back to per-100g × scale
      const calories =
        n["energy-kcal_serving"] ??
        (n["energy-kcal_100g"] !== undefined
          ? n["energy-kcal_100g"] * scale
          : n["energy_serving"] !== undefined
          ? n["energy_serving"] / 4.184
          : n["energy_100g"] !== undefined
          ? (n["energy_100g"] / 4.184) * scale
          : null);

      const protein =
        n["proteins_serving"] ??
        (n["proteins_100g"] !== undefined ? n["proteins_100g"] * scale : null);

      const carbs =
        n["carbohydrates_serving"] ??
        (n["carbohydrates_100g"] !== undefined ? n["carbohydrates_100g"] * scale : null);

      const fat =
        n["fat_serving"] ??
        (n["fat_100g"] !== undefined ? n["fat_100g"] * scale : null);

      if (calories === null || protein === null || carbs === null || fat === null) {
        return res.status(200).json({ notFound: true });
      }

      return res.status(200).json({
        name: p.product_name || "Unknown Product",
        brand: p.brands || "",
        servingSize: p.serving_size || `${Math.round(servingQty)}g`,
        calories: Math.round(calories),
        protein: Math.round(protein * 10) / 10,
        carbs: Math.round(carbs * 10) / 10,
        fat: Math.round(fat * 10) / 10,
      });
    } catch (error) {
      console.error("Barcode lookup error:", error);
      return res.status(200).json({ notFound: true });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
