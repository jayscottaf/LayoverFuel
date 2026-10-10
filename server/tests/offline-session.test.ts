import test from "node:test";
import assert from "node:assert/strict";
import { rememberOfflineAccount, readOfflineAccount, forgetOfflineAccount } from "../../client/src/lib/offline-session";

test("offline account survives a fresh app launch but not logout or account mismatch", () => {
  const makeStorage = () => {
    const values = new Map<string, string>();
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key), clear: () => values.clear() };
  };
  const local = makeStorage(), session = makeStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: local });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: session });
  try {
    rememberOfflineAccount({ id: 12, isOnboardingComplete: true });
    session.clear();
    assert.deepEqual(readOfflineAccount(), { id: 12, isOnboardingComplete: true });
    local.setItem("layoverfuel-pending-logout", "true");
    assert.equal(readOfflineAccount(), null);
    local.removeItem("layoverfuel-pending-logout");
    local.setItem("layoverfuel-active-account", "13");
    assert.equal(readOfflineAccount(), null);
    rememberOfflineAccount({ id: 13, isOnboardingComplete: false });
    assert.deepEqual(readOfflineAccount(), { id: 13, isOnboardingComplete: false });
    forgetOfflineAccount();
    assert.equal(readOfflineAccount(), null);
    local.setItem("layoverfuel-offline-session", "not-json");
    assert.equal(readOfflineAccount(), null);
  } finally {
    Reflect.deleteProperty(globalThis, "localStorage");
    Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
