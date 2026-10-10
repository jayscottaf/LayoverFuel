import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { CalendarClock, CircleUserRound, House, NotebookPen, Plus, TrendingUp, WifiOff, RefreshCw, Loader2 } from "lucide-react";
import { useOffline } from "@/hooks/use-offline";
import { useCapture } from "./capture/capture-context";
import { ThemeToggle } from "./theme";

const NAV = [
  { href: "/", label: "Today", Icon: House },
  { href: "/plan", label: "Plan", Icon: CalendarClock },
  { href: "/log", label: "Log", Icon: NotebookPen },
  { href: "/stats", label: "Progress", Icon: TrendingUp },
] as const;

function isActive(location: string, href: string) {
  return href === "/" ? location === "/" : location === href || location.startsWith(`${href}/`);
}

function SyncStatus({ compact = false }: { compact?: boolean }) {
  const { isOffline, pendingCount, syncStatus, manualSync } = useOffline();
  if (syncStatus === "syncing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Syncing
      </span>
    );
  }
  if (pendingCount > 0 && !isOffline) {
    return (
      <button
        type="button"
        onClick={manualSync}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-highlight hover:underline"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        {compact ? pendingCount : `Sync ${pendingCount} saved offline`}
      </button>
    );
  }
  return null;
}

function OfflineBanner() {
  const { isOffline, pendingCount } = useOffline();
  if (!isOffline) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 border-b bg-warning-soft px-4 py-2 text-xs text-foreground pt-safe">
      <WifiOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        Offline. Meals you save are kept on this device and sync when you reconnect
        {pendingCount > 0 ? ` (${pendingCount} waiting)` : ""}.
      </span>
    </div>
  );
}

function SideRail() {
  const [location] = useLocation();
  const { open } = useCapture();
  return (
    <nav aria-label="Primary" className="hidden w-60 shrink-0 flex-col border-r bg-card px-3 py-6 md:flex">
      <Link href="/" className="px-3 text-lg font-semibold tracking-normal">
        LayoverFuel
      </Link>
      <button
        type="button"
        onClick={() => open()}
        className="mx-1 mt-6 flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" aria-hidden="true" /> Log food
      </button>
      <ul className="mt-6 space-y-1">
        {NAV.map(({ href, label, Icon }) => {
          const active = isActive(location, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
                  active ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-auto space-y-4 px-1">
        <SyncStatus />
        <Link
          href="/profile"
          aria-current={isActive(location, "/profile") ? "page" : undefined}
          className="flex min-h-10 items-center gap-3 rounded-lg px-2 text-sm text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        >
          <CircleUserRound className="h-4 w-4" aria-hidden="true" /> Profile & settings
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}

function TabBar() {
  const [location] = useLocation();
  const { open } = useCapture();
  const { pendingCount } = useOffline();
  const left = NAV.slice(0, 2);
  const right = NAV.slice(2);
  const tab = ({ href, label, Icon }: (typeof NAV)[number]) => {
    const active = isActive(location, href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
          active ? "font-medium text-foreground" : "text-muted-foreground"
        }`}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
        {label}
        {href === "/log" && pendingCount > 0 && (
          <span className="absolute right-[22%] top-1.5 h-2 w-2 rounded-full bg-highlight" aria-label={`${pendingCount} meals waiting to sync`} />
        )}
      </Link>
    );
  };
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur pb-safe md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch px-2">
        {left.map(tab)}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => open()}
            aria-label="Log food"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md active:scale-95 transition-transform"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        </div>
        {right.map(tab)}
      </div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 flex bg-background text-foreground">
      <SideRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main className="flex min-h-0 flex-1 flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          {children}
        </main>
      </div>
      <TabBar />
    </div>
  );
}

/** Wraps screens that still use the original black canvas styling. */
export function LegacyScreen({ children }: { children: ReactNode }) {
  return <div className="legacy-dark dark flex min-h-0 flex-1 flex-col">{children}</div>;
}
