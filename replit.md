# Layover Fuel

A travel fitness companion app for frequent flyers. Helps users track nutrition, log meals via AI chat, and stay fit while traveling.

## Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Express.js + TypeScript
- **Database**: PostgreSQL via Drizzle ORM
- **AI**: OpenAI Assistants API (for chat)
- **Routing**: wouter

## Architecture

- `client/src/` — React frontend
  - `pages/home.tsx` — Cal AI-style home screen with calorie ring, macros, water tracker, travel shortcuts
  - `pages/chat-page.tsx` — AI chat assistant with meal logging confirmation
  - `components/dashboard/MobileNavigation.tsx` — Fixed bottom tab bar (Home, Chat, Log, Profile)
- `server/` — Express backend
  - `routes.ts` — API endpoints (dashboard, nutrition logs, workout logs, health logs, AI assistant)
  - `storage.ts` — Database storage interface
  - `services/` — OpenAI assistant service, TDEE calculator, meal planner
- `shared/schema.ts` — Drizzle schema + Zod validation types

## Key Features

- **Home Screen**: Cal AI-style calorie ring (SVG progress), macro bars, 1-tap water tracking (8-glass grid), travel shortcuts (Airport Meal, Hotel Breakfast, Snap Meal), daily plan display
- **AI Chat**: Full OpenAI Assistants thread, meal analysis, pending log confirmation card with edit/confirm/skip
- **Barcode Scanner**: `BarcodeScanner` component (`client/src/components/ui/barcode-scanner.tsx`) — full-screen camera overlay using `@zxing/browser`, proxies Open Food Facts API via `GET /api/barcode/:code`, serving stepper, macros scale in real-time. Entry points: home page Quick Log row + chat input bar barcode icon.
- **Travel Mode**: Session storage prefill — tapping a travel shortcut on home opens chat with pre-filled message
- **Water Tracking**: Real-time tap-to-add on home screen, persisted to `health_logs.water` column
- **Bottom Navigation**: Fixed 4-tab nav (Home / Chat / Log / Profile) with active state indicators

## Data Model (schema.ts)

- `users` — profile, TDEE inputs (age, weight, height, activity level, fitness goal)
- `nutritionLogs` — daily food tracking (calories, protein, carbs, fat)
- `workoutLogs` — workout sessions
- `healthLogs` — weight, steps, HRV, water (glasses), active energy
- `dailyPlans` — AI-generated daily meal + workout plans
- `exercises` — exercise library

## Environment Variables Required

- `DATABASE_URL` — PostgreSQL connection string
- `OPENAI_API_KEY` — OpenAI API key for assistant
- `SESSION_SECRET` — Express session secret

## Development

```bash
npm run dev        # Start both Express + Vite
npm run db:push    # Push schema changes to database
```
