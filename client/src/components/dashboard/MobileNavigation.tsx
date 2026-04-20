import { Link, useLocation } from "wouter";
import { Home, MessageCircle, BarChart2, User, TrendingUp } from "lucide-react";
import { useOffline } from "@/hooks/use-offline";

const tabs = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/stats", icon: TrendingUp, label: "Stats" },
  { href: "/log", icon: BarChart2, label: "Log" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function MobileNavigation() {
  const [location] = useLocation();
  const { pendingCount, syncStatus } = useOffline();
  const showBadge = pendingCount > 0 || syncStatus === "syncing";

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-xl border-t border-gray-800"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          const showPendingOnTab = href === "/log" && showBadge;
          return (
            <Link key={href} href={href}>
              <a className={`relative flex flex-col items-center gap-1 px-5 py-3 transition-colors ${
                active ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"
              }`}>
                <div className="relative">
                  <Icon className={`h-6 w-6 ${active ? "stroke-2" : "stroke-[1.5]"}`} />
                  {showPendingOnTab && (
                    <span
                      className={`absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        syncStatus === "syncing"
                          ? "bg-blue-500 text-white animate-pulse"
                          : "bg-orange-500 text-white"
                      }`}
                      aria-label={`${pendingCount} items pending sync`}
                    >
                      {syncStatus === "syncing" ? "…" : pendingCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-medium ${active ? "text-indigo-400" : ""}`}>
                  {label}
                </span>
                {active && (
                  <span className="absolute -bottom-0 w-1 h-1 bg-indigo-400 rounded-full" />
                )}
              </a>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
