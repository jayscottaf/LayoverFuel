import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { onlineManager } from "@tanstack/react-query";
import { setActiveAccountId } from "../../client/src/lib/account";
import { apiRequest, queryClient } from "../../client/src/lib/queryClient";
import { clearSnapshots, readSnapshot, saveSnapshot } from "../../client/src/lib/offline-snapshots";

test("offline queries use only the active account's snapshots and reject stale account responses", async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "window", { configurable: true, value: new EventTarget() });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: false } });
  const path = "/api/dashboard?date=2026-09-22&timezone=UTC";
  try {
    setActiveAccountId(301);
    await saveSnapshot(301, path, Response.json({ owner: 301, calories: 700 }));
    await saveSnapshot(302, path, Response.json({ owner: 302, calories: 400 }));
    await saveSnapshot(301, "/api/auth/me", Response.json({ id: 301 }));
    assert.equal(await readSnapshot(301, "/api/auth/me"), undefined);
    globalThis.fetch = async () => { throw new TypeError("Offline"); };
    onlineManager.setOnline(false);
    const result = await queryClient.fetchQuery({ queryKey: [path], retry: false });
    assert.deepEqual(result, { owner: 301, calories: 700 });
    queryClient.clear();
    setActiveAccountId(302);
    assert.deepEqual(await (await apiRequest("GET", path)).json(), { owner: 302, calories: 400 });
    await clearSnapshots(301);
    assert.equal(await readSnapshot(301, path), undefined);
    assert.ok(await readSnapshot(302, path));

    let finish!: (response: Response) => void;
    globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
    const pending = apiRequest("GET", path);
    setActiveAccountId(303);
    finish(Response.json({ owner: 302 }));
    await assert.rejects(pending, /account changed/);
  } finally {
    queryClient.clear();
    onlineManager.setOnline(true);
    setActiveAccountId(null);
    globalThis.fetch = originalFetch;
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else delete (globalThis as any).window;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
  }
});
