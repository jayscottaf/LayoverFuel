import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { readApiJson, queryClient } from "@/lib/queryClient";
import { getActiveAccountId, setActiveAccountId } from "@/lib/account";
import { clearSnapshots } from "@/lib/offline-snapshots";
import { rememberOfflineAccount, readOfflineAccount, forgetOfflineAccount } from "@/lib/offline-session";

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
    pendingLogout = readApiJson("POST", "/api/auth/logout", {}).then(() => {
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
      const data = await readApiJson<{ id: number; isOnboardingComplete: boolean; googleCalendarConnected: boolean }>("GET", "/api/auth/me", undefined, { timeoutMs: 15_000 });
      if (Number.isSafeInteger(data.id) && data.id > 0) {
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
        rememberOfflineAccount({ id: data.id, isOnboardingComplete: Boolean(data.isOnboardingComplete) });
      } else {
        throw new Error("Invalid account response");
      }
    } catch {
      if (revision !== authRevision.current) return;
      const account = !navigator.onLine ? readOfflineAccount() : null;
      if (account) {
        setActiveAccountId(account.id);
        setIsAuthenticated(true);
        setIsOnboardingComplete(account.isOnboardingComplete);
        return;
      }
      await queryClient.cancelQueries();
      if (revision !== authRevision.current) return;
      queryClient.clear();
      setActiveAccountId(null);
      forgetOfflineAccount();
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
      await readApiJson("POST", "/api/auth/login", { email, password });
      await checkAuth();
      return getActiveAccountId() !== null;
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
    forgetOfflineAccount();
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
