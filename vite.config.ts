  import { defineConfig } from "vite";
  import react from "@vitejs/plugin-react";
  import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
  import path from "path";
  import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
  import { version } from "./package.json";

  export default defineConfig(async () => {
    // Conditionally import cartographer plugin
    const cartographerPlugins =
      process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
        ? [
            (await import("@replit/vite-plugin-cartographer")).cartographer(),
          ]
        : [];

    return {
      plugins: [
        react(),
        runtimeErrorOverlay(),
        themePlugin(),
        ...cartographerPlugins,
      ],
      define: {
        "import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
      },
      resolve: {
        alias: {
          "@": path.resolve(import.meta.dirname, "client", "src"),
          "@shared": path.resolve(import.meta.dirname, "shared"),
          "@assets": path.resolve(import.meta.dirname, "attached_assets"),
        },
      },
      root: path.resolve(import.meta.dirname, "client"),
      build: {
        outDir: path.resolve(import.meta.dirname, "dist/public"),
        emptyOutDir: true,
      },
    };
  });
