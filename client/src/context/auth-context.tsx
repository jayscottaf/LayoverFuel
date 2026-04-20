import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isOnboardingComplete: boolean;
  googleCalendarConnected: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  isOnboardingComplete: false,
  googleCalendarConnected: false,
  login: async () => false,
  logout: async () => {},
  checkAuth: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiRequest("GET", "/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setIsOnboardingComplete(Boolean(data?.isOnboardingComplete));
        setGoogleCalendarConnected(Boolean(data?.googleCalendarConnected));
      } else {
        setIsAuthenticated(false);
        setIsOnboardingComplete(false);
        setGoogleCalendarConnected(false);
      }
    } catch {
      setIsAuthenticated(false);
      setIsOnboardingComplete(false);
      setGoogleCalendarConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      if (res.ok) {
        await checkAuth();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout", {});
    } finally {
      setIsAuthenticated(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isOnboardingComplete,
        googleCalendarConnected,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
