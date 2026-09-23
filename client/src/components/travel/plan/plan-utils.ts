import {
  PLAN_EQUIPMENT,
  PLAN_PATTERN_LABELS,
  isMealSlot,
  newRequestId,
  nonNeg,
  round1,
  type Macros,
  type MealSlot,
  type NutritionDraft,
  type PlanContext,
  type PlanMeal,
  type PlanPattern,
} from "../api";

export const PLAN_PATTERNS = Object.keys(PLAN_PATTERN_LABELS) as PlanPattern[];

export function isPlanPattern(v: unknown): v is PlanPattern {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PLAN_PATTERN_LABELS, v);
}

/** Exclusive "nothing available" equipment value understood by the plan service. */
export const NO_EQUIPMENT = "none";

const CORE_EQUIPMENT: Array<{ value: string; label: string }> = [
  { value: "fridge", label: "Fridge" },
  { value: "microwave", label: "Microwave" },
  { value: "kettle", label: "Kettle" },
  { value: "cooler bag", label: "Cooler bag" },
];

/**
 * Equipment checkboxes: the travel basics first, then anything else the plan
 * service lists (e.g. "kitchen", "none") so every value it understands can be set.
 */
export const EQUIPMENT_OPTIONS: Array<{ value: string; label: string }> = [
  ...CORE_EQUIPMENT,
  ...PLAN_EQUIPMENT.filter(o => !CORE_EQUIPMENT.some(c => c.value === o.value)),
];

const KNOWN_EQUIPMENT = new Set(EQUIPMENT_OPTIONS.map(o => o.value));

/** Known values are stored lowercase; anything else the server returned is kept as-is. */
function normalizeEquipment(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const raw of values) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    const value = KNOWN_EQUIPMENT.has(lower) ? lower : trimmed;
    if (!out.includes(value)) out.push(value);
  }
  return out;
}

/** Check or uncheck one equipment option. "none" is exclusive of the other known options. */
export function toggleEquipment(current: string[], value: string, on: boolean): string[] {
  if (!on) return current.filter(v => v !== value);
  if (value === NO_EQUIPMENT) return [...current.filter(v => !KNOWN_EQUIPMENT.has(v)), NO_EQUIPMENT];
  return [...current.filter(v => v !== NO_EQUIPMENT && v !== value), value];
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** A complete, well-formed context from whatever the server returned. */
export function normalizeContext(ctx: Partial<PlanContext> | null | undefined): PlanContext {
  const pattern = ctx?.pattern;
  return {
    location: str(ctx?.location),
    pattern: isPlanPattern(pattern) ? pattern : "hotel",
    mealWindow: str(ctx?.mealWindow),
    equipment: normalizeEquipment(ctx?.equipment),
    notes: str(ctx?.notes),
  };
}

/** The context as it should be sent: trimmed text, cleaned equipment. */
export function cleanContext(ctx: PlanContext): PlanContext {
  return {
    location: ctx.location.trim(),
    pattern: ctx.pattern,
    mealWindow: ctx.mealWindow.trim(),
    equipment: normalizeEquipment(ctx.equipment),
    notes: ctx.notes.trim(),
  };
}

export function contextsEqual(a: PlanContext, b: PlanContext): boolean {
  const x = cleanContext(a);
  const y = cleanContext(b);
  const ex = [...x.equipment].sort();
  const ey = [...y.equipment].sort();
  return (
    x.location === y.location &&
    x.pattern === y.pattern &&
    x.mealWindow === y.mealWindow &&
    x.notes === y.notes &&
    ex.length === ey.length &&
    ex.every((v, i) => v === ey[i])
  );
}

export function planMacros(m: Partial<Macros> | null | undefined): Macros {
  return {
    calories: nonNeg(m?.calories),
    protein: nonNeg(m?.protein),
    carbs: nonNeg(m?.carbs),
    fat: nonNeg(m?.fat),
  };
}

/** Meal slot named in a meal's title ("Hotel breakfast", "Evening snack"), if any. */
export function slotFromName(name: string): MealSlot | undefined {
  const match = /\b(breakfast|lunch|dinner|snack)/i.exec(name);
  const slot = match?.[1].toLowerCase();
  return isMealSlot(slot) ? slot : undefined;
}

/** A planned meal as an unsaved draft; the capture flow opens it for review before anything is saved. */
export function planMealDraft(meal: PlanMeal, date: string): Partial<NutritionDraft> {
  const macros = planMacros(meal);
  const mealStyle = slotFromName(meal.name);
  return {
    name: meal.name,
    origin: "plan",
    date,
    ...(mealStyle ? { mealStyle } : {}),
    items: [
      {
        name: meal.name,
        quantity: 1,
        unit: "serving",
        ...macros,
        source: meal.source === "manual" ? "manual" : "estimate",
      },
    ],
    totals: macros,
    // Lets the server take a logged planned meal out of the remaining plan.
    planMealId: meal.id,
  };
}

export interface FixedMealInput extends Macros {
  name: string;
  description: string;
}

/** A user-entered meal that is already decided; always kept when the plan updates. */
export function fixedMeal(input: FixedMealInput): PlanMeal {
  return {
    id: newRequestId(),
    name: input.name.trim(),
    description: input.description.trim(),
    calories: Math.round(nonNeg(input.calories)),
    protein: round1(nonNeg(input.protein)),
    carbs: round1(nonNeg(input.carbs)),
    fat: round1(nonNeg(input.fat)),
    status: "locked",
    source: "manual",
  };
}
