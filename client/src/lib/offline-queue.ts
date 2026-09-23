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
  const db = await database();
  const existing = await db.get("queue", id);
  if (existing && existing.ownerId !== ownerId) throw new Error("This draft belongs to another account");
  if (!existing) await db.put("queue", { id, ownerId, type, data: { ...data, clientRequestId: id },
    timestamp: Date.now(), retryCount: 0, status: "pending" });
  db.close(); changed(); return id;
}
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

async function put(item: QueueItem) {
  const db = await database(); await db.put("queue", item); db.close(); changed();
}
let syncing: Promise<{ total: number; success: number; failed: number }> | undefined;
async function performSync() {
  const ownerId = getActiveAccountId();
  const items = ownerId ? await getPendingItems() : [];
  let success = 0; let failed = 0;
  for (const queued of items) {
    if (getActiveAccountId() !== ownerId) break;
    const item = await getQueueItem(queued.id);
    if (!item || item.status === "synced") continue;
    try {
      await put({ ...item, status: "syncing" });
      if (item.cancelled && item.savedId) {
        await apiRequest("DELETE", `/api/logs/nutrition/${item.savedId}`, undefined, { accountId: ownerId! });
        await put({ ...item, status: "synced", error: undefined });
        success++;
        continue;
      }
      const response = await apiRequest("POST", "/api/logs/nutrition", item.data, { accountId: ownerId! });
      const saved = await response.json();
      if (!Number.isSafeInteger(saved.id)) throw new Error("The server did not confirm this meal");
      // Read again: Undo may have arrived while the save request was in flight.
      const db = await database();
      const latest = await db.get("queue", item.id); db.close();
      await put({ ...(latest ?? item), savedId: saved.id, status: "syncing" });
      if (latest?.cancelled) await apiRequest("DELETE", `/api/logs/nutrition/${saved.id}`, undefined, { accountId: ownerId! });
      await put({ ...(latest ?? item), status: "synced", savedId: saved.id, error: undefined });
      success++;
    } catch (error) {
      const db = await database();
      const latest = await db.get("queue", item.id); db.close();
      await put({ ...(latest ?? item), status: "failed", retryCount: item.retryCount + 1,
        error: error instanceof Error ? error.message : "Sync failed" });
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
  if (item.status === "pending" && item.retryCount === 0 && !item.savedId && !syncing) {
    await put({ ...item, cancelled: true, status: "synced" });
    return;
  }
  await put({ ...item, cancelled: true, status: "pending" });
  if (syncing) await syncing;
  const latest = await getQueueItem(id);
  if (latest?.savedId && navigator.onLine) {
    await apiRequest("DELETE", `/api/logs/nutrition/${latest.savedId}`);
    await put({ ...latest, cancelled: true, status: "synced" });
  } else if (navigator.onLine) await syncQueue();
}
