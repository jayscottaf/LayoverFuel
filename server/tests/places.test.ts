import test from "node:test";
import assert from "node:assert/strict";
import {
  AreaNotFound, areaForCoordinates, autocompleteInputSchema, placeSuggestions, placesConfigured, reverseInputSchema,
} from "../services/places-service";

function withFetch(handler: (url: string, init?: RequestInit) => unknown, status = 200) {
  const original = globalThis.fetch;
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(handler(String(url), init)), { status });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test("places are off without a key", () => {
  const saved = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;
  assert.equal(placesConfigured(), false);
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  assert.equal(placesConfigured(), true);
  if (saved === undefined) delete process.env.GOOGLE_MAPS_API_KEY; else process.env.GOOGLE_MAPS_API_KEY = saved;
});

test("inputs reject extra fields and out-of-range coordinates", () => {
  assert.equal(autocompleteInputSchema.safeParse({ input: "Greenf", sessionToken: "abcdef12" }).success, true);
  assert.equal(autocompleteInputSchema.safeParse({ input: "Greenf", sessionToken: "abcdef12", userId: 1 }).success, false);
  assert.equal(autocompleteInputSchema.safeParse({ input: "G", sessionToken: "abcdef12" }).success, false);
  assert.equal(reverseInputSchema.safeParse({ latitude: 43.13, longitude: -73.85 }).success, true);
  assert.equal(reverseInputSchema.safeParse({ latitude: 91, longitude: 0 }).success, false);
});

test("suggestions keep Google's full label and split main/secondary text", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  const stub = withFetch(() => ({ suggestions: [
    { placePrediction: { text: { text: "Greenfield Center, NY, USA" },
      structuredFormat: { mainText: { text: "Greenfield Center" }, secondaryText: { text: "NY, USA" } } } },
    { placePrediction: { text: { text: "Greenfield, MA, USA" } } },
    { queryPrediction: { text: { text: "greenfield restaurants" } } },
  ] }));
  try {
    const result = await placeSuggestions({ input: "Greenf", sessionToken: "abcdef12" });
    assert.deepEqual(result, [
      { label: "Greenfield Center, NY, USA", main: "Greenfield Center", secondary: "NY, USA" },
      { label: "Greenfield, MA, USA", main: "Greenfield, MA, USA", secondary: "" },
    ]);
    const { url, init } = stub.calls[0];
    assert.equal(url, "https://places.googleapis.com/v1/places:autocomplete");
    assert.equal((init?.headers as Record<string, string>)["X-Goog-Api-Key"], "test-key");
    assert.deepEqual(JSON.parse(String(init?.body)).input, "Greenf");
  } finally { stub.restore(); }
});

test("reverse lookup returns the most specific formatted address", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  const stub = withFetch(() => ({ status: "OK", results: [{ formatted_address: "Greenfield Center, NY 12833, USA" }] }));
  try {
    assert.equal(await areaForCoordinates({ latitude: 43.1318, longitude: -73.854 }), "Greenfield Center, NY 12833, USA");
    const url = new URL(stub.calls[0].url);
    assert.equal(url.searchParams.get("latlng"), "43.1318,-73.854");
    assert.match(url.searchParams.get("result_type") ?? "", /locality/);
  } finally { stub.restore(); }
});

test("reverse lookup reports no area and surfaces Google errors", async () => {
  process.env.GOOGLE_MAPS_API_KEY = "test-key";
  let stub = withFetch(() => ({ status: "ZERO_RESULTS", results: [] }));
  try { await assert.rejects(areaForCoordinates({ latitude: 0, longitude: 0 }), AreaNotFound); } finally { stub.restore(); }
  stub = withFetch(() => ({ status: "REQUEST_DENIED", results: [] }));
  try { await assert.rejects(areaForCoordinates({ latitude: 1, longitude: 1 }), /REQUEST_DENIED/); } finally { stub.restore(); }
  stub = withFetch(() => ({ error: "denied" }), 403);
  try { await assert.rejects(placeSuggestions({ input: "Greenf", sessionToken: "abcdef12" }), /403/); } finally { stub.restore(); }
});
