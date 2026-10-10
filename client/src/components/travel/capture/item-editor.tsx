import { Minus, Plus, Trash2 } from "lucide-react";
import type { Macros } from "../api";
import { SourceBadge, inputClass } from "../primitives";
import { withMacro, withQuantity, type ReviewItem } from "./draft";
import { NumberInput } from "./number-input";
import { iconBtn, numberInputClass, stepBtn } from "./ui";

const MACRO_FIELDS: Array<{ key: keyof Macros; label: string; unit: string; decimals: number }> = [
  { key: "calories", label: "Calories", unit: "kcal", decimals: 0 },
  { key: "protein", label: "Protein", unit: "g", decimals: 1 },
  { key: "carbs", label: "Carbs", unit: "g", decimals: 1 },
  { key: "fat", label: "Fat", unit: "g", decimals: 1 },
];

const roundQty = (n: number) => Math.round(n * 100) / 100;

/** Step size that suits the magnitude: halves for servings, tens for grams. */
function upStep(q: number) {
  return q >= 20 ? 10 : q >= 4 ? 1 : 0.5;
}
function downStep(q: number) {
  return q > 20 ? 10 : q > 4 ? 1 : 0.5;
}

/** "× 30 g" when the unit is itself an amount, otherwise the unit word. */
function unitText(unit: string) {
  return /^\d/.test(unit) ? `× ${unit}` : unit;
}

export function ItemEditor({
  item,
  index,
  onChange,
  onRemove,
  autoFocusName = false,
}: {
  item: ReviewItem;
  index: number;
  onChange: (item: ReviewItem) => void;
  onRemove: () => void;
  autoFocusName?: boolean;
}) {
  const id = item.uid;
  const label = item.name.trim() || `item ${index + 1}`;
  const q = item.quantity;
  const canDecrease = roundQty(q - downStep(q)) > 0;

  return (
    <fieldset className="min-w-0 space-y-3 p-3">
      <legend className="sr-only">Item {index + 1}</legend>

      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-name`} className="sr-only">
            Item name
          </label>
          <input
            id={`${id}-name`}
            value={item.name}
            onChange={e => onChange({ ...item, name: e.target.value })}
            placeholder="Item name, e.g. Greek yogurt"
            autoFocus={autoFocusName}
            autoComplete="off"
            className={`${inputClass} font-medium`}
          />
          <SourceBadge source={item.source} className="mt-1.5" />
        </div>
        <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} className={iconBtn}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor={`${id}-qty`} className="w-14 shrink-0 text-sm text-muted-foreground">
          Amount
        </label>
        <button
          type="button"
          onClick={() => onChange(withQuantity(item, roundQty(q - downStep(q))))}
          disabled={!canDecrease}
          aria-label={`Decrease amount of ${label}`}
          className={stepBtn}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </button>
        <NumberInput
          id={`${id}-qty`}
          value={q}
          decimals={2}
          onValue={n => onChange(withQuantity(item, n))}
          className={`${numberInputClass} w-20 text-center`}
        />
        <button
          type="button"
          onClick={() => onChange(withQuantity(item, roundQty(q + upStep(q))))}
          aria-label={`Increase amount of ${label}`}
          className={stepBtn}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
        <span className="min-w-0 truncate text-sm text-muted-foreground" title={item.unit}>
          {unitText(item.unit)}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {MACRO_FIELDS.map(f => (
          <div key={f.key} className="min-w-0 space-y-1">
            <label htmlFor={`${id}-${f.key}`} className="block truncate text-xs text-muted-foreground">
              {f.label}
              <span className="sr-only"> in {f.unit === "g" ? "grams" : "kilocalories"}</span>
              {f.unit === "g" && <span aria-hidden="true"> g</span>}
            </label>
            <NumberInput
              id={`${id}-${f.key}`}
              value={item[f.key]}
              decimals={f.decimals}
              onValue={n => onChange(withMacro(item, f.key, n))}
              className={`${numberInputClass} w-full`}
            />
          </div>
        ))}
      </div>
    </fieldset>
  );
}
