import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Layover Fuel</h1>
          <p className="text-xl text-gray-600">Your fitness companion for travelers</p>
          <div className="mt-8 space-x-4">
            <a href="/chat" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
              Start Chat
            </a>
            <a href="/dashboard" className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700">
              Dashboard
            </a>
          </div>
        </div>
      </div>
    </QueryClientProvider>
  );
}

export default App;