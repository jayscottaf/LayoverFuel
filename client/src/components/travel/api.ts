import { useQuery, type QueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { invalidateNutrition } from "@/lib/nutrition";

// ---------- Shared types (mirror the agreed server contracts) ----------

export type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";
export const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
export const MEAL_SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

export type MealContext = "home" | "airport" | "inflight" | "hotel" | "other";
export const MEAL_CONTEXT_LABELS: Record<MealContext, string> = {
  home: "Home",
  airport: "Airport",
  inflight: "In flight",
  hotel: "Hotel",
  other: "Out / other",
};

export type NutritionSource = "manual" | "label" | "database" | "estimate";
export const SOURCE_LABELS: Record<NutritionSource, string> = {
  manual: "Entered by you",
  label: "Package label",
  database: "Food database",
  estimate: "Estimate",
};

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Item nutrients are totals for the stated quantity, not per unit. */
export interface NutritionItem extends Macros {
  name: string;
  quantity: number;
  unit: string;
  source: NutritionSource;
}

export interface NutritionLog extends Macros {
  id: number;
  date: string;
  mealStyle: string | null;
  notes: string | null;
  context?: string | null;
  timezone?: string | null;
  items?: NutritionItem[] | null;
  photoUrl?: string | null;
  createdAt?: string | null;
}

export interface DashboardData {
  date?: string;
  timezone?: string;
  user: { name: string | null; goal: string | null };
  stats: {
    tdee: number;
    macros: { protein: number; carbs: number; fat: number; targetCalories: number };
    currentCalories: number;
    currentProtein: number;
    water: number;
    waterTarget?: number;
    waterTargetReason?: string | null;
    streak: number;
  };
  nutritionLog: (Macros & { meals: NutritionLog[] }) | null;
}

export type PlanPattern = "hotel" | "groceries" | "packed";
export const PLAN_PATTERN_LABELS: Record<PlanPattern, { title: string; blurb: string }> = {
  hotel: { title: "Hotel + local meals", blurb: "Hotel breakfast, then eat out nearby." },
  groceries: { title: "Grocery run + room meals", blurb: "One store stop, simple no-cook meals." },
  packed: { title: "Packed food", blurb: "What you bring carries the day." },
};

export interface PlanMeal extends Macros {
  id: string;
  name: string;
  description: string;
  status: "planned" | "locked";
  source: "estimate" | "manual";
}

/** Equipment values the plan service understands. "none" is exclusive. */
export const PLAN_EQUIPMENT: Array<{ value: string; label: string }> = [
  { value: "fridge", label: "Fridge" },
  { value: "microwave", label: "Microwave" },
  { value: "kitchen", label: "Kitchen" },
  { value: "none", label: "None of these" },
];

export interface PlanContext {
  location: string;
  pattern: PlanPattern;
  mealWindow: string;
  equipment: string[];
  notes: string;
}

export interface TravelPlan {
  date: string;
  timezone: string;
  revision: number;
  context: PlanContext;
  targets: Macros;
  consumed: Macros;
  remaining: Macros;
  meals: PlanMeal[];
  message: string;
  coverage: "generic";
}

export interface EstimateResponse extends Macros {
  items: NutritionItem[];
  notes: string;
}

export interface BarcodeProduct extends Macros {
  name: string;
  brand: string;
  servingSize: string;
}

export interface PhotoAnalysis {
  estimate: Macros;
  range?: { caloriesLow: number; caloriesHigh: number };
  confidence?: "low" | "medium" | "high";
  foodItems: string[];
  analysis: string;
  photoUrl?: string;
}

/** Editable, unsaved meal. Every capture path produces one; nothing saves without review. */
export interface NutritionDraft {
  clientRequestId: string;
  date: string;
  mealStyle: MealSlot;
  name: string;
  items: NutritionItem[];
  totals: Macros;
  context?: MealContext;
  photoPreview?: string;
  photoUrl?: string;
  range?: { caloriesLow: number; caloriesHigh: number };
  confidence?: "low" | "medium" | "high";
  origin: "photo" | "describe" | "barcode" | "manual" | "recent" | "plan" | "edit";
  editingId?: number;
  /** Set when logging a planned meal so the server removes it from the remaining plan. */
  planMealId?: string;
}

// ---------- Helpers ----------

/** RFC 4122 v4 UUID; the server requires a UUID for request de-duplication. */
export function newRequestId(): string {
  try {
    if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {}
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, x => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const nonNeg = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) && v > 0 ? v : 0;
};

export const round1 = (n: number) => Math.round(n * 10) / 10;

export function sumMacros(items: Macros[]): Macros {
  return items.reduce<Macros>(
    (acc, i) => ({
      calories: acc.calories + nonNeg(i.calories),
      protein: acc.protein + nonNeg(i.protein),
      carbs: acc.carbs + nonNeg(i.carbs),
      fat: acc.fat + nonNeg(i.fat),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function isMealSlot(v: unknown): v is MealSlot {
  return typeof v === "string" && (MEAL_SLOTS as string[]).includes(v);
}

export function suggestSlot(hour: number): MealSlot {
  if (hour >= 4 && hour < 11) return "breakfast";
  if (hour >= 11 && hour < 15) return "lunch";
  if (hour >= 17 && hour < 22) return "dinner";
  return "snack";
}

const LEGACY_NOTE = /^(snap to log|barcode scan)\b/i;

/** Human name for a log row, tolerant of legacy rows that stored the description in mealStyle. */
export function logDisplayName(log: Pick<NutritionLog, "mealStyle" | "notes" | "items">): string {
  if (log.mealStyle && !isMealSlot(log.mealStyle)) return log.mealStyle;
  if (log.notes && !LEGACY_NOTE.test(log.notes)) return log.notes;
  if (log.items?.length) return log.items.map(i => i.name).join(", ");
  if (isMealSlot(log.mealStyle)) return MEAL_SLOT_LABELS[log.mealStyle];
  return "Meal";
}

export function logSlot(log: Pick<NutritionLog, "mealStyle">): MealSlot | null {
  return isMealSlot(log.mealStyle) ? log.mealStyle : null;
}

/** Most trustworthy source present on a log, or null for legacy rows without items. */
export function logSource(log: Pick<NutritionLog, "items">): NutritionSource | null {
  const items = log.items ?? [];
  if (!items.length) return null;
  const order: NutritionSource[] = ["estimate", "manual", "database", "label"];
  // Report the weakest source so estimates are never presented as verified.
  for (const s of order) if (items.some(i => i.source === s)) return s;
  return null;
}

export function statusOf(error: unknown): number | null {
  const m = error instanceof Error ? /^(\d{3}):/.exec(error.message) : null;
  return m ? Number(m[1]) : null;
}

/** Client-side validation failure (e.g. zod in saveNutrition) — not a network problem. */
export function isValidationError(error: unknown): boolean {
  return error instanceof Error && error.name === "ZodError";
}

// ---------- Query keys ----------
// Prefix keys so a single invalidate of ["/api/dashboard"] etc. refreshes every day.

export const keys = {
  dashboard: (date: string, timezone: string) => ["/api/dashboard", { date, timezone }] as const,
  nutritionDay: (date: string) => ["/api/logs/nutrition", { date }] as const,
  nutritionRecent: (end: string) => ["/api/logs/nutrition", { recentUntil: end }] as const,
  travelPlan: (date: string, timezone: string) => ["/api/travel-plan", { date, timezone }] as const,
  profile: () => ["/api/user/profile"] as const,
};

async function getJson<T>(url: string): Promise<T> {
  const res = await apiRequest("GET", url);
  return (await res.json()) as T;
}

const qs = (params: Record<string, string>) => new URLSearchParams(params).toString();

export function useDashboard(date: string, timezone: string) {
  return useQuery<DashboardData>({
    queryKey: keys.dashboard(date, timezone),
    queryFn: () => getJson<DashboardData>(`/api/dashboard?${qs({ date, timezone })}`),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export function useNutritionDay(date: string) {
  return useQuery<NutritionLog[]>({
    queryKey: keys.nutritionDay(date),
    queryFn: () => getJson<NutritionLog[]>(`/api/logs/nutrition?${qs({ date })}`),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

export interface RecentMeal {
  key: string;
  name: string;
  mealStyle: MealSlot | null;
  totals: Macros;
  items: NutritionItem[];
  context: MealContext | undefined;
  lastDate: string;
  count: number;
}

/** Distinct meals from the last 30 days, most recent first — for "log again". */
export function useRecentMeals(today: string, shift: (d: string, n: number) => string) {
  return useQuery<RecentMeal[]>({
    queryKey: keys.nutritionRecent(today),
    queryFn: async () => {
      const logs = await getJson<NutritionLog[]>(
        `/api/logs/nutrition?${qs({ start: shift(today, -30), end: today })}`,
      );
      const byKey = new Map<string, RecentMeal>();
      const sorted = [...logs].sort((a, b) =>
        (b.createdAt ?? b.date).localeCompare(a.createdAt ?? a.date) || b.id - a.id,
      );
      for (const log of sorted) {
        const name = logDisplayName(log);
        const key = `${name.toLowerCase()}|${Math.round(nonNeg(log.calories))}`;
        const existing = byKey.get(key);
        if (existing) {
          existing.count += 1;
          continue;
        }
        byKey.set(key, {
          key,
          name,
          mealStyle: logSlot(log),
          totals: {
            calories: nonNeg(log.calories),
            protein: nonNeg(log.protein),
            carbs: nonNeg(log.carbs),
            fat: nonNeg(log.fat),
          },
          items: log.items ?? [],
          context: (log.context as MealContext | null) ?? undefined,
          lastDate: log.date,
          count: 1,
        });
      }
      return Array.from(byKey.values()).slice(0, 12);
    },
    staleTime: 60_000,
    retry: 1,
  });
}

export function useTravelPlan(date: string, timezone: string, enabled = true) {
  return useQuery<TravelPlan>({
    queryKey: keys.travelPlan(date, timezone),
    queryFn: () => getJson<TravelPlan>(`/api/travel-plan?${qs({ date, timezone })}`),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    retry: 1,
    enabled,
  });
}

export class PlanConflictError extends Error {
  constructor() {
    super("Plan changed since it was loaded");
    this.name = "PlanConflictError";
  }
}

export async function saveTravelPlan(body: {
  date: string;
  timezone: string;
  revision: number;
  context: PlanContext;
  meals: PlanMeal[];
}): Promise<TravelPlan> {
  try {
    const res = await apiRequest("PUT", `/api/travel-plan?${qs({ date: body.date, timezone: body.timezone })}`, body);
    return (await res.json()) as TravelPlan;
  } catch (e) {
    if (statusOf(e) === 409) throw new PlanConflictError();
    throw e;
  }
}

export async function estimateNutrition(description: string): Promise<EstimateResponse> {
  const res = await apiRequest("POST", "/api/nutrition/estimate", { description });
  return (await res.json()) as EstimateResponse;
}

export async function analyzeMealPhoto(imageData: string): Promise<PhotoAnalysis> {
  const res = await apiRequest("POST", "/api/meal-analysis", { imageData });
  const body = await res.json();
  if (!body?.result) throw new Error("No analysis result");
  return body.result as PhotoAnalysis;
}

export async function lookupBarcode(code: string): Promise<BarcodeProduct | null> {
  const res = await apiRequest("GET", `/api/barcode/${encodeURIComponent(code)}`);
  const body = await res.json();
  if (!body || body.notFound) return null;
  return body as BarcodeProduct;
}

export async function patchNutritionLog(
  id: number,
  patch: Partial<Macros> & {
    mealStyle?: string;
    notes?: string | null;
    context?: string | null;
    items?: NutritionItem[];
  },
): Promise<NutritionLog> {
  const res = await apiRequest("PATCH", `/api/logs/nutrition/${id}`, patch);
  return (await res.json()) as NutritionLog;
}

/** Soft delete; the same record can be brought back with restoreNutritionLog. */
export async function deleteNutritionLog(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/logs/nutrition/${id}`);
}

export async function restoreNutritionLog(id: number): Promise<void> {
  await apiRequest("POST", `/api/logs/nutrition/${id}/restore`, {});
}

export async function saveWater(glasses: number, date: string, timezone: string): Promise<void> {
  await apiRequest("POST", "/api/logs/water", { glasses: Math.max(0, Math.round(glasses)), date, timezone });
}

/** Build the POST /api/logs/nutrition body from a reviewed draft. */
export function draftToPayload(draft: NutritionDraft, timezone: string) {
  const items = draft.items.map(i => ({
    name: (i.name.trim() || "Item").slice(0, 200),
    quantity: nonNeg(i.quantity),
    unit: (i.unit.trim() || "serving").slice(0, 40),
    calories: Math.round(nonNeg(i.calories)),
    protein: round1(nonNeg(i.protein)),
    carbs: round1(nonNeg(i.carbs)),
    fat: round1(nonNeg(i.fat)),
    source: i.source,
  }));
  const totals = items.length ? sumMacros(items) : draft.totals;
  return {
    date: draft.date,
    timezone,
    mealStyle: draft.mealStyle,
    calories: Math.round(nonNeg(totals.calories)),
    protein: round1(nonNeg(totals.protein)),
    carbs: round1(nonNeg(totals.carbs)),
    fat: round1(nonNeg(totals.fat)),
    notes: draft.name.trim() || undefined,
    context: draft.context,
    items: items.length ? items : undefined,
    photoUrl: draft.photoUrl?.startsWith("https://") ? draft.photoUrl : undefined,
    planMealId: draft.planMealId,
    clientRequestId: draft.clientRequestId,
  };
}

/** Refresh everything derived from nutrition logs, including the server-derived plan. */
export async function refreshAfterNutritionChange(queryClient: QueryClient): Promise<void> {
  await Promise.allSettled([
    invalidateNutrition(),
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/logs/nutrition"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/travel-plan"] }),
    queryClient.invalidateQueries({ queryKey: ["/api/stats"] }),
  ]);
}
