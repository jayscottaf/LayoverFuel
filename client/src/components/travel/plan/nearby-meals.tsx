import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, Loader2, MapPin, NotebookPen, Pin, Search, X } from "lucide-react";
import { nearbyDiscoverySchema, rankNearbyMeals, type NearbyInput, type NearbyResults, type NearbyMeal } from "@shared/nearby-meals";
import { readApiJson } from "@/lib/queryClient";
import type { PlanMeal, TravelPlan } from "../api";
import { useCapture } from "../capture/capture-context";
import { MacroLine, Segmented } from "../primitives";
import { focusPlanLocation } from "./plan-location";
import { planMealDraft } from "./plan-utils";
import { btnPrimary, btnQuiet, btnSecondary } from "./ui";
import type { PlanMutations } from "./use-plan-mutations";

export function nearbyPlanMeal(meal: NearbyMeal, checkedAt: string): PlanMeal {
  return {
    id: meal.id, name: `${meal.name} - ${meal.venue}`.slice(0, 200),
    description: `${meal.order} Portion: ${meal.portion}`.slice(0, 1000),
    status: "locked", source: "estimate", calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fat: meal.fat,
    venue: { name: meal.venue, address: meal.address, menuUrl: meal.menuUrl, locationUrl: meal.locationUrl, checkedAt, evidence: meal.evidence },
  };
}

export function NearbyMeals({ plan, isToday, readOnly, mutations }: {
  plan: TravelPlan; isToday: boolean; readOnly: boolean; mutations: PlanMutations;
}) {
  const id = useId();
  const area = plan.context.location.startsWith("Near ") ? "" : plan.context.location.trim();
  const [kind, setKind] = useState<NearbyInput["kind"]>(/\b(airport|terminal|concourse)\b/i.test(area) || /^[A-Z]{3}$/.test(area) ? "airport" : "restaurant");
  const [highProtein, setHighProtein] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<NearbyResults | null>(null);
  const controller = useRef<AbortController | null>(null);
  const { open } = useCapture();
  useEffect(() => () => { controller.current?.abort(); }, []);
  useEffect(() => { if (readOnly) { controller.current?.abort(); controller.current = null; setBusy(false); } }, [readOnly]);
  useEffect(() => {
    controller.current?.abort(); controller.current = null;
    setBusy(false); setResults(null); setError("");
  }, [area]);

  const cancel = () => { controller.current?.abort(); controller.current = null; setBusy(false); };
  const search = async () => {
    if (busy || readOnly || area.length < 3) return;
    const request = new AbortController(); controller.current = request;
    setBusy(true); setError(""); setResults(null);
    try {
      const response = await readApiJson<NearbyResults>("POST", "/api/nearby-meals", { area, kind }, { signal: request.signal, timeoutMs: 150_000 });
      if (!nearbyDiscoverySchema.safeParse({ meals: response.meals, places: response.places ?? [],
        airport: response.airport ?? null, locationNote: response.locationNote ?? "" }).success) {
        throw new Error("These results lacked usable menu sources. Try a more specific area or try again.");
      }
      if (controller.current === request) setResults(response);
    } catch (failure) {
      if (controller.current === request) setError(failure instanceof Error ? failure.message : "Menus could not be checked. Try again.");
    } finally { if (controller.current === request) { controller.current = null; setBusy(false); } }
  };
  const meals = results ? rankNearbyMeals(results.meals, plan.remaining.calories,
    Math.max(1, plan.meals.filter(meal => meal.status !== "locked").length), highProtein) : [];
  const places = (results?.places ?? []).filter(place => !meals.some(meal =>
    meal.venue.toLowerCase() === place.venue.toLowerCase() && meal.address.toLowerCase() === place.address.toLowerCase()));

  return <section id="nearby-meals" className="min-w-0 border-t pt-5" aria-labelledby={`${id}-title`}>
    <div className="flex items-center gap-2"><MapPin className="h-5 w-5 text-highlight" /><h2 id={`${id}-title`} className="text-lg font-semibold">Nearby meals</h2></div>
    <form className="mt-4 space-y-3" onSubmit={event => { event.preventDefault(); void search(); }}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0 break-words text-sm">{area.length >= 3 ? area : "Set your location to find nearby meals."}</p>
        <button type="button" className={btnQuiet} onClick={focusPlanLocation}>{area.length >= 3 ? "Change location" : "Set location"}</button>
      </div>
      <p className="text-xs text-muted-foreground">Uses the location saved for this day.</p>
      <Segmented label="Meal search" value={kind} options={[
        { value: "restaurant", label: "Restaurants" }, { value: "grocery", label: "Groceries" }, { value: "airport", label: "Airport" },
      ]} onChange={value => { cancel(); setKind(value); setResults(null); }} />
      {kind === "airport" && <p className="text-xs text-muted-foreground">We'll look for airport dining in this area. Use Change location to specify an airport code or terminal for a more precise search.</p>}
      <p className="text-xs text-muted-foreground">Search sends your saved area to OpenAI, not your health profile or meal history.</p>
      <div className="flex flex-wrap gap-2"><button type="submit" className={btnPrimary} disabled={readOnly || busy || area.length < 3}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{busy ? "Finding meals" : "Find meals"}
      </button>{busy && <button type="button" className={btnQuiet} onClick={cancel}><X className="h-4 w-4" />Cancel</button>}</div>
    </form>
    {readOnly && <p role="status" className="mt-3 text-sm text-muted-foreground">Live menu search needs an internet connection.</p>}
    {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">Searching the web for food places and known menu choices, including local restaurants and airport dining. This may take up to two minutes.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    {results && <>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium">Around {results.area}</p>
        {meals.length > 0 && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={highProtein} onChange={event => setHighProtein(event.target.checked)} />Higher protein first</label>}
      </div>
      {results.airport && <p className="mt-1 text-sm">Airport searched: <a className="text-primary underline" href={results.airport.sourceUrl} target="_blank" rel="noopener noreferrer">{results.airport.name} ({results.airport.code})</a></p>}
      {results.locationNote && <p role="status" className="mt-2 text-sm">{results.locationNote}</p>}
      <p className="text-xs text-muted-foreground">Researched {new Date(results.checkedAt).toLocaleString()}. Nutrition is estimated. Menus may change; confirm hours, route, airport access and dietary/allergy needs with the venue.</p>
      {meals.length === 0 && places.length === 0 && !results.locationNote && <p role="status" className="mt-4 text-sm">No sourced food places were found. Try a more specific location, airport name or terminal.</p>}
      {meals.length === 0 && places.length > 0 && <p role="status" className="mt-3 text-sm">Found food places, but specific menu items could not be confirmed. Check their sources for current choices.</p>}
      <ul className="mt-4 divide-y">{meals.map(meal => {
        const saved = plan.meals.some(item => item.id === meal.id && item.status === "locked");
        const planned = nearbyPlanMeal(meal, results.checkedAt);
        return <li key={meal.id} className="py-4 first:pt-0">
          <p className="text-sm font-medium text-highlight">{meal.venue}</p>
          <p className="mt-1 text-xs text-muted-foreground">{meal.evidence === "live_menu" ? "Menu checked directly" : "Web-sourced food choice · Confirm availability"}</p>
          <h3 className="mt-1 font-semibold">{meal.name}</h3><p className="mt-1 text-sm">{meal.order}</p>
          <p className="mt-1 text-xs text-muted-foreground">{meal.address}{meal.access ? ` · ${meal.access}` : ""}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2"><MacroLine m={meal} /><span className="text-xs text-muted-foreground">Estimate</span></div>
          <p className="mt-1 text-xs text-muted-foreground">Portion: {meal.portion}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a className="inline-flex min-h-11 items-center gap-1 text-primary underline" href={meal.menuUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Food / menu source</a>
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
      {places.length > 0 && <>
        <h3 className="mt-4 font-semibold">{meals.length ? "More food places" : "Food places"}</h3>
        <ul className="mt-2 divide-y">{places.map(place => <li key={place.id} className="py-4">
          <h4 className="font-medium text-highlight">{place.venue}</h4>
          <p className="mt-1 text-sm">{place.details || "Menu details unavailable; check with the venue."}</p>
          <p className="mt-1 text-xs text-muted-foreground">{place.address}{place.access ? ` · ${place.access}` : ""}</p>
          <p className="mt-1 text-xs text-muted-foreground">Specific meal and nutrition not confirmed.</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a className="inline-flex min-h-11 items-center gap-1 text-primary underline" href={place.locationUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Place source</a>
            {place.menuUrl && <a className="inline-flex min-h-11 items-center gap-1 text-primary underline" href={place.menuUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" />Menu source</a>}
          </div>
        </li>)}</ul>
      </>}
    </>}
  </section>;
}
