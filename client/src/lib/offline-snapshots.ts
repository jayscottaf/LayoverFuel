import { openDB } from "idb";

const allowed = (path: string) => ["/api/dashboard", "/api/travel-plan", "/api/logs/nutrition", "/api/stats", "/api/user/profile"].some(p => path === p || path.startsWith(p + "?"));
async function database() {
  return openDB("layoverfuel-read-models", 1, {
    upgrade(db) { db.createObjectStore("snapshots"); },
  });
}
export async function saveSnapshot(owner: number, path: string, response: Response) {
  if (!allowed(path)) return;
  const data = await response.json();
  const db = await database();
  await db.put("snapshots", { data, savedAt: Date.now() }, `${owner}:${path}`);
  db.close();
}
export async function readSnapshot(owner: number, path: string): Promise<Response | undefined> {
  if (!allowed(path)) return;
  const db = await database();
  const snapshot = await db.get("snapshots", `${owner}:${path}`); db.close();
  if (!snapshot) return;
  return Response.json(snapshot.data, { headers: { "X-LayoverFuel-Offline": "1" } });
}
export async function clearSnapshots(owner: number) {
  const db = await database();
  const tx = db.transaction("snapshots", "readwrite");
  for (const key of await tx.store.getAllKeys()) if (String(key).startsWith(`${owner}:`)) await tx.store.delete(key);
  await tx.done; db.close();
}
