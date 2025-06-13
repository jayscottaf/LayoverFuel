import { Switch, Route } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <div>Welcome to Layover Fuel</div>} />
      <Route component={() => <div>Page not found</div>} />
    </Switch>
  );
}

function App() {
  return (
    <div>
      <Router />
    </div>
  );
}

export default App;