import type { ReactNode } from "react";
import { Field, InlineSpinner, Panel, Segmented, SkeletonBlock, StateMessage, fmtInt, inputClass } from "@/components/travel/primitives";
import { FieldError, RadioCards, ToggleOption, secondaryButtonClass } from "./controls";
import {
  ACTIVITY_OPTIONS,
  DIETARY_OPTIONS,
  GENDER_OPTIONS,
  GOAL_OPTIONS,
  ageError,
  dietaryList,
  genderError,
  heightDisplay,
  heightError,
  labelFor,
  nameError,
  weightDisplay,
  weightError,
  type Activity,
  type Answers,
  type FieldKey,
  type Gender,
  type Goal,
  type HeightUnit,
  type WeightUnit,
} from "./onboarding-model";

type Update = (patch: Partial<Answers> | ((a: Answers) => Answers)) => void;

export interface FieldStepProps {
  answers: Answers;
  update: Update;
  /** Whether a field's validation message should be visible yet. */
  shows: (field: FieldKey) => boolean;
  touch: (field: FieldKey) => void;
}

/** aria props for an input whose validation message may be visible. */
function invalidProps(errorId: string, message: string | null, visible: boolean) {
  const invalid = visible && Boolean(message);
  return {
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? errorId : undefined,
  } as const;
}

// Segmented's buttons are slightly under 44px on their own; lift them for touch.
const segmentedTouch = "[&>button]:min-h-11";

// ---------- 1. Name ----------

export function NameStep({
  answers,
  update,
  shows,
  touch,
  profileLoading,
  onNameEdited,
}: FieldStepProps & { profileLoading: boolean; onNameEdited: () => void }) {
  const error = nameError(answers);
  const visible = shows("name");
  return (
    <div className="space-y-3">
      <Field id="ob-name" label="Name">
        <input
          id="ob-name"
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          maxLength={80}
          required
          value={answers.name}
          onChange={e => {
            onNameEdited();
            update({ name: e.target.value });
          }}
          onBlur={() => touch("name")}
          className={inputClass}
          {...invalidProps("ob-name-error", error, visible)}
        />
        <FieldError id="ob-name-error" message={visible ? error : null} />
      </Field>
      {profileLoading && !answers.name && <InlineSpinner label="Loading your details" />}
    </div>
  );
}

// ---------- 2. About you ----------

function UnitInput({
  id,
  label,
  unit,
  value,
  onChange,
  onBlur,
  decimal,
  describe,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  decimal: boolean;
  describe: ReturnType<typeof invalidProps>;
}) {
  return (
    <div className="min-w-0 space-y-1">
      <label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode={decimal ? "decimal" : "numeric"}
          autoComplete="off"
          maxLength={6}
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={onBlur}
          className={`${inputClass} pr-12 tabular`}
          {...describe}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground"
        >
          {unit}
        </span>
      </div>
    </div>
  );
}

function GroupLabelRow({ id, label, control }: { id: string; label: string; control: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p id={id} className="text-sm font-medium">
        {label}
      </p>
      {control}
    </div>
  );
}

export function AboutStep({
  answers,
  update,
  shows,
  touch,
  onHeightUnit,
  onWeightUnit,
}: FieldStepProps & { onHeightUnit: (u: HeightUnit) => void; onWeightUnit: (u: WeightUnit) => void }) {
  const gErr = genderError(answers);
  const aErr = ageError(answers);
  const hErr = heightError(answers);
  const wErr = weightError(answers);
  const heightProps = invalidProps("ob-height-error", hErr, shows("height"));
  const weightProps = invalidProps("ob-weight-error", wErr, shows("weight"));

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-sm font-medium" aria-hidden="true">
          Sex
        </p>
        <Segmented<Gender | "">
          label="Sex, used only for the energy formula"
          value={answers.gender}
          options={GENDER_OPTIONS}
          onChange={v => {
            touch("gender");
            update({ gender: v });
          }}
          className={segmentedTouch}
        />
        <p className="text-xs text-muted-foreground">Used only for the energy formula</p>
        <FieldError id="ob-gender-error" message={shows("gender") ? gErr : null} />
      </div>

      <Field id="ob-age" label="Age">
        <input
          id="ob-age"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          value={answers.age}
          onChange={e => update({ age: e.target.value.replace(/[^\d]/g, "") })}
          onBlur={() => touch("age")}
          className={`${inputClass} tabular`}
          {...invalidProps("ob-age-error", aErr, shows("age"))}
        />
        <FieldError id="ob-age-error" message={shows("age") ? aErr : null} />
      </Field>

      <div role="group" aria-labelledby="ob-height-label" className="space-y-2">
        <GroupLabelRow
          id="ob-height-label"
          label="Height"
          control={
            <Segmented<HeightUnit>
              label="Height unit"
              value={answers.heightUnit}
              options={[
                { value: "imperial", label: "ft + in" },
                { value: "metric", label: "cm" },
              ]}
              onChange={onHeightUnit}
              className={`w-40 shrink-0 ${segmentedTouch}`}
            />
          }
        />
        {answers.heightUnit === "imperial" ? (
          <div className="grid grid-cols-2 gap-3">
            <UnitInput
              id="ob-height-ft"
              label="Feet"
              unit="ft"
              value={answers.heightFt}
              onChange={v => update({ heightFt: v })}
              onBlur={() => touch("height")}
              decimal={false}
              describe={heightProps}
            />
            <UnitInput
              id="ob-height-in"
              label="Inches"
              unit="in"
              value={answers.heightIn}
              onChange={v => update({ heightIn: v })}
              onBlur={() => touch("height")}
              decimal
              describe={heightProps}
            />
          </div>
        ) : (
          <UnitInput
            id="ob-height-cm"
            label="Centimeters"
            unit="cm"
            value={answers.heightCm}
            onChange={v => update({ heightCm: v })}
            onBlur={() => touch("height")}
            decimal
            describe={heightProps}
          />
        )}
        <FieldError id="ob-height-error" message={shows("height") ? hErr : null} />
      </div>

      <div role="group" aria-labelledby="ob-weight-label" className="space-y-2">
        <GroupLabelRow
          id="ob-weight-label"
          label="Weight"
          control={
            <Segmented<WeightUnit>
              label="Weight unit"
              value={answers.weightUnit}
              options={[
                { value: "lb", label: "lb" },
                { value: "kg", label: "kg" },
              ]}
              onChange={onWeightUnit}
              className={`w-40 shrink-0 ${segmentedTouch}`}
            />
          }
        />
        <UnitInput
          id="ob-weight"
          label={answers.weightUnit === "lb" ? "Pounds" : "Kilograms"}
          unit={answers.weightUnit}
          value={answers.weight}
          onChange={v => update({ weight: v })}
          onBlur={() => touch("weight")}
          decimal
          describe={weightProps}
        />
        <FieldError id="ob-weight-error" message={shows("weight") ? wErr : null} />
      </div>
    </div>
  );
}

// ---------- 3 & 4. Goal / Activity ----------

export function GoalStep({
  labelledBy,
  value,
  onChange,
  onEnter,
}: {
  labelledBy: string;
  value: Goal | "";
  onChange: (v: Goal) => void;
  onEnter: (v: Goal) => void;
}) {
  return <RadioCards labelledBy={labelledBy} value={value} options={GOAL_OPTIONS} onChange={onChange} onEnter={onEnter} />;
}

export function ActivityStep({
  labelledBy,
  value,
  onChange,
  onEnter,
}: {
  labelledBy: string;
  value: Activity | "";
  onChange: (v: Activity) => void;
  onEnter: (v: Activity) => void;
}) {
  return (
    <RadioCards labelledBy={labelledBy} value={value} options={ACTIVITY_OPTIONS} onChange={onChange} onEnter={onEnter} />
  );
}

// ---------- 5. Food preferences ----------

export function FoodStep({ answers, update, labelledBy }: { answers: Answers; update: Update; labelledBy: string }) {
  const toggle = (option: string) =>
    update(a => ({
      ...a,
      dietary: a.dietary.includes(option) ? a.dietary.filter(d => d !== option) : [...a.dietary, option],
    }));
  return (
    <div className="space-y-6">
      <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {DIETARY_OPTIONS.map(option => (
          <ToggleOption key={option} pressed={answers.dietary.includes(option)} onToggle={() => toggle(option)}>
            {option}
          </ToggleOption>
        ))}
      </div>
      <Field id="ob-food-other" label="Other (optional)" hint="Separate with commas, for example: no pork, low sodium">
        <input
          id="ob-food-other"
          type="text"
          autoComplete="off"
          maxLength={300}
          value={answers.dietaryOther}
          onChange={e => update({ dietaryOther: e.target.value })}
          className={inputClass}
        />
      </Field>
      <p className="text-sm text-muted-foreground">Nothing applies? Continue with none selected.</p>
    </div>
  );
}

// ---------- 6. Review ----------

export function ReviewStep({
  answers,
  onEdit,
  isOffline,
  submitError,
  onRetry,
  submitting,
}: {
  answers: Answers;
  onEdit: (stepIndex: number) => void;
  isOffline: boolean;
  submitError: string | null;
  onRetry: () => void;
  submitting: boolean;
}) {
  const diet = dietaryList(answers);
  const rows: Array<{ key: string; label: string; value: string; step: number }> = [
    { key: "name", label: "Name", value: answers.name.trim() || "Not set", step: 0 },
    { key: "sex", label: "Sex", value: labelFor(GENDER_OPTIONS, answers.gender), step: 1 },
    { key: "age", label: "Age", value: answers.age ? `${answers.age} years` : "Not set", step: 1 },
    { key: "height", label: "Height", value: heightDisplay(answers), step: 1 },
    { key: "weight", label: "Weight", value: weightDisplay(answers), step: 1 },
    { key: "goal", label: "Goal", value: labelFor(GOAL_OPTIONS, answers.fitnessGoal), step: 2 },
    { key: "activity", label: "Activity", value: labelFor(ACTIVITY_OPTIONS, answers.activityLevel), step: 3 },
    { key: "food", label: "Food preferences", value: diet.length ? diet.join(", ") : "None", step: 4 },
  ];

  return (
    <div className="space-y-4">
      <Panel as="div">
        <dl className="divide-y">
          {rows.map(row => (
            <div key={row.key} className="flex items-start gap-3 py-1 first:pt-0 last:pb-0">
              <dt className="w-28 shrink-0 py-3 text-sm text-muted-foreground">{row.label}</dt>
              <dd className="flex min-w-0 flex-1 items-start justify-between gap-2">
                <span className="min-w-0 break-words py-3 text-sm font-medium tabular">{row.value}</span>
                <button
                  type="button"
                  onClick={() => onEdit(row.step)}
                  aria-label={`Edit ${row.label.toLowerCase()}`}
                  disabled={submitting}
                  className="-mr-2 inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
                >
                  Edit
                </button>
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      {isOffline && (
        <StateMessage
          tone="offline"
          title="You're offline"
          body="Your answers are kept on this device. Connect to the internet to create your plan."
        />
      )}

      {submitError && !isOffline && (
        <StateMessage
          tone="error"
          title="We couldn't save your details"
          body={submitError}
          action={
            <button type="button" onClick={onRetry} disabled={submitting} className={secondaryButtonClass}>
              Try again
            </button>
          }
        />
      )}
    </div>
  );
}

// ---------- Result ----------

export interface StartingTargets {
  targetCalories: number;
  protein: number;
  carbs: number;
  fat: number;
}

const MACROS: Array<{ key: "protein" | "carbs" | "fat"; label: string; dot: string }> = [
  { key: "protein", label: "Protein", dot: "bg-protein" },
  { key: "carbs", label: "Carbs", dot: "bg-carbs" },
  { key: "fat", label: "Fat", dot: "bg-fat" },
];

export function ResultStep({
  targets,
  loading,
  failed,
  isOffline,
  onRetry,
}: {
  targets: StartingTargets | null;
  loading: boolean;
  failed: boolean;
  isOffline: boolean;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <div role="status" aria-label="Loading your starting targets" className="rounded-xl border bg-card p-4 md:p-5">
        <SkeletonBlock className="h-4 w-32" />
        <SkeletonBlock className="mt-3 h-10 w-44" />
        <div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4">
          <SkeletonBlock className="h-12" />
          <SkeletonBlock className="h-12" />
          <SkeletonBlock className="h-12" />
        </div>
      </div>
    );
  }

  if (!targets) {
    if (isOffline) {
      return (
        <StateMessage
          tone="offline"
          title="You're offline"
          body="Your details are saved. Reconnect to see your starting targets and continue."
        />
      );
    }
    return (
      <StateMessage
        tone="neutral"
        title={failed ? "Targets didn't load" : "Targets will be on Today"}
        body="Your details are saved. You'll see your starting targets on the Today screen."
        action={
          failed ? (
            <button type="button" onClick={onRetry} className={secondaryButtonClass}>
              Try again
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <Panel as="div">
        <p className="text-sm text-muted-foreground">Daily calorie target</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight tabular">
          {fmtInt(targets.targetCalories)}
          <span className="ml-1.5 text-base font-normal text-muted-foreground">kcal</span>
        </p>
        <dl className="mt-5 grid grid-cols-3 gap-3 border-t pt-4">
          {MACROS.map(m => (
            <div key={m.key} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} aria-hidden="true" />
                {m.label}
              </dt>
              <dd className="mt-0.5 text-lg font-semibold tabular">{fmtInt(targets[m.key])} g</dd>
            </div>
          ))}
        </dl>
      </Panel>
      <p className="text-sm text-muted-foreground">
        Estimated from your profile with a standard formula. Treat it as a starting point — you can change your
        details any time in Profile.
      </p>
    </div>
  );
}
