import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// CORS configuration for production deployment
const corsOptions = {
  origin: [
    'http://localhost:5173',  // Vite dev server
    'https://layoverfuel.com',  // Production frontend
    'https://www.layoverfuel.com',  // Production frontend (www)
    'https://layoverfuel.vercel.app',  // Vercel preview deployments
    /https:\/\/.*-layoverfuel\.vercel\.app$/,  // All Vercel preview URLs
  ],
  credentials: true,  // Allow cookies for session management
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Timezone', 'X-Account-Id'],
};

app.use(cors(corsOptions));

// Trust Replit's reverse proxy so secure session cookies work in production
app.set("trust proxy", 1);
// Increase JSON payload size limit for image uploads
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  res.on("finish", () => {
    if (path.startsWith("/api")) log(`${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`);
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    console.error("Request failed", err instanceof Error ? err.name : "unknown");
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development" && process.env.SERVE_STATIC !== "1") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = Number(process.env.PORT || 5000);
  server.listen({
    port,
    host: process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  }, () => {
    log(`serving on port ${port}`);
  });
})();
