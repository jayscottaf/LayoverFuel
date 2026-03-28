# LayoverFuel - Code Reference

**AI-powered nutrition and fitness assistant for airline pilots and frequent travelers**

## Overview

LayoverFuel is a mobile-optimized React application designed to help commercial pilots and frequent travelers maintain their fitness and nutrition goals while traveling. The app combines AI-powered coaching with smart meal logging and personalized fitness guidance.

## Tech Stack

### Frontend
- **Framework**: React 18.3.1 + TypeScript 5.6.3
- **Styling**: Tailwind CSS 4.1.3 + Shadcn/UI components
- **Routing**: Wouter 3.3.5
- **State Management**: @tanstack/react-query 5.60.5
- **UI Components**: Radix UI components + custom components
- **Animations**: Framer Motion 11.13.1

### Backend
- **Runtime**: Node.js with Express 4.21.2
- **Database**: PostgreSQL with Drizzle ORM 0.39.1
- **Session Management**: express-session with connect-pg-simple
- **Authentication**: Passport.js with bcryptjs

### AI Integration
- **Primary**: OpenAI API (GPT-4o + Assistants API v2)
- **Vision**: OpenAI GPT-4o for meal photo analysis
- **Image Storage**: Cloudinary for image hosting

### Build & Development
- **Build Tool**: Vite 5.4.14
- **Dev Server**: tsx 4.19.1
- **Deployment**: Replit-hosted

---

## Core Features

### 1. User Authentication & Onboarding
**Files**:
- `client/src/pages/auth/login.tsx`
- `client/src/pages/auth/register.tsx`
- `client/src/components/onboarding/OnboardingChat.tsx`
- `server/routes.ts` (routes 56-294)

**Functionality**:
- User registration with email/password
- Secure login with bcrypt password hashing
- Session-based authentication
- Interactive AI-powered onboarding chat
- Collects: name, age, height, weight, gender, fitness goals, activity level, dietary restrictions, gym memberships

### 2. Dashboard (Home Page)
**Files**:
- `client/src/pages/home.tsx`
- `server/routes.ts` (route 349-441)

**Features**:
- **Calorie Ring**: Visual circular progress indicator showing daily calorie intake vs target
- **Macro Bars**: Progress bars for protein, carbs, and fat tracking
- **Water Tracker**: Interactive 8-glass water intake tracker
- **Quick Log Shortcuts**: Customizable shortcuts for common travel scenarios (airport meals, hotel breakfast, etc.)
- **Snap to Log**: Camera-based meal logging with AI analysis
- **Barcode Scanner**: Scan packaged foods for instant nutrition info (integrates with Open Food Facts API)
- **Daily Workout Plan**: AI-generated hotel-friendly workout recommendations
- **Daily Meal Plan**: Personalized meal suggestions based on user goals and macros
- **Streak Counter**: Motivational "Day X" streak display

### 3. AI Chat Assistant
**Files**:
- `client/src/pages/chat-page.tsx`
- `server/services/assistant-service.ts`
- `server/routes.ts` (routes 590-850)

**Capabilities**:
- Persistent conversation threads (stored per user)
- Multi-modal input: text + images
- Real-time nutrition logging from conversation
- Context-aware responses based on user profile
- Time-based quick prompts (breakfast logging in morning, dinner logging in evening, etc.)
- Message history with date separators
- Automatic meal analysis and logging suggestions
- Profile context injection (user's goals, macros, dietary restrictions)

**Assistant Service Features**:
- Thread creation and management
- Message processing with image uploads
- OpenAI Assistants API integration
- Cloudinary image hosting for persistence
- Automatic JSON nutrition log extraction from assistant responses
- Duplicate prevention for nutrition logging

### 4. Meal Photo Analysis
**Files**:
- `server/services/image-analysis-service.ts`
- `client/src/components/ui/snap-to-log.tsx`
- `server/routes.ts` (route 562-585)

**Process**:
1. User uploads food photo
2. Image sent to OpenAI GPT-4o Vision API
3. AI analyzes and returns:
   - Estimated calories, protein, carbs, fat
   - Identified food items
   - Nutritional analysis
   - Improvement suggestions
4. User can review/edit before logging

### 5. Barcode Scanner
**Files**:
- `client/src/components/ui/barcode-scanner.tsx`
- `server/routes.ts` (route 876-933)

**Features**:
- Uses @zxing/browser for barcode detection
- Integrates with Open Food Facts API
- Automatically extracts nutrition info per serving
- Manual entry fallback if product not found

### 6. Nutrition Logging
**Files**:
- `server/routes/api/logs/nutrition.ts`
- `shared/schema.ts` (nutritionLogs table)
- `server/storage.ts` (nutrition CRUD methods)

**Data Tracked**:
- Date, userId, mealStyle, calories, protein, carbs, fat, fiber, notes
- Supports multiple logs per day (additive)
- Auto-updates dashboard stats

### 7. Health Logging
**Files**:
- `server/routes.ts` (routes 466-495)
- `shared/schema.ts` (healthLogs table)

**Metrics Tracked**:
- Weight, HRV, resting heart rate, VO2 max
- Steps, distance walked, active energy
- Water intake (8 glasses goal)

### 8. Workout Logging
**Files**:
- `server/routes.ts` (routes 498-527)
- `shared/schema.ts` (workoutLogs table)
- `server/services/workout-service.ts`

**Data Collected**:
- Workout type, duration, intensity
- Equipment used
- Notes

### 9. TDEE & Macro Calculation
**Files**:
- `server/services/tdee-service.ts`

**Calculations**:
- **BMR**: Mifflin-St Jeor Equation (gender-specific)
- **TDEE**: BMR × activity multiplier
- **Activity Levels**: Sedentary (1.2), Lightly Active (1.375), Moderately Active (1.55), Very Active (1.725), Extra Active (1.9)
- **Macros by Goal**:
  - **Lose Weight**: 18% calorie deficit, 2.2g protein/kg, 0.8g fat/kg
  - **Gain Muscle**: 10% surplus, 2.0g protein/kg, 1.0g fat/kg
  - **Endurance**: Maintenance, 1.6g protein/kg, 0.7g fat/kg
  - **Maintain**: Maintenance, 1.8g protein/kg, 0.9g fat/kg

### 10. Daily Plan Generation
**Files**:
- `server/routes.ts` (route 349-441)
- `server/services/meal-service.ts`
- `server/services/workout-service.ts`
- `shared/schema.ts` (dailyPlans table)

**Auto-Generated Content**:
- Breakfast, lunch, dinner, snacks with macros
- Restaurant recommendations with distance estimates
- Hotel-friendly meal suggestions
- Workout plan with duration and intensity
- Daily motivation message

### 11. Profile Management
**Files**:
- `client/src/pages/profile.tsx` or `client/src/pages/dashboard/profile.tsx`
- `server/routes.ts` (routes 312-346)

**Editable Fields**:
- Name, age, height, weight, gender
- Fitness goal, activity level
- Dietary restrictions
- Gym memberships, max commute time
- TDEE auto-recalculates on profile update

---

## Database Schema

### Users Table
```typescript
{
  id: serial (primary key),
  email: text (unique, not null),
  password: text (not null, bcrypt hashed),
  name: text,
  age: integer,
  height: integer (cm),
  weight: real (lbs in storage, converted to kg for calculations),
  gender: text ('male' | 'female' | 'other'),
  fitnessGoal: text ('lose_weight' | 'maintain' | 'gain_muscle' | 'endurance'),
  activityLevel: text ('sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extra_active'),
  gymMemberships: text[],
  maxCommuteMinutes: integer,
  tdee: integer (cached, recalculated on profile change),
  dietaryRestrictions: text[],
  assistantThreadId: text (OpenAI thread ID for chat continuity),
  createdAt: timestamp
}
```

### Nutrition Logs Table
```typescript
{
  id: serial (primary key),
  date: date (not null),
  userId: integer (foreign key to users),
  mealStyle: text,
  calories: real,
  protein: real,
  carbs: real,
  fat: real,
  fiber: real,
  notes: text
}
```

### Workout Logs Table
```typescript
{
  id: serial (primary key),
  date: date (not null),
  userId: integer (foreign key to users),
  workoutType: text,
  duration: integer (minutes),
  intensity: text,
  equipment: text[],
  notes: text
}
```

### Health Logs Table
```typescript
{
  id: serial (primary key),
  date: date (not null),
  userId: integer (foreign key to users),
  weight: real,
  hrv: integer,
  restingHr: integer,
  vo2Max: integer,
  steps: integer,
  distanceWalked: real,
  activeEnergy: integer,
  water: integer (glasses),
  notes: text
}
```

### Daily Plans Table
```typescript
{
  id: serial (primary key),
  date: date (not null),
  userId: integer (foreign key to users),
  meals: json (breakfast, lunch, dinner, snacks with macros),
  workout: json (title, duration, exercises),
  gymRecommendations: json,
  motivation: text
}
```

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create new user account
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current authenticated user
- `POST /api/auth/dev-login` - Dev-only instant login (development mode)

### Onboarding
- `GET /api/onboarding/current-question` - Get current onboarding question
- `POST /api/onboarding/message` - Process onboarding response
- `POST /api/onboarding/complete` - Complete onboarding with full data

### User Profile
- `GET /api/user/profile` - Get user profile
- `PATCH /api/user/profile` - Update user profile (recalculates TDEE)

### Dashboard
- `GET /api/dashboard` - Get comprehensive dashboard data (stats, daily plan, logs)

### Logs
- `POST /api/logs/nutrition` - Create/update nutrition log
- `POST /api/logs/workout` - Create/update workout log
- `POST /api/logs/health` - Create/update health log
- `POST /api/logs/water` - Quick water intake update

### AI Assistant
- `POST /api/assistant/thread` - Create or retrieve conversation thread
- `POST /api/assistant/message` - Send message to assistant (supports text + images)
- `GET /api/assistant/messages/:threadId` - Retrieve thread message history

### Meal Analysis
- `POST /api/meal-analysis` - Analyze meal photo with GPT-4o Vision

### Barcode Lookup
- `GET /api/barcode/:code` - Look up product by barcode (proxies Open Food Facts)

### Feedback
- `POST /api/feedback` - Submit user feedback with AI processing

---

## Key Services

### Assistant Service (`server/services/assistant-service.ts`)
- **getOrCreateThread()**: Manages OpenAI thread lifecycle
- **addMessageToThread()**: Adds user messages with optional images (uploads to Cloudinary)
- **runAssistantOnThread()**: Triggers assistant processing
- **checkRunStatus()**: Polls for completion
- **getMessagesFromThread()**: Retrieves and filters messages (removes JSON logging instructions from display)
- **processMessageForNutritionLogging()**: Parses JSON from assistant responses and auto-logs meals

### TDEE Service (`server/services/tdee-service.ts`)
- **calculateBMR()**: Uses Mifflin-St Jeor equation
- **calculateTDEE()**: Applies activity multiplier
- **calculateMacros()**: Goal-based macro distribution

### Meal Service (`server/services/meal-service.ts`)
- **generateMealPlan()**: Uses GPT-4o to create travel-friendly meal plan with restaurant suggestions

### Workout Service (`server/services/workout-service.ts`)
- **generateWorkoutPlan()**: Creates hotel-friendly workouts based on available equipment

### Image Analysis Service (`server/services/image-analysis-service.ts`)
- **analyzeMealImage()**: GPT-4o Vision analysis for food photos

### Cloudinary Service (`server/services/cloudinary-service.ts`)
- **uploadImageToCloudinary()**: Uploads base64 images to Cloudinary for persistent URLs

### OpenAI Service (`server/services/openai-service.ts`)
- **processOnboardingMessage()**: Handles conversational onboarding flow
- **generateDailyMotivation()**: Creates personalized motivation messages
- **processFeedback()**: AI-powered feedback analysis

---

## Component Architecture

### Pages
- **home.tsx**: Main dashboard with calorie ring, macros, quick actions
- **chat-page.tsx**: AI chat interface with meal logging integration
- **login.tsx / register.tsx**: Authentication pages
- **profile.tsx**: User profile management
- **log.tsx**: Dedicated logging interface (if exists)

### Dashboard Components
- **CalorieRing**: Circular progress indicator for daily calories
- **MacroBar**: Linear progress bars for protein/carbs/fat
- **WaterTracker**: Interactive glass counter (0-8)
- **ShortcutEditor**: Customizable quick-log shortcuts modal
- **MealLogCard**: Review and edit meal before logging

### UI Components (Shadcn-based)
- **assistant-chat.tsx**: Reusable chat interface
- **barcode-scanner.tsx**: ZXing-based barcode scanner modal
- **snap-to-log.tsx**: Camera capture and meal logging flow
- **image-upload.tsx**: File upload with preview

### Layouts
- **AuthLayout**: Login/register page wrapper
- **MobileNavigation**: Bottom tab navigation (Home, Chat, Log, Profile)
- **Sidebar**: Desktop navigation (if used)

---

## State Management

### React Query Keys
- `["/api/dashboard"]` - Dashboard data (stats, plans, logs)
- `["/api/user/profile"]` - User profile
- `["/api/auth/me"]` - Current user auth status

### Local Storage
- `assistantThreadId` - OpenAI thread ID for chat continuity
- `layoverfuel_shortcuts` - User's custom quick-log shortcuts

### Session Storage
- `chatPrefill` - Pre-fills chat input when navigating from quick actions

---

## Environment Variables

Required in `.env` or Replit Secrets:
- `OPENAI_API_KEY` - OpenAI API key for GPT-4o and Assistants
- `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
- `CLOUDINARY_API_KEY` - Cloudinary API key
- `CLOUDINARY_API_SECRET` - Cloudinary API secret
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Express session secret (defaults to "layover-fuel-secret")
- `NODE_ENV` - 'development' or 'production'

---

## Build & Deployment

### Development
```bash
npm install
npm run dev  # Runs server on port 5000 with Vite HMR
```

### Production Build
```bash
npm run build  # Vite build + esbuild server bundle
npm start      # Runs production server
```

### Database Setup
```bash
npm run db:push  # Push Drizzle schema to PostgreSQL
```

### Type Checking
```bash
npm run check  # TypeScript type checking
```

---

## Code Quality & Error Analysis

### TypeScript Status
✅ **No TypeScript errors** - `npm run check` passes cleanly

### Security Vulnerabilities
⚠️ **24 vulnerabilities detected** (3 low, 12 moderate, 8 high, 1 critical)
- Run `npm audit fix` for automatic fixes
- Some may require manual review

### Code Patterns
- **Error Handling**: Try-catch blocks in all API routes
- **Authentication**: Session-based with passport
- **Type Safety**: Full TypeScript coverage with Zod validation
- **Database**: Drizzle ORM with type-safe queries
- **API Integration**: Centralized apiRequest utility in queryClient

---

## Use Cases

### Primary Use Case: Traveling Airline Pilot
1. **Morning at Hotel**:
   - Opens app, sees personalized greeting and calorie ring
   - Taps "Hotel Breakfast" quick shortcut
   - Describes buffet items, AI logs nutrition
   - Checks today's workout plan

2. **At Airport**:
   - Snaps photo of airport meal before eating
   - AI analyzes and suggests logging
   - Confirms and logs in one tap
   - Dashboard updates calorie/macro progress

3. **Layover City**:
   - Asks AI for nearby healthy restaurant recommendations
   - AI suggests options within commute preference
   - Scans barcode of packaged snack at convenience store
   - Instant nutrition info from Open Food Facts

4. **Hotel Gym**:
   - Reviews AI-generated hotel gym workout
   - Completes workout, logs duration and intensity
   - AI provides motivational feedback

5. **Evening Wind-down**:
   - Asks AI "How did I do today?"
   - Reviews macro distribution chart
   - Gets preview of tomorrow's meal plan
   - Logs final glass of water

### Secondary Use Case: Frequent Business Traveler
- Similar workflow but focused on maintenance goals
- Uses barcode scanner for packaged meals during flights
- Relies on quick shortcuts for repetitive scenarios

---

## Future Enhancement Opportunities

Based on README mentions:
- Nutrition history dashboard with charts
- Custom goal tracking beyond macros
- Integration with wearables (steps, HRV, etc.)
- Offline mode for meal logging during flights
- Social features (share travel fitness tips)
- Integration with hotel fitness center databases

---

## File Structure Summary

```
LayoverFuel/
├── client/src/
│   ├── components/
│   │   ├── dashboard/      # Dashboard-specific components
│   │   ├── onboarding/     # Onboarding chat flow
│   │   ├── ui/             # Reusable UI components (Shadcn)
│   │   └── layouts/        # Page layouts
│   ├── pages/
│   │   ├── auth/           # Login/register
│   │   ├── dashboard/      # Dashboard sub-pages
│   │   ├── home.tsx        # Main dashboard
│   │   ├── chat-page.tsx   # AI chat
│   │   ├── log.tsx         # Manual logging
│   │   └── profile.tsx     # User profile
│   ├── context/            # React context (auth)
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Utilities (API client, utils)
│   ├── App.tsx             # Root component
│   └── main.tsx            # Entry point
├── server/
│   ├── services/           # Business logic services
│   │   ├── assistant-service.ts
│   │   ├── image-analysis-service.ts
│   │   ├── meal-service.ts
│   │   ├── workout-service.ts
│   │   ├── tdee-service.ts
│   │   ├── cloudinary-service.ts
│   │   └── openai-service.ts
│   ├── routes/
│   │   └── api/logs/       # Subroutes
│   ├── db.ts               # Drizzle connection
│   ├── storage.ts          # Data access layer
│   ├── routes.ts           # Main route definitions
│   ├── index.ts            # Express server
│   └── vite.ts             # Vite dev middleware
├── shared/
│   └── schema.ts           # Shared types & Drizzle schema
├── scripts/                # Utility scripts
├── package.json
├── tsconfig.json
├── vite.config.ts
├── drizzle.config.ts
└── tailwind.config.ts
```

---

## Special Notes

### OpenAI Assistant Integration
- Uses Assistants API v2 with persistent threads
- Assistant ID hardcoded: `asst_PZYE18wO7th5Fm9JoOkLEfDJ`
- Images uploaded to Cloudinary before sending to OpenAI (avoids base64 size limits)
- Automatic nutrition logging via JSON extraction from assistant responses

### Session Management
- PostgreSQL session store (connect-pg-simple)
- 1-week session expiry
- Secure cookies in production
- Trust proxy enabled for Replit hosting

### Image Handling
- Client uploads as base64
- Server converts to Cloudinary public URLs
- OpenAI Vision API processes from Cloudinary URLs
- 5MB client-side size limit

### Barcode Scanner
- Uses device camera via getUserMedia
- ZXing library for decoding
- Fallback to Open Food Facts API
- Manual entry if not found

### Responsive Design
- Mobile-first approach
- Bottom navigation on mobile
- Safe area insets for iOS notch
- Touch-optimized interactions

---

*This document serves as a comprehensive reference for understanding the LayoverFuel codebase, its architecture, features, and implementation details.*
