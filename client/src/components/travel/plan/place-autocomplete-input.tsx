import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { readApiJson } from "@/lib/queryClient";

interface Suggestion { label: string; main: string; secondary: string }

/** Whether the server has a Google Maps key; without one the field stays a plain text box. */
export function usePlacesConfig() {
  return useQuery({
    queryKey: ["/api/places/config"],
    queryFn: () => readApiJson<{ google: boolean }>("GET", "/api/places/config"),
    staleTime: Infinity, retry: false,
  }).data?.google ?? false;
}

const newSessionToken = () => crypto.randomUUID().replace(/-/g, "");

// A text input with Google place suggestions. Typing stays free-form: a suggestion only fills
// the box, so airport terminals and anything Google does not list can still be entered.
export function PlaceAutocompleteInput({ id, value, onChange, disabled, placeholder, maxLength, className }: {
  id: string; value: string; onChange: (value: string) => void;
  disabled?: boolean; placeholder?: string; maxLength?: number; className?: string;
}) {
  const enabled = usePlacesConfig();
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const session = useRef(newSessionToken());
  const typed = useRef(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    const query = value.trim();
    if (!enabled || !typed.current || query.length < 3) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      request.current?.abort();
      const controller = new AbortController(); request.current = controller;
      try {
        const result = await readApiJson<{ suggestions: Suggestion[] }>("POST", "/api/places/autocomplete",
          { input: query.slice(0, 120), sessionToken: session.current }, { signal: controller.signal, timeoutMs: 10_000 });
        if (request.current !== controller) return;
        setSuggestions(result.suggestions); setActive(-1); setOpen(true);
      } catch {
        if (request.current === controller) setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [value, enabled]);
  useEffect(() => () => request.current?.abort(), []);

  const choose = (suggestion: Suggestion) => {
    typed.current = false; request.current?.abort();
    onChange(suggestion.label); setSuggestions([]); setOpen(false);
    session.current = newSessionToken();
  };
  const showList = open && suggestions.length > 0 && !disabled;
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!showList) return;
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(i => (i + 1) % suggestions.length); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => (i <= 0 ? suggestions.length : i) - 1); }
    else if (event.key === "Enter" && active >= 0) { event.preventDefault(); choose(suggestions[active]); }
    else if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        autoComplete="off"
        role={enabled ? "combobox" : undefined}
        aria-autocomplete={enabled ? "list" : undefined}
        aria-expanded={enabled ? showList : undefined}
        aria-controls={enabled ? listId : undefined}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        maxLength={maxLength}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={e => { typed.current = true; onChange(e.target.value); }}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setOpen(false)}
        className={className}
      />
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 z-20 mt-1 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg">
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.label}-${index}`}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // mousedown keeps focus in the input so blur does not close the list first
              onMouseDown={event => { event.preventDefault(); choose(suggestion); }}
              onMouseEnter={() => setActive(index)}
              className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-sm ${index === active ? "bg-accent text-accent-foreground" : ""}`}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span><span className="font-medium">{suggestion.main}</span>{suggestion.secondary && <span className="text-muted-foreground"> · {suggestion.secondary}</span>}</span>
            </li>
          ))}
          <li role="presentation" className="px-3 py-1 text-right text-[10px] text-muted-foreground">Suggestions by Google</li>
        </ul>
      )}
    </div>
  );
}
