import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AuthContextType {
  isAuthenticated: boolean;
  isOnboarding: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isOnboarding: false,
  isLoading: true,
  login: async () => false,
  logout: async () => {},
  checkAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

// For MVP: Simplified AuthProvider that assumes logged in state without making API calls
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // For demo MVP: Always authenticated, no onboarding needed, no loading state
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // MVP version that doesn't make API calls
  const checkAuth = useCallback(async () => {
    // For the MVP demo, we're always authenticated
    setIsLoading(false);
    setIsAuthenticated(true);
    setIsOnboarding(false);
  }, []);

  // Only run once on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Mock login function for demo
  const login = async (_email: string, _password: string): Promise<boolean> => {
    // Simulating successful login for MVP
    setIsAuthenticated(true);
    setIsOnboarding(false);
    toast({
      title: "Demo mode",
      description: "You're using the demo version with a pre-authenticated user.",
    });
    return true;
  };

  // Mock logout function for demo
  const logout = async () => {
    // In the MVP, we stay logged in
    toast({
      title: "Demo mode",
      description: "Logout is disabled in the demo version.",
    });
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isOnboarding,
        isLoading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
