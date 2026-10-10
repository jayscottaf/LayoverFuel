// Local-only camera regression fixture: no real account, AI, database, or camera.
// Build first, then: node scripts/camera-fixture.mjs
// Open http://127.0.0.1:5186/?dashboard=error&camera=ready
// Dashboard: error, slow, ok. Camera: ready, denied, missing, pending, delayed.
// Quick Log: quick=1. Save: error, slow, ok. Undo: retry, lost, ok.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const root = resolve("dist/public");
let dashboardMode = "error";
let estimateMode = "ok";
let dashboardRequests = 0;
let saveMode = "ok";
let undoMode = "ok";
let saves = 0;
let deletes = 0;
let logs = [];
const user = { id: 1001, name: "Camera Tester", email: "camera@example.test", isOnboardingComplete: true, googleCalendarConnected: false, quickLogMode: false };
const dashboard = {
  user: { name: user.name, goal: "maintain_weight" },
  stats: { tdee: 2200, macros: { targetCalories: 2200, protein: 140, carbs: 250, fat: 70 }, currentCalories: 480, currentProtein: 25, water: 2, waterTarget: 8, streak: 1 },
  nutritionLog: { calories: 480, protein: 25, carbs: 45, fat: 15, meals: [] },
  dailyPlan: null,
};
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".json": "application/json" };

function cameraMock(mode) {
  return `<script>
    let requests = 0, stops = 0;
    const mode = ${JSON.stringify(mode)};
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: async () => {
        document.documentElement.dataset.cameraRequests = String(++requests);
        if (mode === 'denied') throw new DOMException('Fixture denied', 'NotAllowedError');
        if (mode === 'missing') throw new DOMException('Fixture no device', 'NotFoundError');
        if (mode === 'pending') return new Promise(() => {});
        if (mode === 'delayed') await new Promise(r => setTimeout(r, 2000));
        const canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 480;
        const ctx = canvas.getContext('2d');
        const paint = () => {
          ctx.fillStyle = '#255b45'; ctx.fillRect(0,0,640,480);
          ctx.fillStyle = '#fff'; ctx.font = '28px sans-serif';
          ctx.fillText('Synthetic camera preview', 130, 230);
        };
        paint();
        const timer = setInterval(paint, 100);
        const stream = canvas.captureStream(10);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          track.stop = () => { clearInterval(timer); document.documentElement.dataset.cameraStops = String(++stops); stop(); };
        }
        return stream;
      }
    }});
  </script>`;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const json = (status, data) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(data)); };
  if (url.pathname === "/__fixture/status") return json(200, { dashboardMode, dashboardRequests, saves, deletes, logs });
  if (url.pathname === "/api/dashboard") {
    dashboardRequests += 1;
    if (dashboardMode === "slow") return;
    const totals = { ...dashboard, stats: { ...dashboard.stats,
      currentCalories: 480 + logs.reduce((sum, log) => sum + log.calories, 0),
      currentProtein: 25 + logs.reduce((sum, log) => sum + log.protein, 0),
    }, nutritionLog: { ...dashboard.nutritionLog,
      calories: 480 + logs.reduce((sum, log) => sum + log.calories, 0),
      protein: 25 + logs.reduce((sum, log) => sum + log.protein, 0),
      carbs: 45 + logs.reduce((sum, log) => sum + log.carbs, 0),
      fat: 15 + logs.reduce((sum, log) => sum + log.fat, 0),
      meals: logs,
    } };
    return setTimeout(() => json(dashboardMode === "error" ? 500 : 200, dashboardMode === "error" ? { message: "Fixture dashboard unavailable" } : totals), 100);
  }
  if (url.pathname === "/api/logs/nutrition" && req.method === "POST") {
    saves += 1;
    let body = "";
    for await (const chunk of req) body += chunk;
    if (saveMode === "error") return json(503, { message: "Fixture save unavailable" });
    const log = { ...JSON.parse(body), id: saves, userId: user.id };
    logs.push(log);
    if (saveMode === "slow") return setTimeout(() => json(200, log), 1500);
    return json(200, log);
  }
  if (/^\/api\/logs\/nutrition\/\d+$/.test(url.pathname) && req.method === "DELETE") {
    deletes += 1;
    const id = Number(url.pathname.split("/").pop());
    if (undoMode === "retry" && deletes === 1) return json(503, { message: "Fixture delete unavailable" });
    if (!logs.some(log => log.id === id)) return json(404, { message: "Log not found" });
    logs = logs.filter(log => log.id !== id);
    if (undoMode === "lost" && deletes === 1) return json(503, { message: "Fixture deletion response lost" });
    res.writeHead(204); return res.end();
  }
  if (url.pathname === "/api/auth/me" || url.pathname === "/api/user/profile") return json(200, user);
  if (url.pathname === "/api/itinerary/upcoming") return json(200, { connected: false, flights: [], layovers: [] });
  if (url.pathname === "/api/meal-analysis") {
    if (estimateMode === "slow") return;
    if (estimateMode === "error") return json(503, { message: "Fixture estimate unavailable" });
    return json(200, { result: { estimate: { calories: 480, protein: 25, carbs: 45, fat: 15 }, foodItems: ["Fixture meal"], confidence: "low", range: { caloriesLow: 400, caloriesHigh: 600 }, analysis: "Synthetic test result" } });
  }
  if (url.pathname.startsWith("/api/")) return json(404, { message: "Not a fixture endpoint" });
  try {
    const file = url.pathname === "/" ? resolve(root, "index.html") : resolve(root, `.${url.pathname}`);
    if (!file.startsWith(root + sep)) return json(403, { message: "Forbidden" });
    let data = await readFile(file);
    if (extname(file) === ".html") {
      dashboardMode = ["error", "slow", "ok"].includes(url.searchParams.get("dashboard")) ? url.searchParams.get("dashboard") : "error";
      estimateMode = ["error", "slow", "ok"].includes(url.searchParams.get("estimate")) ? url.searchParams.get("estimate") : "ok";
      saveMode = ["error", "slow", "ok"].includes(url.searchParams.get("save")) ? url.searchParams.get("save") : "ok";
      undoMode = ["retry", "lost", "ok"].includes(url.searchParams.get("undo")) ? url.searchParams.get("undo") : "ok";
      user.quickLogMode = url.searchParams.get("quick") === "1";
      saves = 0; deletes = 0; logs = [];
      const mode = ["ready", "denied", "missing", "pending", "delayed"].includes(url.searchParams.get("camera")) ? url.searchParams.get("camera") : "ready";
      data = Buffer.from(data.toString().replace("<head>", `<head>${cameraMock(mode)}`));
    }
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch { json(404, { message: "Build the client before starting this fixture" }); }
});
server.listen(Number(process.env.CAMERA_FIXTURE_PORT || 5186), "127.0.0.1", () => console.log("Camera fixture listening", server.address()));
