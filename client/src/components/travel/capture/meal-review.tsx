import { useState } from "react";
import { AlertCircle, Info, Loader2, Plus } from "lucide-react";
import {
  MEAL_CONTEXT_LABELS,
  MEAL_SLOTS,
  MEAL_SLOT_LABELS,
  sumMacros,
  type MealContext,
  type MealSlot,
} from "../api";
import { Field, MacroLine, Segmented, StateMessage, fmtInt, inputClass } from "../primitives";
import { emptyItem, hasEstimate, isMealContext, withItems, type ReviewDraft, type ReviewItem } from "./draft";
import { ItemEditor } from "./item-editor";
import { SheetBody, SheetFooter } from "./sheet";
import { btnGhost, btnPrimary } from "./ui";

const SLOT_OPTIONS = MEAL_SLOTS.map(s => ({ value: s, label: MEAL_SLOT_LABELS[s] }));
const CONTEXT_OPTIONS = Object.entries(MEAL_CONTEXT_LABELS) as Array<[MealContext, string]>;
const CONFIDENCE_LABELS = { low: "Low confidence", medium: "Medium confidence", high: "High confidence" } as const;

function EstimateNote({ draft }: { draft: ReviewDraft }) {
  const { range, confidence, origin } = draft;
  const caveat =
    origin === "photo" || origin === "describe"
      ? "Photo and text estimates can miss oils and portion size — adjust if you know better."
      : origin === "plan"
        ? "These are the planned numbers, not a verified menu. Adjust them to match what you actually ate."
        : "Some values are estimates — adjust if you know better.";
  return (
    <div className="rounded-xl bg-highlight-soft p-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium">
        <Info className="h-4 w-4 shrink-0 text-highlight" aria-hidden="true" />
        Estimate
      </p>
      {(range || confidence) && (
        <p className="mt-1 tabular">
          {range && (
            <>
              Likely {fmtInt(range.caloriesLow)}–{fmtInt(range.caloriesHigh)} kcal
            </>
          )}
          {range && confidence && <span aria-hidden="true"> · </span>}
          {confidence && CONFIDENCE_LABELS[confidence]}
        </p>
      )}
      {draft.estimateNote && <p className="mt-1 text-muted-foreground">{draft.estimateNote}</p>}
      <p className="mt-1 text-muted-foreground">{caveat}</p>
    </div>
  );
}

export function MealReview({
  draft,
  onChange,
  mode,
  offline,
  saving,
  error,
  onSave,
}: {
  draft: ReviewDraft;
  onChange: (next: ReviewDraft) => void;
  mode: "new" | "edit";
  offline: boolean;
  saving: boolean;
  error: string | null;
  onSave: () => void;
}) {
  const [focusUid, setFocusUid] = useState<string | null>(null);
  const totals = sumMacros(draft.items);
  const nameEmpty = !draft.name.trim();
  const allZero = totals.calories <= 0 && totals.protein <= 0 && totals.carbs <= 0 && totals.fat <= 0;
  const noItems = draft.items.length === 0;
  const editBlocked = mode === "edit" && offline;
  const canSave = !saving && !noItems && !(allZero && nameEmpty) && !editBlocked;
  const fromDatabase = draft.items.some(i => i.source === "database");

  const setItems = (items: ReviewItem[]) => onChange(withItems(draft, items));
  const updateItem = (uid: string, next: ReviewItem) => setItems(draft.items.map(i => (i.uid === uid ? next : i)));
  const removeItem = (uid: string) => setItems(draft.items.filter(i => i.uid !== uid));
  const addItem = () => {
    const item = emptyItem();
    setFocusUid(item.uid);
    setItems([...draft.items, item]);
  };

  let hint: string | null = null;
  if (editBlocked) hint = "You're offline. Changes to a saved meal need a connection.";
  else if (noItems) hint = "Add at least one item to save this meal.";
  else if (allZero && nameEmpty) hint = "Add a name or some nutrition values to save.";
  else if (offline) hint = "You're offline. This meal will be kept on this device and sync when you reconnect.";

  return (
    <>
      <SheetBody hasFooter>
        <div className="space-y-5">
          <div className="flex items-end gap-3">
            {draft.photoPreview && (
              <img
                src={draft.photoPreview}
                alt="Your meal photo"
                className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-lg border bg-muted object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <Field id="capture-meal-name" label="Meal name">
                <input
                  id="capture-meal-name"
                  value={draft.name}
                  onChange={e => onChange({ ...draft, name: e.target.value })}
                  placeholder="e.g. Chicken burrito bowl"
                  autoComplete="off"
                  maxLength={200}
                  className={inputClass}
                />
              </Field>
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-sm font-medium" aria-hidden="true">
              Meal
            </p>
            <Segmented<MealSlot>
              label="Meal"
              value={draft.mealStyle}
              options={SLOT_OPTIONS}
              onChange={v => onChange({ ...draft, mealStyle: v })}
            />
          </div>

          <Field id="capture-meal-where" label="Where (optional)">
            <select
              id="capture-meal-where"
              value={draft.context ?? ""}
              onChange={e => {
                const v = e.target.value;
                onChange({ ...draft, context: isMealContext(v) ? v : undefined });
              }}
              className={inputClass}
            >
              <option value="">Not set</option>
              {CONTEXT_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>

          {hasEstimate(draft) && <EstimateNote draft={draft} />}
          {fromDatabase && (
            <p className="text-xs text-muted-foreground">
              Food database values come from Open Food Facts, a crowd-sourced database. Check them against the
              package label when you can.
            </p>
          )}

          <section aria-labelledby="capture-items-title">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h3 id="capture-items-title" className="text-sm font-semibold">
                Items
              </h3>
              <button type="button" onClick={addItem} className={`${btnGhost} -mr-3`}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add item
              </button>
            </div>
            {noItems ? (
              <StateMessage title="No items" body="Add an item to save this meal." />
            ) : (
              <div className="divide-y rounded-xl border bg-background">
                {draft.items.map((item, index) => (
                  <ItemEditor
                    key={item.uid}
                    item={item}
                    index={index}
                    autoFocusName={item.uid === focusUid}
                    onChange={next => updateItem(item.uid, next)}
                    onRemove={() => removeItem(item.uid)}
                  />
                ))}
              </div>
            )}
          </section>

          <div className="flex items-end justify-between gap-3 rounded-xl bg-secondary p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">Total</p>
              <MacroLine m={totals} className="mt-0.5" />
            </div>
            <p className="shrink-0 text-3xl font-semibold tracking-tight tabular">
              {fmtInt(totals.calories)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">kcal</span>
            </p>
          </div>
        </div>
      </SheetBody>

      <SheetFooter>
        {error && (
          <div role="alert" className="flex items-start gap-2 rounded-lg bg-danger-soft p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0">
              <p className="font-medium">{mode === "edit" ? "Couldn't update this meal" : "Couldn't save this meal"}</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </div>
        )}
        {hint && (!error || editBlocked) && <p className="text-xs text-muted-foreground">{hint}</p>}
        <button type="button" onClick={onSave} disabled={!canSave} className={`${btnPrimary} w-full`}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Saving
            </>
          ) : error ? (
            "Try again"
          ) : mode === "edit" ? (
            "Save changes"
          ) : (
            "Save meal"
          )}
        </button>
        {saving && (
          <p role="status" className="sr-only">
            Saving your meal
          </p>
        )}
      </SheetFooter>
    </>
  );
}
