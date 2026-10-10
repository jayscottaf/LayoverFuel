import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, Loader2, MapPin, NotebookPen, Pin, Search, X } from "lucide-react";
import { nearbyResearchSchema, rankNearbyMeals, type NearbyInput, type NearbyResults, type NearbyMeal } from "@shared/nearby-meals";
import { readApiJson } from "@/lib/queryClient";
import type { PlanMeal, TravelPlan } from "../api";
import { useCapture } from "../capture/capture-context";
import { MacroLine, Segmented, inputClass } from "../primitives";
import { CurrentAreaButton } from "./current-area-button";
import { planMealDraft } from "./plan-utils";
import { btnPrimary, btnQuiet, btnSecondary } from "./ui";
import type { PlanMutations } from "./use-plan-mutations";

export function nearbyPlanMeal(meal: NearbyMeal, checkedAt: string): PlanMeal {
  return {
    id: meal.id, name: `${meal.name} - ${meal.venue}`.slice(0, 200),
    description: `${meal.order} Portion: ${meal.portion}`.slice(0, 1000),
    status: "locked", source: "estimate", calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat,
    venue: { name: meal.venue, address: meal.address, menuUrl: meal.menuUrl, locationUrl: meal.locationUrl, checkedAt },
  };
}

export function NearbyMeals({ plan, isToday, readOnly, mutations }: {
  plan: TravelPlan; isToday: boolean; readOnly: boolean; mutations: PlanMutations;
}) {
  const id = useId();
  const [area, setArea] = useState(plan.context.location.startsWith("Near ") ? "" : plan.context.location);
  const [kind, setKind] = useState<NearbyInput["kind"]>("restaurant");
  const [highProtein, setHighProtein] = useState(false);
  const [locating, setLocating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<NearbyResults | null>(null);
  const controller = useRef<AbortController | null>(null);
  const savedArea = useRef(plan.context.location);
  const { open } = useCapture();
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => { if (readOnly) { controller.current?.abort(); controller.current = null; setBusy(false); } }, [readOnly]);
  useEffect(() => {
    if (savedArea.current === plan.context.location) return;
    if (area === savedArea.current && !busy && !locating) { setArea(plan.context.location); setResults(null); }
    savedArea.current = plan.context.location;
  }, [plan.context.location, area, busy, locating]);

  const cancel = () => { controller.current?.abort(); controller.current = null; setBusy(false); };
  const search = async () => {
    if (busy || locating || readOnly || area.trim().length < 3) return;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError(""); setResults(null);
    try {
      const response = await readApiJson<NearbyResults>("POST", "/api/nearby-meals", { area: area.trim(), kind }, { signal: request.signal, timeoutMs: 80_000 });
      nearbyResearchSchema.parse({ meals: response.meals });
      if (controller.current === request) setResults(response);
    } catch (failure) {
      if (controller.current === request) setError(failure instanceof Error ? failure.message : "Menus could not be checked. Try again.");
    } finally { if (controller.current === request) { controller.current = null; setBusy(false); } }
  };
  const changeArea = (value: string) => { cancel(); setArea(value); setResults(null); setError(""); };
  const meals = results ? rankNearbyMeals(results.meals, plan.remaining.calories,
    Math.max(1, plan.meals.filter(meal => meal.status !== "locked").length), highProtein) : [];

  return <section id="nearby-meals" className="min-w-0 border-t pt-5" aria-labelledby={`${id}-title`}>
    <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-highlight" /><h2 id={`${id}-title`} className="text-lg font-semibold">Nearby meals</h2></div>
    <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void search(); }}>
      <label htmlFor={`${id}-area`} className="block text-sm font-medium">City, neighborhood or airport terminal</label>
      <input id={`${id}-area`} className={inputClass} value={area} maxLength={160} disabled={locating || readOnly}
        onChange={event => changeArea(event.target.value)} placeholder="Nashville, TN or LGA Terminal B" />
      <CurrentAreaButton disabled={readOnly || busy} onFound={changeArea} onBusyChange={setLocating} />
      <Segmented label="Meal search" value={kind} options={[
        { value: "restaurant", label: "Restaurants" }, { value: "grocery", label: "Groceries" }, { value: "airport", label: "Airport" },
      ]} onChange={value => { cancel(); setKind(value); setResults(null); }} />
      <p className="text-xs text-muted-foreground">Search sends the entered area to OpenAI, not your health profile or meal history.</p>
      <div className="flex flex-wrap gap-2"><button type="submit" className={btnPrimary} disabled={readOnly || locating || busy || area.trim().length < 3}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{busy ? "Checking menus" : "Find meals"}
      </button>{busy && <button type="button" className={btnQuiet} onClick={cancel}><X className="h-4 w-4" />Cancel</button>}</div>
    </form>
    {readOnly && <p role="status" className="mt-3 text-sm text-muted-foreground">Live menu search needs an internet connection.</p>}
    {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">Looking up places and their menus. This may take a minute.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {results && <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium">Around {results.area}</p>
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={highProtein} onChange={event => setHighProtein(event.target.checked)} />Higher protein first</label>
      </div>
      <p className="text-xs text-muted-foreground">Researched {new Date(results.checkedAt).toLocaleString()}. Nutrition is estimated. Menus may change; confirm hours, route, airport access and dietary/allergy needs with the venue.</p>
      {meals.length === 0 && <p role="status" className="mt-4 text-sm">No menu choices with both menu and location sources were found. Try a neighborhood, a different city, or an airport terminal.</p>}
      <ul className="mt-4 divide-y">{meals.map(meal => {
        const saved = plan.meals.some(item => item.id === meal.id && item.status === "locked");
        const planned = nearbyPlanMeal(meal, results.checkedAt);
        return <li key={meal.id} className="py-4 first:pt-0">
          <p className="text-sm font-medium text-highlight">{meal.venue}</p>
          <h3 className="mt-1 font-semibold">{meal.name}</h3><p className="mt-1 text-sm">{meal.order}</p>
          <p className="mt-1 text-xs text-muted-foreground">{meal.address}{meal.access ? ` · ${meal.access}` : ""}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2"><MacroLine m={meal} /><span className="text-xs text-muted-foreground">Estimate</span></div>
          <p className="mt-1 text-xs text-muted-foreground">Portion: {meal.portion}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a className="inline-flex min-h-11 items-center gap-1 text-primary underline" href={meal.menuUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Menu source</a>
            <a className="inline-flex min-h-11 items-center gap-1 text-primary underline" href={meal.locationUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Location source</a>
            <a className="inline-flex min-h-11 items-center gap-1 text-primary underline" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${meal.venue} ${meal.address}`)}`} target="_blank" rel="noopener noreferrer"><MapPin className="h-3.5 w-3.5" />Map</a>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <button className={btnSecondary} type="button" disabled={readOnly || !!mutations.busy || saved || plan.meals.length >= 10}
              onClick={() => void mutations.addMeal(planned)}><Pin className="h-4 w-4" />{saved ? "Kept in plan" : "Keep in plan"}</button>
            {isToday && <button className={btnQuiet} type="button" onClick={() => open({ date: plan.date, draft: planMealDraft(planned, plan.date) })}><NotebookPen className="h-4 w-4" />Review & log</button>}
          </div>
        </li>;
      })}</ul>
    </>}
  </section>;
}
