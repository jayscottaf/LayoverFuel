import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import session from "express-session";
import passport from "passport";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { registerSchema, loginSchema, onboardingSchema, insertWorkoutLogSchema } from "@shared/schema";
import { dateKeySchema, dateKeyToDate, localDateKey, timezoneSchema } from "@shared/dates";
import { 
  calculateTDEE, 
  calculateMacros 
} from "./services/tdee-service";
import {
  processOnboardingMessage,
  generateDailyMotivation,
  processFeedback,
  onboardingQuestions,
  type OnboardingQuestion
} from "./services/openai-service";
import { analyzeMealImage } from "./services/image-analysis-service";
import nutritionRoutes from "./routes/api/logs/nutrition";
import healthRoutes from "./routes/api/logs/health";
import adaptiveTDEERoutes from "./routes/api/tdee/adaptive";
import itineraryRoutes from "./routes/api/itinerary";
import googleAuthRoutes from "./auth/google-routes";
import { registerGoogleStrategies } from "./auth/google-strategies";
import { getValidAccessToken } from "./services/google-oauth";
import { detectFlights, fetchUpcomingEvents } from "./services/google-calendar";
import { env } from "./config/env";
import dashboardRoutes from "./routes/api/dashboard";
import travelPlanRoutes from "./routes/api/travel-plan";
import nutritionEstimateRoutes from "./routes/api/nutrition-estimate";
import { accountBoundary, accountRateLimit, retiredAssistant } from "./middleware/account-boundary";
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
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      },
    })
  );
  app.use("/api", accountBoundary);
  app.use("/api/assistant", retiredAssistant);
  app.use("/api/nutrition/estimate", accountRateLimit(), nutritionEstimateRoutes);
  app.use("/api/meal-analysis", accountRateLimit(10));
  app.use("/api/travel-plan", travelPlanRoutes);
  app.use("/api", dashboardRoutes);
  app.use("/api/logs/nutrition", nutritionRoutes);
  app.use("/api/logs/health", healthRoutes);
  app.use("/api/tdee/adaptive", adaptiveTDEERoutes);
  app.use("/api/itinerary", itineraryRoutes);

  // Google OAuth (login + connect calendar). No passport sessions — we keep
  // our own session.userId pattern.
  registerGoogleStrategies();
  app.use(passport.initialize());
  app.use(googleAuthRoutes);
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
      await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
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
      if (!user || !user.password) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      // Check password
      const isMatch = await bcrypt.compare(data.password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid email or password" });
      }
      
      // Set session
      await new Promise<void>((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
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

  // Readiness checks validate the tables this release actually needs.
  app.get("/api/health", async (_req: Request, res: Response) => {
    try {
      const { databaseReadiness } = await import("./services/readiness");
      const result = await databaseReadiness();
      res.status(result.ready ? 200 : 503).json({
        status: result.ready ? "ok" : "schema_not_ready",
        checks: { database: result.ready ? "ready" : "migration_required",
          nutritionAI: process.env.OPENAI_API_KEY ? "configured" : "unavailable" },
      });
    } catch {
      res.status(503).json({ status: "unavailable", message: "Database readiness check failed" });
    }
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

    const currentIndex = onboardingQuestions.findIndex(q => q.field === onboarding.currentQuestion.field);
    res.status(200).json({
      question: onboarding.currentQuestion,
      stepIndex: currentIndex >= 0 ? currentIndex : 0,
      totalSteps: onboardingQuestions.length,
    });
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
      
      const nextIndex = response.nextQuestion
        ? onboardingQuestions.findIndex(q => q.field === response.nextQuestion!.field)
        : onboardingQuestions.length;
      res.status(200).json({
        field: response.field,
        value: response.value,
        nextQuestion: response.nextQuestion,
        isComplete: response.isComplete,
        stepIndex: nextIndex >= 0 ? nextIndex : onboardingQuestions.length,
        totalSteps: onboardingQuestions.length,
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
      const {
        password,
        googleAccessToken,
        googleRefreshToken,
        ...rest
      } = user;
      const isOnboardingComplete = Boolean(user.name && user.age && user.height && user.weight);
      const googleCalendarConnected = Boolean(user.googleRefreshToken);
      res.status(200).json({
        ...rest,
        isOnboardingComplete,
        googleCalendarConnected,
      });
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
      const { password, googleAccessToken, googleRefreshToken, ...safe } = user;
      res.status(200).json({
        ...safe,
        googleCalendarConnected: Boolean(user.googleRefreshToken),
      });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  app.patch("/api/user/profile", async (req: Request, res: Response) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const updates = onboardingSchema.partial().extend({ quickLogMode: z.boolean().optional() }).parse(req.body);
      const user = await storage.updateUser(req.session.userId, updates);
      if (!user) return res.status(404).json({ message: "User not found" });
      // Recalculate and persist TDEE whenever any profile field changes
      const freshTDEE = calculateTDEE(user);
      const updatedUser = await storage.updateUser(req.session.userId, { tdee: freshTDEE });
      const final = updatedUser ?? user;
      const { password, googleAccessToken, googleRefreshToken, ...safe } = final;
      res.status(200).json({
        ...safe,
        googleCalendarConnected: Boolean(final.googleRefreshToken),
      });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  });

  // Helper function to calculate logging streak
  app.post("/api/logs/workout", async (req: Request, res: Response) => {
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const timezone = timezoneSchema.parse(req.body.timezone ?? req.get("X-Timezone") ?? "UTC");
      const date = dateKeySchema.parse(req.body.date ?? localDateKey(timezone));
      const data = insertWorkoutLogSchema.omit({ userId: true, createdAt: true }).extend({
        date: dateKeySchema, duration: z.number().int().min(0).max(1440).nullable().optional(),
      }).parse({ ...req.body, date, timezone });
      const existing = await storage.getWorkoutLogByDate(req.session.userId, dateKeyToDate(date));
      const saved = existing
        ? await storage.updateWorkoutLog(existing.id, data)
        : await storage.createWorkoutLog({ ...data, userId: req.session.userId });
      res.json(saved);
    } catch (error) {
      res.status(error instanceof z.ZodError ? 400 : 500).json({ message: "Workout was not saved" });
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
    if (!req.session.userId) return res.status(401).json({ message: "Unauthorized" });
    try {
      const { code } = req.params;
      if (!/^\d{8,14}$/.test(code)) return res.status(400).json({ message: "Enter an 8 to 14 digit barcode" });
      const response = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`,
        { signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "LayoverFuel/0.1 (nutrition review; github.com/jayscottaf/LayoverFuel)" } },
      );
      if (response.status === 404) return res.status(200).json({ notFound: true });
      if (!response.ok) return res.status(502).json({ message: "The food database is unavailable. Try again or enter the label manually." });
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

      if ([calories, protein, carbs, fat].some(value => value === null || !Number.isFinite(value) || value < 0)) {
        return res.status(200).json({ notFound: true });
      }

      return res.status(200).json({
        name: p.product_name || "Unknown Product",
        brand: p.brands || "",
        servingSize: p.serving_size || `${Math.round(servingQty)}g`,
        calories: Math.round(calories!),
        protein: Math.round(protein! * 10) / 10,
        carbs: Math.round(carbs! * 10) / 10,
        fat: Math.round(fat! * 10) / 10,
      });
    } catch (error) {
      console.error("Barcode lookup error:", error);
      return res.status(502).json({ message: "The food database is unavailable. Try again or enter the label manually." });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
