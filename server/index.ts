import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
// Increase JSON payload size limit for image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// This middleware was used for debugging but we're now disabling verbose logging
app.use((req, res, next) => {
  next();
});

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Create simplified log line without full response objects
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // For large responses, don't log the whole thing - just indicate size
      if (capturedJsonResponse) {
        // If it's a logs or messages endpoint, don't include response data
        if (path.includes('/logs/') || path.includes('/messages')) {
          // Just log that it returned data, not what the data was
          logLine += ` :: [data returned]`;
        } else {
          // For other endpoints, include a summarized version
          logLine += ` :: ${JSON.stringify(capturedJsonResponse).substring(0, 50)}${JSON.stringify(capturedJsonResponse).length > 50 ? '...' : ''}`;
        }
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
