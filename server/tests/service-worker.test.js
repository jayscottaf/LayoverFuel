import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

test("offline installation caches all built assets before taking control, never account APIs", async () => {
  const handlers = {}, cached = [];
  let ready = false, install;
  const self = { location: { origin: "https://www.layoverfuel.com" }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting: () => { ready = true; } };
  const cache = { addAll: async paths => { cached.push(...paths); } };
  runInNewContext(await readFile("client/public/service-worker.js", "utf8"), {
    self, URL, Response, caches: { open: async () => cache },
    fetch: async () => Response.json({ "src/main.tsx": { file: "assets/app.js", css: ["assets/app.css"] }, "lazy.tsx": { file: "assets/lazy.js" } }),
  });
  handlers.install({ waitUntil: promise => { install = promise; } });
  assert.equal(ready, false);
  await install;
  assert.equal(ready, true);
  assert.deepEqual(cached, ["/", "/icons/icon-192.png", "/assets/app.js", "/assets/app.css", "/assets/lazy.js"]);
  let intercepted = false;
  for (const url of ["https://www.layoverfuel.com/api/dashboard", "https://api.layoverfuel.com/api/logs/nutrition"]) {
    handlers.fetch({ request: { method: "GET", url }, respondWith: () => { intercepted = true; } });
  }
  assert.equal(intercepted, false);
});
