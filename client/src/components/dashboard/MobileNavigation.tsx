import { Link, useLocation } from "wouter";
import { Home, MessageCircle, BarChart2, User } from "lucide-react";

const tabs = [
  { href: "/", icon: Home, label: "Home" },
  { href: "/chat", icon: MessageCircle, label: "Chat" },
  { href: "/log", icon: BarChart2, label: "Log" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function MobileNavigation() {
  const [location] = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-xl border-t border-gray-800"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = location === href || (href !== "/" && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <a className={`flex flex-col items-center gap-1 px-5 py-3 transition-colors ${
                active ? "text-indigo-400" : "text-gray-500 hover:text-gray-300"
              }`}>
                <Icon className={`h-6 w-6 ${active ? "stroke-2" : "stroke-[1.5]"}`} />
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
