import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Loader2, LocateFixed } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { PLAN_PATTERN_LABELS, type PlanContext, type PlanPattern, type TravelPlan } from "../api";
import { Field, Panel, SectionTitle, SkeletonBlock, inputClass } from "../primitives";
import { EQUIPMENT_OPTIONS, PLAN_PATTERNS, contextsEqual, normalizeContext, toggleEquipment } from "./plan-utils";
import { btnLink, btnPrimary, btnQuiet, textareaClass } from "./ui";
import type { PlanBusy, SaveOutcome } from "./use-plan-mutations";
import { useGeolocation } from "./use-geolocation";

/** The location input, so other parts of the screen can send people here. */
export const PLAN_LOCATION_INPUT_ID = "plan-context-location";

function PatternPicker({
  value,
  onChange,
  labelId,
}: {
  value: PlanPattern;
  onChange: (p: PlanPattern) => void;
  labelId: string;
}) {
  const uid = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = PLAN_PATTERNS.indexOf(value);

  const select = (index: number) => {
    const n = PLAN_PATTERNS.length;
    const next = ((index % n) + n) % n;
    onChange(PLAN_PATTERNS[next]);
    refs.current[next]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const moves: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowRight: index + 1,
      ArrowUp: index - 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: PLAN_PATTERNS.length - 1,
    };
    if (Object.prototype.hasOwnProperty.call(moves, e.key)) {
      e.preventDefault();
      select(moves[e.key]);
    }
  };

  return (
    <div role="radiogroup" aria-labelledby={labelId} className="grid gap-2">
      {PLAN_PATTERNS.map((pattern, index) => {
        const checked = pattern === value;
        const { title, blurb } = PLAN_PATTERN_LABELS[pattern];
        const titleId = `${uid}-${pattern}-title`;
        const blurbId = `${uid}-${pattern}-blurb`;
        return (
          <button
            key={pattern}
            ref={el => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-labelledby={titleId}
            aria-describedby={blurbId}
            tabIndex={checked || (selected === -1 && index === 0) ? 0 : -1}
            onClick={() => onChange(pattern)}
            onKeyDown={e => onKeyDown(e, index)}
            className={`flex min-h-11 w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
              checked ? "border-primary bg-primary/5" : "border-input hover:bg-secondary"
            }`}
          >
            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                checked ? "border-primary" : "border-input"
              }`}
              aria-hidden="true"
            >
              {checked && <span className="h-2 w-2 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span id={titleId} className="block text-sm font-medium">
                {title}
              </span>
              <span id={blurbId} className="mt-0.5 block text-xs text-muted-foreground">
                {blurb}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EquipmentPicker({
  value,
  onToggle,
}: {
  value: string[];
  onToggle: (option: string, on: boolean) => void;
}) {
  const uid = useId();
  return (
    <fieldset>
      <legend className="text-sm font-medium">What you have</legend>
      <div className="-mx-2 mt-1.5 grid grid-cols-2 gap-x-1">
        {EQUIPMENT_OPTIONS.map(option => {
          const id = `${uid}-${option.value.replace(/\s+/g, "-")}`;
          const checked = value.includes(option.value);
          return (
            <label
              key={option.value}
              htmlFor={id}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 transition-colors hover:bg-secondary"
            >
              <Checkbox
                id={id}
                checked={checked}
                onCheckedChange={next => onToggle(option.value, next === true)}
              />
              <span className="text-sm">{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Where the user is and what they have to work with. Edits stay local until
 * Save; a background refetch only replaces the form when nothing is unsaved.
 * The parent remounts this per plan date.
 */
export function ContextEditor({
  plan,
  readOnly,
  readOnlyNoteId,
  busy,
  onSave,
}: {
  plan: TravelPlan;
  readOnly: boolean;
  readOnlyNoteId?: string;
  busy: PlanBusy;
  onSave: (context: PlanContext) => Promise<SaveOutcome>;
}) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const patternLabelId = `${uid}-pattern`;
  const geoNoteId = `${uid}-geo-note`;
  const statusId = `${uid}-status`;

  const serverContext = useMemo(() => normalizeContext(plan.context), [plan.context]);
  const [baseline, setBaseline] = useState<PlanContext>(serverContext);
  const [form, setForm] = useState<PlanContext>(serverContext);
  const [geoFilled, setGeoFilled] = useState<string | null>(null);
  const geo = useGeolocation();

  const dirty = !contextsEqual(form, baseline);
  const saving = busy?.kind === "context";
  const canSave = dirty && !readOnly && busy === null;

  // Track the latest dirty state for the sync effect below without re-running it on every keystroke.
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  });

  // A refetch (after a log, a conflict, or another device's save) moves the baseline.
  // The form follows only when there are no unsaved edits.
  useEffect(() => {
    setBaseline(serverContext);
    if (!dirtyRef.current) setForm(serverContext);
  }, [serverContext]);

  const update = <K extends keyof PlanContext>(key: K, value: PlanContext[K]) =>
    setForm(f => ({ ...f, [key]: value }));

  const fillFromLocation = () => {
    geo.locate(({ latitude, longitude }) => {
      const value = `Near ${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      setForm(f => ({ ...f, location: value }));
      setGeoFilled(value);
    });
  };

  const discard = () => {
    setForm(baseline);
    setGeoFilled(null);
    geo.reset();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    const outcome = await onSave(form);
    if (outcome.ok) {
      const saved = normalizeContext(outcome.plan.context);
      setBaseline(saved);
      setForm(saved);
      setGeoFilled(null);
    }
    // On a conflict the plan reloads and the form keeps the user's edits to save again.
  };

  const showGeoNote = geoFilled !== null && form.location === geoFilled;
  const geoError = geo.state.status === "error" ? geo.state.message : null;
  const geoText = showGeoNote
    ? "Only coordinates are saved — we don't look up place names yet. Edit this to add the city or hotel."
    : geoError;
  const locationDescribedBy = geoText ? geoNoteId : undefined;

  let status: string;
  if (readOnly) {
    status = dirty
      ? "You're offline. Your changes stay here until you can save them."
      : "You're offline. You can save changes when you reconnect.";
  } else if (saving) status = "Saving";
  else if (dirty) status = "You have unsaved changes.";
  else status = "Saved for this day.";

  return (
    <Panel labelledBy={titleId}>
      <SectionTitle id={titleId}>Where you are and what you have</SectionTitle>
      <p className="-mt-1 mb-4 text-sm text-muted-foreground">
        Meal ideas currently use your travel pattern, dietary needs, targets and kept meals. Location, meal
        windows, equipment and notes are saved for your reference and don&apos;t change the ideas yet.
      </p>

      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="space-y-1.5">
          <Field id={PLAN_LOCATION_INPUT_ID} label="Location">
            <input
              id={PLAN_LOCATION_INPUT_ID}
              type="text"
              autoComplete="off"
              maxLength={160}
              placeholder="City, airport, hotel or area"
              value={form.location}
              aria-describedby={locationDescribedBy}
              onChange={e => {
                update("location", e.target.value);
                if (geo.state.status === "error") geo.reset();
              }}
              className={inputClass}
            />
          </Field>
          {geo.supported && (
            <button
              type="button"
              aria-disabled={geo.state.status === "locating" || undefined}
              onClick={() => {
                if (geo.state.status !== "locating") fillFromLocation();
              }}
              className={btnLink}
            >
              {geo.state.status === "locating" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <LocateFixed className="h-4 w-4" aria-hidden="true" />
              )}
              {geo.state.status === "locating" ? "Finding your location" : "Use my current location"}
            </button>
          )}
          {/* Always mounted so the note is announced; visually hidden while empty. */}
          <div id={geoNoteId} role="status" className={geoText ? "text-xs text-muted-foreground" : "sr-only"}>
            {geoText}
          </div>
        </div>

        <div className="space-y-1.5">
          <p id={patternLabelId} className="text-sm font-medium">
            How you'll eat
          </p>
          <PatternPicker value={form.pattern} onChange={p => update("pattern", p)} labelId={patternLabelId} />
        </div>

        <Field id={`${uid}-windows`} label="Meal windows">
          <input
            id={`${uid}-windows`}
            type="text"
            autoComplete="off"
            maxLength={240}
            value={form.mealWindow}
            aria-describedby={`${uid}-windows-hint`}
            onChange={e => update("mealWindow", e.target.value)}
            className={inputClass}
          />
          <p id={`${uid}-windows-hint`} className="text-xs text-muted-foreground">
            e.g. free 12:00–13:00, meeting until 18:30, dinner after 19:00
          </p>
        </Field>

        <EquipmentPicker
          value={form.equipment}
          onToggle={(option, on) => setForm(f => ({ ...f, equipment: toggleEquipment(f.equipment, option, on) }))}
        />

        <Field id={`${uid}-notes`} label="Notes">
          <textarea
            id={`${uid}-notes`}
            rows={3}
            maxLength={1000}
            value={form.notes}
            aria-describedby={`${uid}-notes-hint`}
            onChange={e => update("notes", e.target.value)}
            className={textareaClass}
          />
          <p id={`${uid}-notes-hint`} className="text-xs text-muted-foreground">
            Fixed meals, dietary needs, anything to plan around
          </p>
        </Field>

        <div className="flex flex-col gap-2 border-t pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              aria-disabled={!canSave || undefined}
              aria-describedby={readOnly && readOnlyNoteId ? `${statusId} ${readOnlyNoteId}` : statusId}
              className={btnPrimary}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </button>
            {dirty && !saving && (
              <button type="button" onClick={discard} className={btnQuiet}>
                Discard changes
              </button>
            )}
          </div>
          <p id={statusId} className="text-xs text-muted-foreground">
            {status}
          </p>
        </div>
      </form>
    </Panel>
  );
}

export function ContextSkeleton() {
  return (
    <Panel>
      <SkeletonBlock className="h-5 w-56" />
      <SkeletonBlock className="mt-5 h-4 w-20" />
      <SkeletonBlock className="mt-2 h-11 w-full" />
      <SkeletonBlock className="mt-5 h-4 w-28" />
      {[0, 1, 2].map(i => (
        <SkeletonBlock key={i} className="mt-2 h-16 w-full" />
      ))}
      <SkeletonBlock className="mt-5 h-4 w-24" />
      <SkeletonBlock className="mt-2 h-11 w-full" />
      <SkeletonBlock className="mt-5 h-11 w-40" />
    </Panel>
  );
}
