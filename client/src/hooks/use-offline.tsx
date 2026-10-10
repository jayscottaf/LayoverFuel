import { useSyncExternalStore } from "react";
import { syncQueue, getPendingCount } from "@/lib/offline-queue";
import { getActiveAccountId } from "@/lib/account";
import { toast } from "@/hooks/use-toast";
import { invalidateNutrition } from "@/lib/nutrition";

export type SyncStatus = "idle" | "syncing" | "success" | "error";
let state = {
  isOnline: typeof navigator === "undefined" || navigator.onLine,
  pendingCount: 0,
  syncStatus: "idle" as SyncStatus,
};
const listeners = new Set<() => void>();
let running = false;
let resetTimer: ReturnType<typeof setTimeout> | undefined;

function update(patch: Partial<typeof state>) {
  state = { ...state, ...patch };
  listeners.forEach(listener => listener());
}

async function refreshPendingCount() {
  const owner = getActiveAccountId();
  const pendingCount = await getPendingCount().catch(() => 0);
  if (owner === getActiveAccountId()) update({ pendingCount });
}

async function performSync() {
  if (running || !navigator.onLine || !getActiveAccountId()) return;
  running = true;
  const owner = getActiveAccountId();
  clearTimeout(resetTimer);
  update({ syncStatus: "syncing" });
  try {
    const result = await syncQueue();
    if (owner !== getActiveAccountId()) return;
    update({ syncStatus: result.failed ? "error" : result.success ? "success" : "idle" });
    if (result.failed) {
      toast({ title: "Some meals still need to sync", description: `${result.failed} remain on this device. Retry from the Log.`, variant: "destructive" });
    } else if (result.success) {
      toast({ title: "Meals synced", description: `${result.success} saved to your account.` });
    }
    if (result.success) await invalidateNutrition();
  } catch {
    if (owner === getActiveAccountId()) update({ syncStatus: "error" });
  } finally {
    running = false;
    await refreshPendingCount();
    resetTimer = setTimeout(() => update({ syncStatus: "idle" }), 3000);
    if (owner !== getActiveAccountId() && getActiveAccountId()) void performSync();
  }
}

function online() {
  update({ isOnline: navigator.onLine });
  void refreshPendingCount();
  if (navigator.onLine) void performSync();
}

function offline() {
  update({ isOnline: false, syncStatus: "idle" });
}

function accountChanged() {
  update({ pendingCount: 0, syncStatus: "idle" });
  online();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // One connection listener and sync loop serve every mounted screen and toolbar.
  if (listeners.size === 1) {
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    window.addEventListener("nutrition-queue-changed", refreshPendingCount);
    window.addEventListener("account-changed", accountChanged);
    online();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
      window.removeEventListener("nutrition-queue-changed", refreshPendingCount);
      window.removeEventListener("account-changed", accountChanged);
      clearTimeout(resetTimer);
    }
  };
}

export function useOffline() {
  const snapshot = useSyncExternalStore(subscribe, () => state);
  return {
    ...snapshot,
    isOffline: !snapshot.isOnline,
    manualSync: performSync,
    refreshPendingCount,
  };
}
