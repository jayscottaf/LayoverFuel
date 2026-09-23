import { openDB, type DBSchema } from "idb";
import { apiRequest } from "./queryClient";
import { getActiveAccountId } from "./account";

export type QueueItemType = "nutrition" | "workout" | "health";
export interface QueueItem {
  id: string; ownerId: number; type: QueueItemType; data: Record<string, unknown>;
  timestamp: number; retryCount: number; status: "pending" | "syncing" | "failed" | "synced";
  savedId?: number; cancelled?: boolean; error?: string;
}
interface QueueDB extends DBSchema {
  queue: { key: string; value: QueueItem; indexes: { "by-status": string; "by-timestamp": number } };
}
const database = () => openDB<QueueDB>("layoverfuel-offline", 1, {
  upgrade(db) {
    const store = db.createObjectStore("queue", { keyPath: "id" });
    store.createIndex("by-status", "status");
    store.createIndex("by-timestamp", "timestamp");
  },
});
function changed() { window.dispatchEvent(new Event("nutrition-queue-changed")); }
function requireOwner() {
  const owner = getActiveAccountId();
  if (!owner) throw new Error("Sign in before saving a meal");
  return owner;
}
export async function queueItem(type: QueueItemType, data: Record<string, unknown>): Promise<string> {
  if (type !== "nutrition") throw new Error("Offline workout and health saves are not supported yet");
  const ownerId = requireOwner();
  const id = String(data.clientRequestId ?? crypto.randomUUID());
  const payload = { ...data, clientRequestId: id };
  const db = await database();
  try {
    const tx = db.transaction("queue", "readwrite");
    const existing = await tx.store.get(id);
    if (existing && existing.ownerId !== ownerId) throw new Error("This draft belongs to another account");
    if (existing && canonical(existing.data) !== canonical(payload)) throw new Error("This meal changed after saving. Use a new draft to save the corrected values.");
    if (!existing) await tx.store.put({ id, ownerId, type, data: payload,
      timestamp: Date.now(), retryCount: 0, status: "pending" });
    await tx.done;
  } finally { db.close(); }
  changed(); return id;
}
const canonical = (data: unknown) => JSON.stringify(data, (_key, value) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value);
export async function getAllItems(): Promise<QueueItem[]> {
  const db = await database();
  const items = await db.getAll("queue"); db.close();
  // Older unowned drafts are quarantined, never assigned to whoever signs in next.
  return items.filter(item => item.ownerId === getActiveAccountId());
}
export async function getQueueItem(id: string): Promise<QueueItem | undefined> {
  return (await getAllItems()).find(item => item.id === id);
}
export async function getPendingItems(): Promise<QueueItem[]> {
  return (await getAllItems()).filter(item => item.status !== "synced").sort((a, b) => a.timestamp - b.timestamp);
}
export async function getPendingCount() { return (await getPendingItems()).length; }
export async function hasQueuedItem(type: QueueItemType) { return (await getPendingItems()).some(item => item.type === type); }

async function mutate(id: string, update: (current: QueueItem) => QueueItem) {
  const db = await database();
  try {
    const tx = db.transaction("queue", "readwrite");
    const current = await tx.store.get(id);
    if (!current) throw new Error("This draft is no longer available");
    const next = update(current);
    await tx.store.put(next);
    await tx.done;
    changed();
    return next;
  } finally { db.close(); }
}
let syncing: Promise<{ total: number; success: number; failed: number }> | undefined;
async function performSync() {
  const ownerId = getActiveAccountId();
  const items = ownerId ? await getPendingItems() : [];
  let success = 0; let failed = 0;
  for (const queued of items) {
    if (getActiveAccountId() !== ownerId) break;
    const item = await mutate(queued.id, current => current.status === "synced" ? current : { ...current, status: "syncing" });
    if (item.status === "synced") continue;
    try {
      if (item.cancelled && item.savedId) {
        await apiRequest("DELETE", `/api/logs/nutrition/${item.savedId}`, undefined, { accountId: ownerId! });
        await mutate(item.id, current => ({ ...current, status: "synced", error: undefined }));
        success++;
        continue;
      }
      const response = await apiRequest("POST", "/api/logs/nutrition", item.data, { accountId: ownerId! });
      const saved = await response.json();
      if (!Number.isSafeInteger(saved.id)) throw new Error("The server did not confirm this meal");
      // Commit acknowledgement atomically with the latest Undo intent, never a stale copy.
      const latest = await mutate(item.id, current => ({ ...current, savedId: saved.id,
        status: current.cancelled ? "pending" : "synced", error: undefined }));
      if (latest.cancelled) {
        await apiRequest("DELETE", `/api/logs/nutrition/${saved.id}`, undefined, { accountId: ownerId! });
        await mutate(item.id, current => ({ ...current, status: "synced", error: undefined }));
      }
      success++;
    } catch (error) {
      await mutate(item.id, current => ({ ...current, status: "failed", retryCount: current.retryCount + 1,
        error: error instanceof Error ? error.message : "Sync failed" }));
      failed++;
    }
  }
  return { total: items.length, success, failed };
}
export function syncQueue() {
  if (!syncing) {
    // Coordinate tabs as well as components; the server is still the idempotency authority.
    const run = typeof navigator !== "undefined" && navigator.locks
      ? navigator.locks.request("layoverfuel-nutrition-sync", performSync) : performSync();
    syncing = run.finally(() => { syncing = undefined; });
  }
  return syncing;
}
export async function cancelQueuedNutrition(id: string) {
  const item = await getQueueItem(id);
  if (!item) throw new Error("This draft is no longer available for this account");
  const cancelled = await mutate(id, current => ({ ...current, cancelled: true,
    status: current.status === "pending" && current.retryCount === 0 && !current.savedId && !syncing ? "synced" : "pending" }));
  if (cancelled.status === "synced" && !cancelled.savedId) return;
  if (syncing) await syncing;
  const latest = await getQueueItem(id);
  if (latest?.savedId && navigator.onLine) {
    await apiRequest("DELETE", `/api/logs/nutrition/${latest.savedId}`, undefined, { accountId: item.ownerId });
    await mutate(id, current => ({ ...current, cancelled: true, status: "synced" }));
  } else if (navigator.onLine) await syncQueue();
}
