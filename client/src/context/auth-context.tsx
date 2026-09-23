import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
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

let pendingLogout: Promise<void> | undefined;
function finishPendingLogout() {
  if (!localStorage.getItem("layoverfuel-pending-logout")) return Promise.resolve();
  if (!pendingLogout) {
    pendingLogout = apiRequest("POST", "/api/auth/logout", {}).then(() => {
      localStorage.removeItem("layoverfuel-pending-logout");
    }).finally(() => { pendingLogout = undefined; });
  }
  return pendingLogout;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const authRevision = useRef(0);

  const checkAuth = useCallback(async () => {
    const revision = ++authRevision.current;
    setIsLoading(true);
    try {
      await finishPendingLogout();
      const res = await apiRequest("GET", "/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (revision !== authRevision.current) return;
        if (getActiveAccountId() !== data.id) {
          await queryClient.cancelQueries();
          if (revision !== authRevision.current) return;
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
      if (revision !== authRevision.current) return;
      const saved = sessionStorage.getItem("layoverfuel-offline-session");
      if (!navigator.onLine && saved && !localStorage.getItem("layoverfuel-pending-logout")) {
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
      if (revision !== authRevision.current) return;
      queryClient.clear();
      setActiveAccountId(null);
      sessionStorage.removeItem("layoverfuel-offline-session");
      localStorage.removeItem("layoverfuel-active-account");
      setIsAuthenticated(false);
      setIsOnboardingComplete(false);
      setGoogleCalendarConnected(false);
    } finally {
      if (revision === authRevision.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "layoverfuel-active-account" && event.newValue !== String(getActiveAccountId())) {
        authRevision.current += 1;
        queryClient.cancelQueries().then(() => queryClient.clear());
        setActiveAccountId(null);
        setIsAuthenticated(false);
        setIsLoading(false);
        setIsOnboardingComplete(false);
        setGoogleCalendarConnected(false);
        sessionStorage.removeItem("layoverfuel-offline-session");
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", checkAuth);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("online", checkAuth); };
  }, [checkAuth]);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      authRevision.current += 1;
      await finishPendingLogout();
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
    authRevision.current += 1;
    localStorage.setItem("layoverfuel-pending-logout", "true");
    setIsAuthenticated(false);
    setIsLoading(false);
    setIsOnboardingComplete(false);
    setGoogleCalendarConnected(false);
    setActiveAccountId(null);
    sessionStorage.removeItem("layoverfuel-offline-session");
    localStorage.removeItem("layoverfuel-active-account");
    await queryClient.cancelQueries();
    queryClient.clear();
    if (owner) await clearSnapshots(owner);
    try {
      await finishPendingLogout();
    } catch {
      // Revoke the server session before any later sign-in or reconnect check.
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
