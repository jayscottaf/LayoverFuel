import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plane, Clock, MapPin, RefreshCw, CalendarCheck, CalendarX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Flight {
  id: string;
  summary: string;
  start: string;
  end: string;
  location: string | null;
  link: string | null;
}

interface Layover {
  arriveAt: string;
  departAt: string;
  durationMinutes: number;
  airportGuess: string | null;
  fromFlightId: string;
  toFlightId: string;
}

interface ItineraryResponse {
  connected: boolean;
  flights: Flight[];
  layovers: Layover[];
}

interface ItineraryError {
  code: string;
  message: string;
}

type QueryResult = ItineraryResponse | ItineraryError;

function isError(d: QueryResult | undefined): d is ItineraryError {
  return !!d && "code" in d;
}

async function fetchItinerary(): Promise<QueryResult> {
  const res = await fetch("/api/itinerary/upcoming", { credentials: "include" });
  if (res.status === 409) {
    return (await res.json()) as ItineraryError;
  }
  if (!res.ok) {
    throw new Error(`Failed (${res.status})`);
  }
  return (await res.json()) as ItineraryResponse;
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ItineraryPage() {
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Show a toast once if the user just returned from the connect-calendar flow
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("calendar");
    if (status === "connected") {
      toast({ title: "Google Calendar connected", description: "Pulling your upcoming flights…" });
      queryClient.invalidateQueries({ queryKey: ["/api/itinerary/upcoming"] });
      window.history.replaceState({}, "", window.location.pathname);
    } else if (status === "error") {
      toast({
        title: "Couldn't connect Google Calendar",
        description: "Please try again.",
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [location, toast, queryClient]);

  const { data, isLoading, refetch, isRefetching } = useQuery<QueryResult>({
    queryKey: ["/api/itinerary/upcoming"],
    queryFn: fetchItinerary,
  });

  const connectHref = "/api/auth/google/connect-calendar";

  if (isLoading) {
    return (
      <div className="flex-1 overflow-y-auto bg-black pb-28">
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          <Skeleton className="h-8 w-40 bg-gray-800" />
          <Skeleton className="h-32 rounded-3xl bg-gray-900" />
          <Skeleton className="h-32 rounded-3xl bg-gray-900" />
        </div>
      </div>
    );
  }

  // Reauth required
  if (isError(data) && data.code === "CALENDAR_REAUTH_REQUIRED") {
    return (
      <div className="flex-1 overflow-y-auto bg-black pb-28">
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          <h1 className="text-2xl font-bold text-white">Itinerary</h1>
          <div className="bg-gray-900 rounded-3xl p-6 text-center space-y-4">
            <CalendarX className="h-10 w-10 text-amber-400 mx-auto" />
            <div>
              <p className="text-white font-semibold">Reconnect Google Calendar</p>
              <p className="text-sm text-gray-400 mt-1">
                Your Google access has expired or was revoked. Reconnect to see your upcoming flights.
              </p>
            </div>
            <a
              href={connectHref}
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-3 rounded-xl transition-colors"
            >
              Reconnect
            </a>
          </div>
        </div>
      </div>
    );
  }

  const itinerary = data as ItineraryResponse | undefined;

  // Not connected
  if (!itinerary?.connected) {
    return (
      <div className="flex-1 overflow-y-auto bg-black pb-28">
        <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
          <h1 className="text-2xl font-bold text-white">Itinerary</h1>
          <div className="bg-gray-900 rounded-3xl p-6 text-center space-y-4">
            <CalendarCheck className="h-10 w-10 text-indigo-400 mx-auto" />
            <div>
              <p className="text-white font-semibold">See your upcoming layovers</p>
              <p className="text-sm text-gray-400 mt-1">
                Connect your Google Calendar and we'll surface the flights and layovers in the next 7 days.
              </p>
            </div>
            <a
              href={connectHref}
              className="inline-block bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-3 rounded-xl transition-colors"
            >
              Connect Google Calendar
            </a>
            <p className="text-xs text-gray-500">Read-only access — we never write to your calendar.</p>
          </div>
        </div>
      </div>
    );
  }

  const { flights, layovers } = itinerary;

  return (
    <div className="flex-1 overflow-y-auto bg-black pb-28">
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Itinerary</h1>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-indigo-400 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {flights.length === 0 ? (
          <div className="bg-gray-900 rounded-3xl p-6 text-center">
            <Plane className="h-10 w-10 text-gray-500 mx-auto mb-3" />
            <p className="text-white font-medium">No flights in the next 7 days</p>
            <p className="text-sm text-gray-400 mt-1">
              We look for calendar events with airline codes, "flight", or airport names.
            </p>
          </div>
        ) : (
          <>
            {layovers.length > 0 && (
              <section>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                  Layovers
                </p>
                <div className="space-y-2">
                  {layovers.map(l => (
                    <div
                      key={`${l.fromFlightId}-${l.toFlightId}`}
                      className="bg-gray-900 rounded-2xl p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="bg-indigo-500/20 rounded-xl p-2.5">
                          <Clock className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-semibold">
                            {l.airportGuess ?? "Layover"}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {fmtDuration(l.durationMinutes)} · {fmtDateTime(l.arriveAt)} → {fmtDateTime(l.departAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                Flights
              </p>
              <div className="space-y-2">
                {flights.map(f => (
                  <div key={f.id} className="bg-gray-900 rounded-2xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-blue-500/20 rounded-xl p-2.5">
                        <Plane className="h-5 w-5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-semibold truncate">{f.summary}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {fmtDateTime(f.start)} → {fmtDateTime(f.end)}
                        </p>
                        {f.location && (
                          <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{f.location}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
