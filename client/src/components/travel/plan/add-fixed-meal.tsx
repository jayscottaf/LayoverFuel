import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import type { PlanMeal } from "../api";
import { NumberInput } from "../capture/number-input";
import { Field, inputClass } from "../primitives";
import { fixedMeal, type FixedMealInput } from "./plan-utils";
import { btnPrimary, btnQuiet, btnSecondary, numberInputClass } from "./ui";
import type { PlanBusy, SaveOutcome } from "./use-plan-mutations";

const EMPTY: FixedMealInput = { name: "", description: "", calories: 0, protein: 0, carbs: 0, fat: 0 };

const NUMBER_FIELDS: Array<{ key: "calories" | "protein" | "carbs" | "fat"; label: string; decimals: number }> = [
  { key: "calories", label: "Calories (kcal)", decimals: 0 },
  { key: "protein", label: "Protein (g)", decimals: 1 },
  { key: "carbs", label: "Carbs (g)", decimals: 1 },
  { key: "fat", label: "Fat (g)", decimals: 1 },
];

/**
 * A meal that's already decided (a client dinner, a crew meal, a group lunch).
 * It is saved as a kept, user-entered meal so the rest of the plan works around it.
 */
export function AddFixedMeal({
  readOnly,
  readOnlyNoteId,
  busy,
  onAdd,
}: {
  readOnly: boolean;
  readOnlyNoteId?: string;
  busy: PlanBusy;
  onAdd: (meal: PlanMeal) => Promise<SaveOutcome>;
}) {
  const uid = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FixedMealInput>(EMPTY);
  const [nameError, setNameError] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(false);

  const adding = busy?.kind === "add";
  const blocked = readOnly || busy !== null;
  const describedBy = readOnly ? readOnlyNoteId : undefined;

  useEffect(() => {
    if (open) {
      nameRef.current?.focus();
    } else if (returnFocus.current) {
      returnFocus.current = false;
      toggleRef.current?.focus();
    }
  }, [open]);

  const close = () => {
    returnFocus.current = true;
    setOpen(false);
    setForm(EMPTY);
    setNameError(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    if (!form.name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    const outcome = await onAdd(fixedMeal(form));
    // On a conflict or failure the form stays open with what was typed.
    if (outcome.ok) close();
  };

  if (!open) {
    return (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Already have a meal set, like a client dinner or a group lunch? Add it and it stays in your plan.
        </p>
        <button
          ref={toggleRef}
          type="button"
          aria-disabled={readOnly || undefined}
          aria-describedby={describedBy}
          onClick={() => {
            if (!readOnly) setOpen(true);
          }}
          className={`${btnSecondary} shrink-0`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add a fixed meal
        </button>
      </div>
    );
  }

  const nameId = `${uid}-name`;
  const nameErrorId = `${uid}-name-error`;
  const hintId = `${uid}-numbers-hint`;

  return (
    <form onSubmit={submit} noValidate aria-labelledby={`${uid}-title`} className="flex flex-col gap-4">
      <div>
        <h3 id={`${uid}-title`} className="font-medium">
          Add a fixed meal
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">It's kept in your plan until you remove it.</p>
      </div>

      <Field id={nameId} label="Name">
        <input
          ref={nameRef}
          id={nameId}
          type="text"
          required
          autoComplete="off"
          maxLength={120}
          placeholder="e.g. Client dinner"
          value={form.name}
          aria-invalid={nameError || undefined}
          aria-describedby={nameError ? nameErrorId : undefined}
          onChange={e => {
            const name = e.target.value;
            setForm(f => ({ ...f, name }));
            if (nameError && name.trim()) setNameError(false);
          }}
          className={inputClass}
        />
        {nameError && (
          <p id={nameErrorId} className="text-xs text-destructive">
            Add a name for this meal.
          </p>
        )}
      </Field>

      <Field id={`${uid}-description`} label="Description (optional)">
        <input
          id={`${uid}-description`}
          type="text"
          autoComplete="off"
          maxLength={240}
          placeholder="e.g. Team dinner at 19:30, likely steak and sides"
          value={form.description}
          onChange={e => {
            const description = e.target.value;
            setForm(f => ({ ...f, description }));
          }}
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className="text-sm font-medium">Estimated nutrition</legend>
        <p id={hintId} className="mt-0.5 text-xs text-muted-foreground">
          A rough guess is fine.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {NUMBER_FIELDS.map(f => {
            const id = `${uid}-${f.key}`;
            return (
              <div key={f.key} className="min-w-0 space-y-1.5">
                <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
                  {f.label}
                </label>
                <NumberInput
                  id={id}
                  value={form[f.key]}
                  decimals={f.decimals}
                  onValue={n => setForm(prev => ({ ...prev, [f.key]: n }))}
                  aria-describedby={hintId}
                  className={numberInputClass}
                />
              </div>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          aria-disabled={blocked || undefined}
          aria-describedby={describedBy}
          className={btnPrimary}
        >
          {adding ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Adding
            </>
          ) : (
            "Add to plan"
          )}
        </button>
        <button type="button" onClick={close} className={btnQuiet}>
          Cancel
        </button>
      </div>
    </form>
  );
}
