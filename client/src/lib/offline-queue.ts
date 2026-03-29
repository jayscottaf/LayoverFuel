import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Types for queued items
export type QueueItemType = 'nutrition' | 'workout' | 'health';

export interface QueueItem {
  id: string;
  type: QueueItemType;
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
}

interface OfflineQueueDB extends DBSchema {
  queue: {
    key: string;
    value: QueueItem;
    indexes: { 'by-status': string; 'by-timestamp': number };
  };
}

const DB_NAME = 'layoverfuel-offline';
const DB_VERSION = 1;
const STORE_NAME = 'queue';

let dbInstance: IDBPDatabase<OfflineQueueDB> | null = null;

// Initialize IndexedDB
async function getDB(): Promise<IDBPDatabase<OfflineQueueDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<OfflineQueueDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      store.createIndex('by-status', 'status');
      store.createIndex('by-timestamp', 'timestamp');
    },
  });

  return dbInstance;
}

// Generate unique ID for queue items
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Add item to queue
export async function queueItem(type: QueueItemType, data: any): Promise<string> {
  const db = await getDB();
  const id = generateId();

  const item: QueueItem = {
    id,
    type,
    data,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  };

  await db.add(STORE_NAME, item);
  console.log('[OFFLINE QUEUE] Added item:', id, type);

  return id;
}

// Get all pending items
export async function getPendingItems(): Promise<QueueItem[]> {
  const db = await getDB();
  const items = await db.getAllFromIndex(STORE_NAME, 'by-status', 'pending');
  return items.sort((a, b) => a.timestamp - b.timestamp);
}

// Get all items (for debugging)
export async function getAllItems(): Promise<QueueItem[]> {
  const db = await getDB();
  return await db.getAll(STORE_NAME);
}

// Get count of pending items
export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return await db.countFromIndex(STORE_NAME, 'by-status', 'pending');
}

// Update item status
export async function updateItemStatus(
  id: string,
  status: QueueItem['status'],
  incrementRetry = false
): Promise<void> {
  const db = await getDB();
  const item = await db.get(STORE_NAME, id);

  if (!item) {
    console.warn('[OFFLINE QUEUE] Item not found:', id);
    return;
  }

  item.status = status;
  if (incrementRetry) {
    item.retryCount += 1;
  }

  await db.put(STORE_NAME, item);
  console.log('[OFFLINE QUEUE] Updated item:', id, 'status:', status);
}

// Remove item from queue
export async function removeItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
  console.log('[OFFLINE QUEUE] Removed item:', id);
}

// Clear all items (useful for debugging)
export async function clearQueue(): Promise<void> {
  const db = await getDB();
  await db.clear(STORE_NAME);
  console.log('[OFFLINE QUEUE] Cleared all items');
}

// Sync a single item
async function syncItem(item: QueueItem): Promise<boolean> {
  try {
    // Update status to syncing
    await updateItemStatus(item.id, 'syncing');

    // Determine API endpoint based on type
    let endpoint = '';
    switch (item.type) {
      case 'nutrition':
        endpoint = '/api/logs/nutrition';
        break;
      case 'workout':
        endpoint = '/api/logs/workout';
        break;
      case 'health':
        endpoint = '/api/logs/health';
        break;
      default:
        throw new Error(`Unknown item type: ${item.type}`);
    }

    // Make API request
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item.data),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Sync failed: ${response.statusText}`);
    }

    // Success - remove from queue
    await removeItem(item.id);
    console.log('[OFFLINE QUEUE] Synced successfully:', item.id);
    return true;
  } catch (error) {
    console.error('[OFFLINE QUEUE] Sync failed:', item.id, error);

    // Mark as failed and increment retry count
    await updateItemStatus(item.id, 'failed', true);

    // If too many retries, remove from queue
    if (item.retryCount >= 3) {
      console.warn('[OFFLINE QUEUE] Max retries reached, removing:', item.id);
      await removeItem(item.id);
    }

    return false;
  }
}

// Sync all pending items
export async function syncQueue(): Promise<{
  total: number;
  success: number;
  failed: number;
}> {
  const pendingItems = await getPendingItems();
  const total = pendingItems.length;
  let success = 0;
  let failed = 0;

  console.log('[OFFLINE QUEUE] Starting sync:', total, 'items');

  for (const item of pendingItems) {
    const result = await syncItem(item);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  console.log('[OFFLINE QUEUE] Sync complete:', { total, success, failed });
  return { total, success, failed };
}

// Check if item exists in queue
export async function hasQueuedItem(type: QueueItemType): Promise<boolean> {
  const items = await getPendingItems();
  return items.some(item => item.type === type);
}
