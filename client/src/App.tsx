import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import NotFound from "@/pages/not-found";
import TourPage from "@/pages/tour";
import ChatPage from "@/pages/chat-page";
import HomePage from "@/pages/home";
import { MobileNavigation } from "@/components/dashboard/MobileNavigation";

function Router() {
  return (
    <div className="relative bg-black" style={{ minHeight: "100dvh" }}>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/tour" component={TourPage} />
        <Route component={NotFound} />
      </Switch>
      <MobileNavigation />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
