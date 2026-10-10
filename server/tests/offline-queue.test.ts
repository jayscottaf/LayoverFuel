import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { openDB } from "idb";
import { setActiveAccountId } from "../../client/src/lib/account";
import { queueItem, syncQueue, getPendingCount, getAllItems, getQueueItem, cancelQueuedNutrition } from "../../client/src/lib/offline-queue";

test("offline saves recover, remain account-scoped and undo after a lost response", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
  const saved = new Map<string, { id: number }>();
  const deleted = new Set<number>();
  let fail = true;
  globalThis.fetch = async (url, options) => {
    if (options?.method === "DELETE") {
      deleted.add(Number(String(url).split("/").pop()));
      return new Response(null, { status: 204 });
    }
    const data = JSON.parse(options?.body as string);
    const entry = saved.get(data.clientRequestId) ?? { id: saved.size + 1 };
    saved.set(data.clientRequestId, entry);
    if (fail) throw new TypeError("Connection lost after server committed");
    return Response.json(entry);
  };
  try {
    setActiveAccountId(101);
    const ids: string[] = [];
    for (let i = 0; i < 20; i++) ids.push(await queueItem("nutrition", { calories: 500 }));
    assert.equal((await syncQueue()).failed, 20);
    assert.equal(await getPendingCount(), 20);
    setActiveAccountId(202);
    assert.equal(await getPendingCount(), 0);
    assert.equal((await syncQueue()).total, 0);
    setActiveAccountId(101);
    fail = false;
    assert.equal((await syncQueue()).success, 20);
    assert.equal(saved.size, 20);
    assert.equal(await getPendingCount(), 0);
    await cancelQueuedNutrition(ids[0]);
    assert.equal(deleted.size, 1);
    assert.equal((await getAllItems()).find(item => item.id === ids[0])?.cancelled, true);
    const db = await openDB("layoverfuel-offline", 1);
    await db.put("queue", { id: "legacy", status: "pending", type: "nutrition", timestamp: 0 });
    db.close();
    assert.equal(await getPendingCount(), 0, "unowned legacy entries must never sync as current user");
  } finally {
    setActiveAccountId(null);
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as any).window;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  }
});

test("Undo during upload survives going offline, and changed request payloads are rejected", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  const connection = { onLine: true };
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: connection });
  let uploaded!: () => void;
  let acknowledge!: () => void;
  const uploading = new Promise<void>(resolve => { uploaded = resolve; });
  const acknowledgement = new Promise<void>(resolve => { acknowledge = resolve; });
  let posts = 0; let deletes = 0;
  globalThis.fetch = async (_url, options) => {
    if (options?.method === "DELETE") {
      if (!connection.onLine) throw new TypeError("Offline before Undo reached the server");
      deletes++;
      return new Response(null, { status: 204 });
    }
    posts++;
    uploaded();
    await acknowledgement;
    return Response.json({ id: 909 });
  };
  try {
    setActiveAccountId(909);
    const requestId = crypto.randomUUID();
    const id = await queueItem("nutrition", { calories: 500, clientRequestId: requestId });
    assert.equal(await queueItem("nutrition", { clientRequestId: requestId, calories: 500 }), id);
    await assert.rejects(queueItem("nutrition", { calories: 900, clientRequestId: requestId }), /meal changed/);
    const sync = syncQueue();
    await uploading;
    const cancellationSaved = new Promise<void>(resolve => window.addEventListener("nutrition-queue-changed", () => resolve(), { once: true }));
    const undo = cancelQueuedNutrition(id);
    await cancellationSaved;
    connection.onLine = false;
    acknowledge();
    await Promise.all([sync, undo]);
    assert.equal((await getQueueItem(id))?.cancelled, true);
    assert.equal(await getPendingCount(), 1, "the deletion must remain queued until acknowledged");
    connection.onLine = true;
    await syncQueue();
    assert.equal(posts, 1);
    assert.equal(deletes, 1);
    assert.equal(await getPendingCount(), 0);
  } finally {
    setActiveAccountId(null);
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as any).window;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  }
});
