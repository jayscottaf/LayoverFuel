import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";

import NotFound from "@/pages/not-found";
import ChatPage from "@/pages/chat-page";
import HomePage from "@/pages/home";
import LogPage from "@/pages/log";
import ProfilePage from "@/pages/profile";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import { MobileNavigation } from "@/components/dashboard/MobileNavigation";

function LoadingScreen() {
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-12 h-12 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function AuthedApp() {
  return (
    <>
      {/* Fixed background that extends into safe areas */}
      <div className="fixed inset-0 bg-black" style={{ zIndex: -1 }} />

      <div className="flex flex-col relative" style={{ height: "100dvh", paddingTop: "max(env(safe-area-inset-top), 50px)" }}>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/chat" component={ChatPage} />
          <Route path="/log" component={LogPage} />
          <Route path="/profile" component={ProfilePage} />
          <Route component={NotFound} />
        </Switch>
        <MobileNavigation />
      </div>
    </>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <LoadingScreen />;

  const isAuthRoute = location.startsWith("/auth");

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/auth/register" component={RegisterPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  if (isAuthRoute) {
    window.location.href = "/";
    return <LoadingScreen />;
  }

  return <AuthedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
