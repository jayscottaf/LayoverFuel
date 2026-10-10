import assert from "node:assert/strict";
import test from "node:test";
import { validWeightEntries, weightAxisDomain, weightHistoryFromHealthLogs } from "../../client/src/lib/weight-history";

test("weight progress starts at the first actual weigh-in, not empty health entries", () => {
  const history = weightHistoryFromHealthLogs([
    { date: "2026-03-28", weight: null },
    { date: "2026-03-30", weight: 81.6 },
    { date: "2026-04-18", weight: null },
  ]);
  assert.deepEqual(history, [{ date: "2026-03-30", weight: 81.6 * 2.20462 }]);
  assert.equal(history.at(-1)?.weight, 81.6 * 2.20462);
  assert.equal(history.at(-1)!.weight - history[0].weight, 0);
  assert.deepEqual(weightAxisDomain(history.map(entry => ({ ...entry, weight: 180 }))), [175, 185]);
});

test("invalid weights and dates are excluded without manufacturing a baseline", () => {
  const logs = [null, 0, -10, NaN, Infinity].map(weight => ({ date: "2026-03-28", weight }));
  assert.deepEqual(weightHistoryFromHealthLogs(logs), []);
  assert.deepEqual(weightHistoryFromHealthLogs([{ date: "2026-02-30", weight: 80 }]), []);
  assert.deepEqual(validWeightEntries([{ date: "2026-03-28", weight: 0 }]), []);
});

test("out-of-order readings are sorted so first and current weights are accurate", () => {
  const logs = [
    { date: "2026-04-18", weight: 80 },
    { date: "2026-03-28", weight: 82 },
    { date: "2026-04-01", weight: null },
  ];
  const original = structuredClone(logs);
  const history = weightHistoryFromHealthLogs(logs);
  assert.deepEqual(history.map(entry => entry.date), ["2026-03-28", "2026-04-18"]);
  assert.equal(history[0].weight, 82 * 2.20462);
  assert.equal(history.at(-1)?.weight, 80 * 2.20462);
  assert.deepEqual(logs, original);
});

test("weight axis fits actual readings and valid goals, including a single reading", () => {
  const history = [{ date: "2026-03-28", weight: 180 }, { date: "2026-04-18", weight: 178 }];
  assert.deepEqual(weightAxisDomain(history), [173, 185]);
  assert.deepEqual(weightAxisDomain(history, 170), [165, 185]);
  assert.deepEqual(weightAxisDomain(history, 0), [173, 185]);
  assert.deepEqual(weightAxisDomain(history, NaN), [173, 185]);
  assert.deepEqual(weightAxisDomain([history[0]]), [175, 185]);
});
