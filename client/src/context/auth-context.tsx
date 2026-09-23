import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getActiveAccountId, setActiveAccountId } from "@/lib/account";
import { clearSnapshots } from "@/lib/offline-snapshots";

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
        if (getActiveAccountId() !== data.id) {
          await queryClient.cancelQueries();
          queryClient.clear();
          setActiveAccountId(data.id);
        }
        setIsAuthenticated(true);
        setIsOnboardingComplete(Boolean(data?.isOnboardingComplete));
        setGoogleCalendarConnected(Boolean(data?.googleCalendarConnected));
        sessionStorage.setItem("layoverfuel-offline-session", JSON.stringify({ id: data.id, isOnboardingComplete: Boolean(data.isOnboardingComplete) }));
        localStorage.setItem("layoverfuel-active-account", String(data.id));
      } else {
        setIsAuthenticated(false);
        setIsOnboardingComplete(false);
        setGoogleCalendarConnected(false);
      }
    } catch {
      const saved = sessionStorage.getItem("layoverfuel-offline-session");
      if (!navigator.onLine && saved) {
        try {
          const account = JSON.parse(saved);
          if (Number.isSafeInteger(account.id) && localStorage.getItem("layoverfuel-active-account") === String(account.id)) {
            setActiveAccountId(account.id);
            setIsAuthenticated(true);
            setIsOnboardingComplete(Boolean(account.isOnboardingComplete));
            return;
          }
        } catch { /* Ignore an invalid local session marker. */ }
      }
      await queryClient.cancelQueries();
      queryClient.clear();
      setActiveAccountId(null);
      sessionStorage.removeItem("layoverfuel-offline-session");
      localStorage.removeItem("layoverfuel-active-account");
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

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "layoverfuel-active-account" && event.newValue !== String(getActiveAccountId())) {
        queryClient.cancelQueries().then(() => queryClient.clear());
        setActiveAccountId(null);
        setIsAuthenticated(false);
        sessionStorage.removeItem("layoverfuel-offline-session");
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", checkAuth);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("online", checkAuth); };
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
    const owner = getActiveAccountId();
    try {
      await apiRequest("POST", "/api/auth/logout", {});
    } finally {
      setIsAuthenticated(false);
      setIsOnboardingComplete(false);
      setGoogleCalendarConnected(false);
      await queryClient.cancelQueries();
      queryClient.clear();
      setActiveAccountId(null);
      sessionStorage.removeItem("layoverfuel-offline-session");
      localStorage.removeItem("layoverfuel-active-account");
      if (owner) await clearSnapshots(owner);
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
