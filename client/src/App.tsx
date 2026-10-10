import { useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";

import NotFound from "@/pages/not-found";
import HomePage from "@/pages/home";
import LogPage from "@/pages/log";
import PlanPage from "@/pages/plan";
import StatsPage from "@/pages/stats";
import ProfilePage from "@/pages/profile";
import ItineraryPage from "@/pages/itinerary";
import LoginPage from "@/pages/auth/login";
import RegisterPage from "@/pages/auth/register";
import { OnboardingView } from "@/components/onboarding/OnboardingView";
import { ThemeProvider } from "@/components/travel/theme";
import { AppShell, LegacyScreen } from "@/components/travel/app-shell";
import { CaptureProvider } from "@/components/travel/capture/capture-context";

function LoadingScreen() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background" role="status">
      <div className="space-y-3 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading</p>
      </div>
    </div>
  );
}

function Redirect({ to }: { to: string }) {
  const [, navigate] = useLocation();
  useEffect(() => navigate(to, { replace: true }), [navigate, to]);
  return null;
}

function legacy(Component: React.ComponentType) {
  return function LegacyRoute() {
    return (
      <LegacyScreen>
        <Component />
      </LegacyScreen>
    );
  };
}

const LegacyStats = legacy(StatsPage);
const LegacyProfile = legacy(ProfilePage);
const LegacyItinerary = legacy(ItineraryPage);

function AuthedApp() {
  return (
    <CaptureProvider>
      <AppShell>
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/plan" component={PlanPage} />
          <Route path="/log" component={LogPage} />
          <Route path="/stats" component={LegacyStats} />
          <Route path="/profile" component={LegacyProfile} />
          <Route path="/itinerary" component={LegacyItinerary} />
          {/* The general coach is paused; send old links to the structured log. */}
          <Route path="/chat">{() => <Redirect to="/log" />}</Route>
          <Route component={NotFound} />
        </Switch>
      </AppShell>
    </CaptureProvider>
  );
}

function Router() {
  const { isAuthenticated, isLoading, isOnboardingComplete } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return (
      <div className="legacy-dark dark min-h-screen">
        <Switch>
          <Route path="/auth/register" component={RegisterPage} />
          <Route component={LoginPage} />
        </Switch>
      </div>
    );
  }

  if (location.startsWith("/auth")) {
    return <Redirect to="/" />;
  }

  if (!isOnboardingComplete) {
    return <OnboardingView />;
  }

  return <AuthedApp />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <AuthProvider>
            <Toaster />
            <Router />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
