import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: [new URL("../../client/src/lib/queryClient.ts", import.meta.url).pathname],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  define: { "import.meta.env.VITE_API_URL": '""' },
});
const { getQueryFn } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString("base64")}`);
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const context = signal => ({ queryKey: ["/api/dashboard"], signal });
const waitForAbort = signal => new Promise((_, reject) => {
  if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
  signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
});

test("a stalled dashboard request rejects instead of loading indefinitely", async () => {
  globalThis.fetch = async (_url, { signal }) => waitForAbort(signal);
  const read = getQueryFn({ on401: "throw", timeoutMs: 20 });
  await assert.rejects(read(context(new AbortController().signal)), { name: "AbortError" });
});

test("a stalled JSON body also reaches the read deadline", async () => {
  globalThis.fetch = async (_url, { signal }) => ({ ok: true, json: () => waitForAbort(signal) });
  await assert.rejects(getQueryFn({ on401: "throw", timeoutMs: 20 })(context(new AbortController().signal)), { name: "AbortError" });
});

test("query cancellation aborts its in-flight request", async () => {
  let fetchStarted;
  const started = new Promise(resolve => { fetchStarted = resolve; });
  globalThis.fetch = async (_url, { signal }) => { fetchStarted(); return waitForAbort(signal); };
  const controller = new AbortController();
  const pending = getQueryFn({ on401: "throw" })(context(controller.signal));
  await started;
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
});

test("successful dashboard reads and unauthorized behavior are preserved", async () => {
  const data = { stats: { currentCalories: 480 } };
  globalThis.fetch = async () => Response.json(data);
  assert.deepEqual(await getQueryFn({ on401: "throw" })(context(new AbortController().signal)), data);
  globalThis.fetch = async () => Response.json({ message: "Unauthorized" }, { status: 401 });
  assert.equal(await getQueryFn({ on401: "returnNull" })(context(new AbortController().signal)), null);
  await assert.rejects(getQueryFn({ on401: "throw" })(context(new AbortController().signal)), /401/);
});
