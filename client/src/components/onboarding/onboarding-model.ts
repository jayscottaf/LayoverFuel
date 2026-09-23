// Pure model for the structured onboarding flow: answer shape, unit
// conversion, validation, payload building and in-progress persistence.
// No React here so the rules are easy to read and test.

export type Gender = "male" | "female" | "other";
export type Goal = "lose_weight" | "maintain" | "gain_muscle" | "endurance";
export type Activity = "sedentary" | "lightly_active" | "moderately_active" | "very_active" | "extra_active";
export type HeightUnit = "imperial" | "metric";
export type WeightUnit = "lb" | "kg";

export interface Answers {
  name: string;
  gender: Gender | "";
  age: string;
  heightUnit: HeightUnit;
  heightFt: string;
  heightIn: string;
  heightCm: string;
  weightUnit: WeightUnit;
  weight: string;
  fitnessGoal: Goal | "";
  activityLevel: Activity | "";
  dietary: string[];
  dietaryOther: string;
}

export interface OnboardingPayload {
  name: string;
  age: number;
  height: number;
  weight: number;
  gender: Gender;
  fitnessGoal: Goal;
  activityLevel: Activity;
  gymMemberships: string[];
  maxCommuteMinutes: number;
  dietaryRestrictions: string[];
}

export const STEPS = ["name", "about", "goal", "activity", "food", "review"] as const;
export type StepId = (typeof STEPS)[number];
export const TOTAL_STEPS = STEPS.length;

export const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

export const GOAL_OPTIONS: Array<{ value: Goal; label: string; description: string }> = [
  { value: "lose_weight", label: "Lose fat gradually", description: "A moderate calorie deficit with extra protein." },
  { value: "maintain", label: "Maintain weight", description: "Eat about what you burn, with steady energy." },
  { value: "gain_muscle", label: "Build muscle", description: "A small calorie surplus with extra protein." },
  { value: "endurance", label: "Fuel endurance training", description: "Maintenance calories with more room for carbs." },
];

export const ACTIVITY_OPTIONS: Array<{ value: Activity; label: string; description: string }> = [
  { value: "sedentary", label: "Sedentary", description: "Mostly sitting, little exercise" },
  { value: "lightly_active", label: "Lightly active", description: "Exercise 1–3 days a week" },
  { value: "moderately_active", label: "Moderately active", description: "Exercise 3–5 days a week" },
  { value: "very_active", label: "Very active", description: "Exercise 6–7 days a week" },
  { value: "extra_active", label: "Extra active", description: "Hard training or a physical job" },
];

/** Stored and sent as readable labels; the server passes them to meal prompts as-is. */
export const DIETARY_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Pescatarian",
  "Gluten-free",
  "Dairy-free",
  "Nut allergy",
  "Shellfish allergy",
  "Halal",
  "Kosher",
] as const;

export const AGE_MIN = 18;
export const AGE_MAX = 100;
export const HEIGHT_MIN_CM = 120;
export const HEIGHT_MAX_CM = 230;
export const WEIGHT_MIN_KG = 35;
export const WEIGHT_MAX_KG = 300;

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Trim trailing ".0" so converted values read naturally in inputs. */
function fmtNum(n: number): string {
  return String(round1(n));
}

/** Locale guess for first-run units only; the user can switch at any time. */
function prefersImperial(): boolean {
  try {
    const locale = (typeof navigator !== "undefined" && navigator.language) || "";
    const region = new Intl.Locale(locale).maximize().region ?? "";
    return ["US", "LR", "MM"].includes(region);
  } catch {
    return false;
  }
}

export function emptyAnswers(): Answers {
  const imperial = prefersImperial();
  return {
    name: "",
    gender: "",
    age: "",
    heightUnit: imperial ? "imperial" : "metric",
    heightFt: "",
    heightIn: "",
    heightCm: "",
    weightUnit: imperial ? "lb" : "kg",
    weight: "",
    fitnessGoal: "",
    activityLevel: "",
    dietary: [],
    dietaryOther: "",
  };
}

/**
 * Parses a user-typed non-negative number. Returns null when empty and NaN
 * when present but not a plain number. Accepts a comma decimal separator.
 */
export function parseNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  if (!/^\d+(\.\d+)?$/.test(s) && !/^\.\d+$/.test(s)) return Number.NaN;
  return Number(s);
}

// ---------- Field validation (null = valid) ----------

export function nameError(a: Answers): string | null {
  return a.name.trim() ? null : "Enter your name.";
}

export function genderError(a: Answers): string | null {
  return a.gender ? null : "Choose one option.";
}

export function ageError(a: Answers): string | null {
  const s = a.age.trim();
  if (s === "") return "Enter your age.";
  if (!/^\d+$/.test(s)) return "Enter your age in whole years.";
  const n = Number(s);
  if (n < AGE_MIN) return "LayoverFuel is designed for adults.";
  if (n > AGE_MAX) return `Enter an age between ${AGE_MIN} and ${AGE_MAX}.`;
  return null;
}

/** Height in whole centimeters, or null when missing/invalid. */
export function heightCm(a: Answers): number | null {
  if (a.heightUnit === "metric") {
    const cm = parseNumber(a.heightCm);
    if (cm === null || Number.isNaN(cm)) return null;
    return Math.round(cm);
  }
  const ft = parseNumber(a.heightFt);
  const inches = a.heightIn.trim() === "" ? 0 : parseNumber(a.heightIn);
  if (ft === null || inches === null || Number.isNaN(ft) || Number.isNaN(inches)) return null;
  if (!Number.isInteger(ft) || inches >= 12) return null;
  return Math.round((ft * 12 + inches) * CM_PER_IN);
}

export function heightError(a: Answers): string | null {
  if (a.heightUnit === "metric") {
    const cm = parseNumber(a.heightCm);
    if (cm === null) return "Enter your height.";
    if (Number.isNaN(cm)) return "Enter your height as a number.";
    const rounded = Math.round(cm);
    if (rounded < HEIGHT_MIN_CM || rounded > HEIGHT_MAX_CM) {
      return `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm.`;
    }
    return null;
  }
  const ft = parseNumber(a.heightFt);
  if (ft === null) return "Enter your height.";
  if (Number.isNaN(ft) || !Number.isInteger(ft)) return "Enter feet as a whole number.";
  const inches = a.heightIn.trim() === "" ? 0 : parseNumber(a.heightIn);
  if (inches === null || Number.isNaN(inches) || inches >= 12) return "Inches should be between 0 and 11.";
  const cm = heightCm(a);
  if (cm === null || cm < HEIGHT_MIN_CM || cm > HEIGHT_MAX_CM) {
    return "Enter a height between 4 ft and 7 ft 6 in.";
  }
  return null;
}

/** Weight in kilograms to one decimal, or null when missing/invalid. */
export function weightKg(a: Answers): number | null {
  const n = parseNumber(a.weight);
  if (n === null || Number.isNaN(n)) return null;
  return round1(a.weightUnit === "kg" ? n : n * KG_PER_LB);
}

export function weightError(a: Answers): string | null {
  const n = parseNumber(a.weight);
  if (n === null) return "Enter your weight.";
  if (Number.isNaN(n)) return "Enter your weight as a number.";
  const kg = weightKg(a);
  if (kg === null || kg < WEIGHT_MIN_KG || kg > WEIGHT_MAX_KG) {
    return a.weightUnit === "kg"
      ? `Enter a weight between ${WEIGHT_MIN_KG} and ${WEIGHT_MAX_KG} kg.`
      : "Enter a weight between 78 and 661 lb.";
  }
  return null;
}

export type FieldKey = "name" | "gender" | "age" | "height" | "weight";

export const STEP_FIELDS: Record<StepId, FieldKey[]> = {
  name: ["name"],
  about: ["gender", "age", "height", "weight"],
  goal: [],
  activity: [],
  food: [],
  review: [],
};

export function isStepValid(step: StepId, a: Answers): boolean {
  switch (step) {
    case "name":
      return !nameError(a);
    case "about":
      return !genderError(a) && !ageError(a) && !heightError(a) && !weightError(a);
    case "goal":
      return a.fitnessGoal !== "";
    case "activity":
      return a.activityLevel !== "";
    case "food":
      return true;
    case "review":
      return STEPS.slice(0, -1).every(s => isStepValid(s, a));
  }
}

/** First step that still needs an answer, so Review can send people back to it. */
export function firstInvalidStep(a: Answers): StepId | null {
  return STEPS.slice(0, -1).find(s => !isStepValid(s, a)) ?? null;
}

// ---------- Unit switching (keeps what was typed, converted) ----------

export function switchHeightUnit(a: Answers, unit: HeightUnit): Answers {
  if (unit === a.heightUnit) return a;
  const cm = heightCm(a);
  if (unit === "metric") {
    return { ...a, heightUnit: unit, heightCm: cm !== null ? String(cm) : a.heightCm };
  }
  if (cm === null) return { ...a, heightUnit: unit };
  const totalIn = cm / CM_PER_IN;
  let ft = Math.floor(totalIn / 12);
  let inches = Math.round(totalIn - ft * 12);
  if (inches === 12) {
    ft += 1;
    inches = 0;
  }
  return { ...a, heightUnit: unit, heightFt: String(ft), heightIn: String(inches) };
}

export function switchWeightUnit(a: Answers, unit: WeightUnit): Answers {
  if (unit === a.weightUnit) return a;
  const kg = weightKg(a);
  if (kg === null) return { ...a, weightUnit: unit };
  const value = unit === "kg" ? kg : kg / KG_PER_LB;
  return { ...a, weightUnit: unit, weight: fmtNum(value) };
}

// ---------- Display ----------

export function heightDisplay(a: Answers): string {
  if (a.heightUnit === "metric") {
    const cm = heightCm(a);
    return cm === null ? "Not set" : `${cm} cm`;
  }
  const ft = parseNumber(a.heightFt);
  if (ft === null || Number.isNaN(ft)) return "Not set";
  const inches = a.heightIn.trim() === "" ? 0 : parseNumber(a.heightIn);
  return `${ft} ft ${inches === null || Number.isNaN(inches) ? 0 : fmtNum(inches)} in`;
}

export function weightDisplay(a: Answers): string {
  const n = parseNumber(a.weight);
  if (n === null || Number.isNaN(n)) return "Not set";
  return `${fmtNum(n)} ${a.weightUnit}`;
}

/** Selected chips plus the comma-separated "Other" entries, de-duplicated. */
export function dietaryList(a: Answers): string[] {
  const other = a.dietaryOther
    .split(",")
    .map(s => s.trim().replace(/\s+/g, " ").slice(0, 40))
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of [...a.dietary, ...other]) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 20);
}

export function labelFor<T extends string>(options: Array<{ value: T; label: string }>, value: T | ""): string {
  return options.find(o => o.value === value)?.label ?? "Not set";
}

export function toPayload(a: Answers): OnboardingPayload | null {
  const height = heightCm(a);
  const weight = weightKg(a);
  if (!isStepValid("review", a) || height === null || weight === null) return null;
  if (!a.gender || !a.fitnessGoal || !a.activityLevel) return null;
  return {
    name: a.name.trim().slice(0, 80),
    age: Number(a.age.trim()),
    height,
    weight,
    gender: a.gender,
    fitnessGoal: a.fitnessGoal,
    activityLevel: a.activityLevel,
    gymMemberships: [],
    maxCommuteMinutes: 0,
    dietaryRestrictions: dietaryList(a),
  };
}

// ---------- In-progress persistence (sessionStorage) ----------

const STORAGE_KEY = "layoverfuel.onboarding.v1";

export interface SavedProgress {
  answers: Answers;
  step: number;
  nameEdited: boolean;
}

const isOneOf = <T extends string>(v: unknown, list: readonly T[]): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

const str = (v: unknown, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");

export function loadProgress(): SavedProgress | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    const src = (parsed?.answers ?? null) as Record<string, unknown> | null;
    if (!src || typeof src !== "object") return null;
    const base = emptyAnswers();
    const answers: Answers = {
      name: str(src.name),
      gender: isOneOf(src.gender, ["male", "female", "other"] as const) ? src.gender : "",
      age: str(src.age, 8),
      heightUnit: isOneOf(src.heightUnit, ["imperial", "metric"] as const) ? src.heightUnit : base.heightUnit,
      heightFt: str(src.heightFt, 8),
      heightIn: str(src.heightIn, 8),
      heightCm: str(src.heightCm, 8),
      weightUnit: isOneOf(src.weightUnit, ["lb", "kg"] as const) ? src.weightUnit : base.weightUnit,
      weight: str(src.weight, 8),
      fitnessGoal: isOneOf(src.fitnessGoal, GOAL_OPTIONS.map(o => o.value)) ? src.fitnessGoal : "",
      activityLevel: isOneOf(src.activityLevel, ACTIVITY_OPTIONS.map(o => o.value)) ? src.activityLevel : "",
      dietary: Array.isArray(src.dietary)
        ? src.dietary.filter((d): d is (typeof DIETARY_OPTIONS)[number] => isOneOf(d, DIETARY_OPTIONS))
        : [],
      dietaryOther: str(src.dietaryOther, 300),
    };
    const rawStep = typeof parsed?.step === "number" ? Math.floor(parsed.step) : 0;
    const step = Math.min(Math.max(rawStep, 0), TOTAL_STEPS - 1);
    return { answers, step, nameEdited: parsed?.nameEdited === true };
  } catch {
    return null;
  }
}

export function saveProgress(progress: SavedProgress): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable (private mode, quota); the flow still works.
  }
}

export function clearProgress(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
