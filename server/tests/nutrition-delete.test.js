import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { build } from "esbuild";
import express from "express";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = await mkdtemp(join(root, "node_modules", ".nutrition-delete-test-"));
after(() => rm(output, { recursive: true, force: true }));
const file = join(output, "nutrition.mjs");
await build({
  entryPoints: [join(root, "server/routes/api/logs/nutrition.ts")], outfile: file,
  bundle: true, platform: "node", format: "esm", packages: "external",
  plugins: [{ name: "nutrition-storage", setup(builder) {
    builder.onResolve({ filter: /(?:^|\/)storage$/ }, () => ({ path: "storage", namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const storage = globalThis.__nutritionDeleteStorage;" }));
  } }],
});

test("photo Undo deletes only the signed-in user's saved meal", async t => {
  const logs = new Map([[71, { id: 71, userId: 1, calories: 480 }], [72, { id: 72, userId: 2, calories: 650 }]]);
  globalThis.__nutritionDeleteStorage = {
    getNutritionLogById: async id => logs.get(id),
    deleteNutritionLog: async id => {
      const log = logs.get(id);
      if (log) log.deletedAt = new Date();
      return Boolean(log);
    },
  };
  const { default: router } = await import(pathToFileURL(file).href);
  const app = express();
  // Test-only identity injection; the real handler still enforces ownership.
  app.use((req, _res, next) => {
    req.session = { userId: Number(req.headers["x-test-user"]) || undefined };
    next();
  });
  app.use("/api/logs/nutrition", router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    delete globalThis.__nutritionDeleteStorage;
  });
  const base = `http://127.0.0.1:${server.address().port}/api/logs/nutrition`;
  const remove = (id, user) => fetch(`${base}/${id}`, { method: "DELETE", headers: user ? { "x-test-user": String(user) } : {} });
  assert.equal((await remove(71)).status, 401);
  assert.equal((await remove(72, 1)).status, 404);
  assert.equal((await remove("invalid", 1)).status, 400);
  assert.equal(logs.size, 2);
  assert.equal((await remove(71, 1)).status, 204);
  assert.ok(logs.get(71).deletedAt);
  assert.equal(logs.get(72).calories, 650);
  assert.equal((await remove(71, 1)).status, 204);
});
