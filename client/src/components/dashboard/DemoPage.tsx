import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowLeft } from "lucide-react";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Layover Fuel Dashboard</h1>
            <p className="text-gray-300 mt-2">Stay on track with your fitness goals while traveling</p>
          </div>
          <Link href="/">
            <Button className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to Chat
            </Button>
          </Link>
        </div>
        
        <div className="border-b border-gray-700 pb-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Daily Stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-700">
              <p className="text-gray-300 text-sm">Daily Calories</p>
              <p className="text-2xl font-bold text-blue-400">1,450</p>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{width: '65%'}}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Target: 2,200</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-700">
              <p className="text-gray-300 text-sm">Protein</p>
              <p className="text-2xl font-bold text-blue-400">85g</p>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{width: '60%'}}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Target: 140g</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-700">
              <p className="text-gray-300 text-sm">Steps</p>
              <p className="text-2xl font-bold text-blue-400">7,500</p>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{width: '75%'}}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Target: 10,000</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-700">
              <p className="text-gray-300 text-sm">Water</p>
              <p className="text-2xl font-bold text-blue-400">5</p>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{width: '63%'}}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Target: 8 glasses</p>
            </div>
          </div>
        </div>
        
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-200 mb-4">Try Our AI Assistant Chat</h2>
          <p className="text-gray-300 mb-6">
            Our AI-powered assistant can analyze photos of your meals to estimate nutritional content,
            provide workout tips, and help you make healthy choices while traveling.
          </p>
          
          <div className="bg-gray-800 rounded-lg shadow-sm p-6 text-center border border-gray-700">
            <h3 className="text-lg font-semibold mb-3 text-white">Layover Fuel Assistant</h3>
            <p className="text-gray-300 mb-6">
              Chat with our AI fitness coach to analyze food photos, get nutrition advice,
              and receive personalized workout recommendations.
            </p>
            <Link href="/">
              <Button size="lg" className="gap-2 px-8 py-6 text-lg bg-blue-500 hover:bg-blue-600">
                <MessageSquare className="h-6 w-6" />
                Open Chat Assistant
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="mt-12 border-t border-gray-700 pt-8">
          <h3 className="text-lg font-medium mb-4 text-gray-200">About Layover Fuel</h3>
          <p className="text-gray-300">
            Layover Fuel helps travelers maintain their fitness and nutrition goals while on the go.
            Our AI-powered platform creates personalized meal and workout plans that adapt to your travel schedule,
            available equipment, and dietary preferences.
          </p>
        </div>
      </div>
    </div>
  );
}