import {
  MEAL_CONTEXT_LABELS,
  isMealSlot,
  logDisplayName,
  logSlot,
  newRequestId,
  nonNeg,
  round1,
  suggestSlot,
  sumMacros,
  type BarcodeProduct,
  type EstimateResponse,
  type Macros,
  type MealContext,
  type NutritionDraft,
  type NutritionItem,
  type NutritionLog,
  type NutritionSource,
  type PhotoAnalysis,
  type RecentMeal,
} from "../api";
import { formatShortDate, localHour, shiftDate } from "../local-date";

// Every capture path ends in a ReviewDraft. Nothing here saves anything.

export interface ReviewItem extends NutritionItem {
  /** Stable React key for the editor row. Never sent to the server. */
  uid: string;
  /**
   * Quantity and macros the item was loaded with (or last edited by hand).
   * Quantity changes scale from this snapshot so repeated taps don't drift.
   */
  base: Macros & { quantity: number };
}

export interface ReviewDraft extends Omit<NutritionDraft, "items"> {
  items: ReviewItem[];
  /** Short note that came with an AI estimate (photo analysis or text estimate). */
  estimateNote?: string;
}

export interface DraftContext {
  date: string;
  timezone: string;
}

const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };
const SOURCES: NutritionSource[] = ["manual", "label", "database", "estimate"];

let uidCounter = 0;
const nextUid = () => `item-${Date.now().toString(36)}-${(uidCounter += 1)}`;

const asSource = (v: unknown, fallback: NutritionSource): NutritionSource =>
  SOURCES.includes(v as NutritionSource) ? (v as NutritionSource) : fallback;

export function isMealContext(v: unknown): v is MealContext {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(MEAL_CONTEXT_LABELS, v);
}

function snapshot(i: Macros & { quantity: number }): ReviewItem["base"] {
  return { quantity: i.quantity, calories: i.calories, protein: i.protein, carbs: i.carbs, fat: i.fat };
}

/** Normalize anything item-shaped into an editable row. Numbers are clamped to >= 0. */
export function makeItem(input: Partial<NutritionItem>, fallbackSource: NutritionSource): ReviewItem {
  const q = nonNeg(input.quantity);
  const item: NutritionItem = {
    name: typeof input.name === "string" ? input.name.trim() : "",
    quantity: q > 0 ? q : 1,
    unit: typeof input.unit === "string" && input.unit.trim() ? input.unit.trim() : "serving",
    calories: nonNeg(input.calories),
    protein: nonNeg(input.protein),
    carbs: nonNeg(input.carbs),
    fat: nonNeg(input.fat),
    source: asSource(input.source, fallbackSource),
  };
  return { ...item, uid: nextUid(), base: snapshot(item) };
}

export function emptyItem(name = ""): ReviewItem {
  return makeItem({ name, quantity: 1, unit: "serving", source: "manual" }, "manual");
}

/** Change quantity, scaling macros proportionally from the item's base snapshot. */
export function withQuantity(item: ReviewItem, quantity: number): ReviewItem {
  const q = nonNeg(quantity);
  const b = item.base;
  if (b.quantity <= 0) return { ...item, quantity: q };
  const f = q / b.quantity;
  return {
    ...item,
    quantity: q,
    calories: Math.round(b.calories * f),
    protein: round1(b.protein * f),
    carbs: round1(b.carbs * f),
    fat: round1(b.fat * f),
  };
}

/**
 * A hand-edited macro. The value is now the user's number, so the item becomes
 * 'manual' and future quantity changes scale from what they typed.
 */
export function withMacro(item: ReviewItem, key: keyof Macros, value: number): ReviewItem {
  const next = { ...item, [key]: nonNeg(value), source: "manual" as NutritionSource };
  return { ...next, base: snapshot(next) };
}

export function withItems(draft: ReviewDraft, items: ReviewItem[]): ReviewDraft {
  return { ...draft, items, totals: sumMacros(items) };
}

function baseDraft(ctx: DraftContext, origin: NutritionDraft["origin"]): ReviewDraft {
  return {
    clientRequestId: newRequestId(),
    date: ctx.date,
    mealStyle: suggestSlot(localHour(ctx.timezone)),
    name: "",
    items: [],
    totals: { ...ZERO },
    origin,
  };
}

const hasAnyMacro = (m: Partial<Macros> | undefined) =>
  !!m && (nonNeg(m.calories) > 0 || nonNeg(m.protein) > 0 || nonNeg(m.carbs) > 0 || nonNeg(m.fat) > 0);

function totalsItem(name: string, m: Partial<Macros>, source: NutritionSource, unit = "serving"): ReviewItem {
  return makeItem(
    { name, quantity: 1, unit, calories: m.calories, protein: m.protein, carbs: m.carbs, fat: m.fat, source },
    source,
  );
}

export function manualDraft(ctx: DraftContext, name = ""): ReviewDraft {
  const d = baseDraft(ctx, "manual");
  return withItems({ ...d, name }, [emptyItem(name)]);
}

export function draftFromEstimate(description: string, resp: EstimateResponse, ctx: DraftContext): ReviewDraft {
  const name = description.trim();
  let items = (Array.isArray(resp.items) ? resp.items : [])
    .filter(i => i && typeof i === "object")
    .map(i => makeItem(i, "estimate"));
  if (!items.length) {
    items = hasAnyMacro(resp) ? [totalsItem(name || "Meal", resp, "estimate")] : [emptyItem(name)];
  }
  const note = typeof resp.notes === "string" ? resp.notes.trim() : "";
  return withItems({ ...baseDraft(ctx, "describe"), name, estimateNote: note || undefined }, items);
}

function validRange(r: PhotoAnalysis["range"]): NutritionDraft["range"] {
  if (!r) return undefined;
  const low = Number(r.caloriesLow);
  const high = Number(r.caloriesHigh);
  if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high <= 0 || low > high) return undefined;
  return { caloriesLow: low, caloriesHigh: high };
}

function validConfidence(c: unknown): NutritionDraft["confidence"] {
  return c === "low" || c === "medium" || c === "high" ? c : undefined;
}

export function draftFromPhoto(analysis: PhotoAnalysis, preview: string, ctx: DraftContext): ReviewDraft {
  const foods = (Array.isArray(analysis.foodItems) ? analysis.foodItems : [])
    .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
    .map(f => f.trim());
  const label = foods.join(", ") || "Photo meal";
  // Only a server-hosted URL may be stored; the data URL is for on-screen preview only.
  const photoUrl =
    typeof analysis.photoUrl === "string" && analysis.photoUrl && !analysis.photoUrl.startsWith("data:")
      ? analysis.photoUrl
      : undefined;
  const note = typeof analysis.analysis === "string" ? analysis.analysis.trim() : "";
  return withItems(
    {
      ...baseDraft(ctx, "photo"),
      name: label,
      photoPreview: preview,
      photoUrl,
      range: validRange(analysis.range),
      confidence: validConfidence(analysis.confidence),
      estimateNote: note || undefined,
    },
    [totalsItem(label, analysis.estimate ?? ZERO, "estimate", "plate")],
  );
}

export function barcodeItemName(product: BarcodeProduct): string {
  const name = (product.name ?? "").trim() || "Packaged food";
  const brand = (product.brand ?? "").trim();
  return brand ? `${name} (${brand})` : name;
}

export function draftFromBarcode(product: BarcodeProduct, ctx: DraftContext): ReviewDraft {
  const name = barcodeItemName(product);
  const unit = (product.servingSize ?? "").trim() || "serving";
  return withItems({ ...baseDraft(ctx, "barcode"), name }, [totalsItem(name, product, "database", unit)]);
}

export function draftFromRecent(recent: RecentMeal, ctx: DraftContext): ReviewDraft {
  const items = recent.items?.length
    ? recent.items.map(i => makeItem(i, "estimate"))
    : // Legacy meal without items: the original source is unknown, so treat it as an estimate.
      [totalsItem(recent.name, recent.totals, "estimate")];
  return withItems(
    {
      ...baseDraft(ctx, "recent"),
      name: recent.name,
      context: isMealContext(recent.context) ? recent.context : undefined,
    },
    items,
  );
}

export function draftFromLog(log: NutritionLog, ctx: DraftContext): ReviewDraft {
  const name = logDisplayName(log);
  const items = log.items?.length
    ? log.items.map(i => makeItem(i, "estimate"))
    : [totalsItem(name, log, "estimate")];
  const photo = typeof log.photoUrl === "string" && log.photoUrl ? log.photoUrl : undefined;
  return withItems(
    {
      ...baseDraft({ ...ctx, date: log.date }, "edit"),
      mealStyle: logSlot(log) ?? suggestSlot(localHour(ctx.timezone)),
      name,
      context: isMealContext(log.context) ? log.context : undefined,
      photoPreview: photo,
      photoUrl: photo,
      editingId: log.id,
    },
    items,
  );
}

/** Pre-filled draft from elsewhere in the app (e.g. a planned meal). */
export function draftFromPartial(partial: Partial<NutritionDraft>, ctx: DraftContext): ReviewDraft {
  const base = baseDraft(ctx, "plan");
  const name = typeof partial.name === "string" ? partial.name : "";
  let items = (Array.isArray(partial.items) ? partial.items : []).map(i => makeItem(i, "estimate"));
  if (!items.length) {
    items = hasAnyMacro(partial.totals)
      ? [totalsItem(name || "Planned meal", partial.totals ?? ZERO, "estimate")]
      : [emptyItem(name)];
  }
  return withItems(
    {
      ...base,
      clientRequestId: partial.clientRequestId || base.clientRequestId,
      date: typeof partial.date === "string" && partial.date ? partial.date : base.date,
      mealStyle: isMealSlot(partial.mealStyle) ? partial.mealStyle : base.mealStyle,
      name,
      context: isMealContext(partial.context) ? partial.context : undefined,
      photoPreview: partial.photoPreview,
      photoUrl: partial.photoUrl,
      range: validRange(partial.range),
      confidence: validConfidence(partial.confidence),
      origin: partial.origin && partial.origin !== "edit" ? partial.origin : "plan",
      // Lets the server take a logged planned meal out of the remaining plan.
      planMealId: typeof partial.planMealId === "string" && partial.planMealId ? partial.planMealId : undefined,
    },
    items,
  );
}

/** Items as the server expects them: trimmed names, rounded nonnegative numbers. */
export function cleanItems(items: NutritionItem[]): NutritionItem[] {
  return items.map(i => ({
    name: i.name.trim() || "Item",
    quantity: nonNeg(i.quantity),
    unit: i.unit.trim() || "serving",
    calories: Math.round(nonNeg(i.calories)),
    protein: round1(nonNeg(i.protein)),
    carbs: round1(nonNeg(i.carbs)),
    fat: round1(nonNeg(i.fat)),
    source: i.source,
  }));
}

export function hasEstimate(draft: ReviewDraft): boolean {
  return !!draft.range || !!draft.confidence || draft.items.some(i => i.source === "estimate");
}

/** "today" / "yesterday" / "tomorrow" / "Mon, Sep 21" — for use inside a sentence. */
export function dayPhrase(date: string, today: string): string {
  if (date === today) return "today";
  if (date === shiftDate(today, -1)) return "yesterday";
  if (date === shiftDate(today, 1)) return "tomorrow";
  return formatShortDate(date);
}
