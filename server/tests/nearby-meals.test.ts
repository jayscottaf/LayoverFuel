import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import OpenAI from "openai";
import { nearbyInputSchema, publicSourceUrl, rankNearbyMeals } from "../../shared/nearby-meals";
import { groundedMeals, researchNearbyMeals } from "../services/nearby-meals-service";
import { planMealSchema } from "../../shared/travel-plan";
import { buildTravelPlan } from "../services/travel-plan-service";
import { publicAddress, supportedMeal } from "../services/public-menu-evidence";
import { groundedChainMeals } from "../services/chain-menu-fallback";

const meal = { venue: "Fixture Kitchen", address: "100 Fixture Street, Nashville, TN", name: "Chicken bowl",
  order: "Chicken, rice and vegetables", portion: "One bowl; dressing on the side", calories: 600, protein: 40, carbs: 65, fat: 18,
  menuUrl: "https://www.sweetgreen.com/menu", locationUrl: "https://www.sweetgreen.com/locations", access: "" };
const sources = [meal.menuUrl, meal.locationUrl].map(url => ({ title: "Fixture source", url }));

test("search input accepts only an area and category, never coordinates or health history", () => {
  assert.equal(nearbyInputSchema.safeParse({ area: "Nashville, TN", kind: "restaurant" }).success, true);
  for (const patch of [{ latitude: 36 }, { dietaryRestrictions: ["test"] }, { meals: [] }]) {
    assert.equal(nearbyInputSchema.safeParse({ area: "Nashville, TN", kind: "restaurant", ...patch }).success, false);
  }
  assert.equal(nearbyInputSchema.safeParse({ area: "ab", kind: "restaurant" }).success, false);
});

test("unretrieved URLs, missing branch evidence and duplicate options cannot become recommendations", () => {
  assert.equal(groundedMeals({ meals: [meal, meal] }, sources).length, 1);
  assert.equal(groundedMeals({ meals: [meal] }, sources.slice(0, 1)).length, 0);
  assert.equal(groundedMeals({ meals: [{ ...meal, menuUrl: "https://invented-venue.com/menu" }] }, sources).length, 0);
  for (const url of ["javascript:alert(1)", "http://public.com", "https://localhost/menu", "https://127.0.0.1/menu", "https://user:password@public.com", "https://[::1]/"]) {
    assert.equal(publicSourceUrl(url), null);
  }
  assert.equal(publicSourceUrl(meal.menuUrl + "#section"), meal.menuUrl);
  for (const url of ["https://www.google.com/maps/search/Restaurant", "https://www.google.co.uk/search?q=food", "https://maps.apple.com/?q=food", "https://www.bing.com/search?q=food", "https://www.yelp.com/search?find_desc=food"]) {
    assert.equal(publicSourceUrl(url), null, "Search result links are not menu evidence");
  }
  assert.equal(groundedMeals({ meals: [{ ...meal, menuUrl: "https://www.google.com/maps/search/Restaurant" }] }, sources).length, 0);
  const banquet = { ...meal, menuUrl: "https://hotel.com/banquet-menu.pdf" };
  assert.equal(publicSourceUrl(banquet.menuUrl), null);
  assert.equal(groundedMeals({ meals: [banquet, meal] }, [...sources, { title: "Banquet", url: banquet.menuUrl }]).length, 1);
});

test("ranking changes with remaining energy and higher-protein preference without changing meals", () => {
  const a = { ...meal, id: "a", calories: 400, protein: 10 };
  const b = { ...meal, id: "b", calories: 700, protein: 60 };
  const input = [a, b];
  assert.equal(rankNearbyMeals(input, 1200, 3)[0].id, "a");
  assert.equal(rankNearbyMeals(input, 2100, 3)[0].id, "b");
  assert.equal(rankNearbyMeals(input, 1200, 3, true)[0].id, "b");
  assert.deepEqual(input, [a, b]);
  assert.equal(rankNearbyMeals(input, -100, 0).length, 2);
});

test("kept venue sources survive plan refresh and are removed only when the meal is logged", () => {
  const candidate = groundedMeals({ meals: [meal] }, sources)[0];
  const kept = planMealSchema.parse({ ...candidate, description: meal.order, status: "locked", source: "estimate",
    venue: { name: meal.venue, address: meal.address, menuUrl: meal.menuUrl, locationUrl: meal.locationUrl, checkedAt: "2026-10-10T12:00:00.000Z" } });
  const input = { date: "2026-10-10", timezone: "UTC", targets: { calories: 2200, protein: 130, carbs: 250, fat: 70 }, savedMeals: [kept] };
  assert.deepEqual(buildTravelPlan({ ...input, logs: [{ calories: 800 }] }).meals.find(item => item.id === kept.id)?.venue, kept.venue);
  assert.equal(buildTravelPlan({ ...input, logs: [{ ...kept, planMealId: kept.id }] }).meals.some(item => item.id === kept.id), false);
});

test("current-page evidence rejects stale menu items, wrong streets and private network targets", () => {
  const candidate = { ...meal, id: "fixture" };
  assert.equal(supportedMeal(candidate, "Chicken bowl with rice", "100 Fixture Street, Nashville"), true);
  assert.equal(supportedMeal(candidate, "Fish bowl with rice", "100 Fixture Street, Nashville"), false);
  assert.equal(supportedMeal(candidate, "Chicken bowl", "200 Wrong Street, Nashville"), false);
  assert.equal(supportedMeal({ ...candidate, address: "100 Fixture St, Nashville" }, "Chicken bowl", "100 Fixture Street"), true);
  for (const address of ["127.0.0.1", "10.0.0.1", "192.168.0.1", "169.254.169.254", "100.64.0.1", "::1", "::ffff:127.0.0.1", "fd00::1"]) assert.equal(publicAddress(address), false);
  assert.equal(publicAddress("8.8.8.8"), true);
});

test("real SDK search-to-extraction contract keeps only cited source links", async () => {
  const requests: any[] = [];
  let cited = true;
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString()); requests.push(body);
    const search = !!body.tools;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ id: "resp_fixture", object: "response", status: "completed", output: [
      ...(search ? [{ id: "search_fixture", type: "web_search_call", status: "completed", action: { type: "search", query: "fixture" } }] : []),
      { id: "msg_fixture", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text",
        text: search ? "Fixture Kitchen offers a chicken bowl at 100 Fixture Street." : JSON.stringify({ meals: [meal] }),
        annotations: search && cited ? sources.map(source => ({ type: "url_citation", ...source, start_index: 0, end_index: 10 })) : [],
      }] },
    ] }));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const client = new OpenAI({ apiKey: "synthetic-test-key", baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, maxRetries: 0 });
  try {
    const results = await researchNearbyMeals({ area: "Nashville, TN", kind: "restaurant" }, undefined, client, async meals => meals);
    assert.equal(results.meals.length, 1);
    assert.equal(results.sources.length, 2);
    assert.equal(results.meals[0].evidence, "live_menu");
    assert.equal(requests.length, 2, "Successful direct checks do not trigger another paid search");
    assert.equal(requests[0].tools[0].type, "web_search");
    assert.equal(requests[0].tool_choice, "required");
    assert.equal(requests.every(body => body.store === false), true);
    assert.equal(JSON.parse(requests[0].input).area, "Nashville, TN");
    assert.equal(JSON.parse(requests[0].input).kind, "restaurant");
    cited = false;
    const empty = await researchNearbyMeals({ area: "LGA Terminal B", kind: "airport" }, undefined, client, async meals => meals);
    assert.equal(empty.meals.length, 0, "Neither search can invent meals without citations");
    assert.equal(requests.length, 4, "Missing citations trigger one chain search without extraction");
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

const chainMeal = { ...meal, venue: "Chipotle", menuUrl: "https://www.chipotle.com/menu",
  locationUrl: "https://locations.chipotle.com/tn/nashville/100-fixture-st" };
const chainSources = [chainMeal.menuUrl, chainMeal.locationUrl].map(url => ({ title: "Chain source", url }));

function fixtureResponse(search: boolean, candidates: unknown[], citations = chainSources) {
  return { id: "resp_fixture", object: "response", status: "completed", output: [
    ...(search ? [{ id: "search_fixture", type: "web_search_call", status: "completed", action: { type: "search", query: "fixture" } }] : []),
    { id: "msg_fixture", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text",
      text: search ? "Chipotle offers a Chicken bowl at 100 Fixture Street, Nashville, TN." : JSON.stringify({ meals: candidates }),
      annotations: search ? citations.map(source => ({ type: "url_citation", ...source, start_index: 0, end_index: 10 })) : [],
    }] },
  ] };
}

async function withResearchServer(reply: (body: any, index: number) => unknown,
  run: (client: OpenAI, requests: any[]) => Promise<void>) {
  const requests: any[] = [];
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString()); requests.push(body);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(reply(body, requests.length - 1)));
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const client = new OpenAI({ apiKey: "synthetic-test-key", baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, maxRetries: 0 });
  try { await run(client, requests); }
  finally { await new Promise<void>(resolve => server.close(() => resolve())); }
}

test("unreadable live menus fall back to cited national chain menus without repeating the HTML check", async () => {
  let checks = 0;
  await withResearchServer(body => fixtureResponse(!!body.tools, [chainMeal]), async (client, requests) => {
    const result = await researchNearbyMeals({ area: "Nashville, TN", kind: "restaurant" }, undefined, client,
      async () => { checks++; return []; });
    assert.equal(result.meals.length, 1);
    assert.equal(result.meals[0].evidence, "chain_web");
    assert.equal(checks, 1);
    assert.deepEqual(result.sources, chainSources);
    assert.equal(requests.length, 4);
    assert.equal(JSON.parse(requests[2].input).chainGuide.some((chain: any) => chain.name === "Chipotle"), true);
    assert.equal(requests[2].tools[0].type, "web_search");
    assert.equal(requests.every(body => body.store === false), true);
    assert.deepEqual(Object.keys(JSON.parse(requests[2].input)).sort(), ["area", "chainGuide", "kind", "sourceRequirements"]);

    const kept = planMealSchema.parse({ ...result.meals[0], description: chainMeal.order, status: "locked", source: "estimate",
      venue: { name: chainMeal.venue, address: chainMeal.address, menuUrl: chainMeal.menuUrl, locationUrl: chainMeal.locationUrl,
        checkedAt: result.checkedAt, evidence: result.meals[0].evidence } });
    const refreshed = buildTravelPlan({ date: "2026-10-10", timezone: "UTC", savedMeals: [kept], logs: [],
      targets: { calories: 2200, protein: 130, carbs: 250, fat: 70 } });
    assert.equal(refreshed.meals.find(item => item.id === kept.id)?.venue?.evidence, "chain_web");
  });
});

test("empty menu research and failed search or extraction still try the chain fallback", async () => {
  for (const failure of ["empty", "search", "extraction"]) {
    await withResearchServer((body, index) => {
      if (failure === "search" && index === 0 || failure === "extraction" && index === 1) {
        return { id: "resp_failed", status: "failed", output: [] };
      }
      return fixtureResponse(!!body.tools, failure === "empty" && index === 1 ? [] : [chainMeal]);
    }, async (client, requests) => {
      const result = await researchNearbyMeals({ area: "Nashville, TN", kind: "restaurant" }, undefined, client, async meals => meals);
      assert.equal(result.meals[0]?.evidence, "chain_web", failure);
      assert.equal(requests.filter(body => body.tools).length, 2);
    });
  }
});

test("chain fallback rejects unknown brands, spoofed domains, mismatched chains and uncited branches", async () => {
  const candidate = { ...chainMeal, id: "chain" };
  const research = "Chipotle offers a Chicken bowl at 100 Fixture Street, Nashville, TN.";
  assert.equal(groundedChainMeals([candidate], research).length, 1);
  assert.equal(groundedChainMeals([candidate], "Chipotle has a national menu.").length, 0);
  assert.equal(groundedChainMeals([{ ...candidate, address: "999 Other Road, Nashville, TN" }], research).length, 0);
  assert.equal(groundedChainMeals([{ ...candidate, name: "Unsourced steak bowl" }], research).length, 0);
  for (const patch of [
    { venue: "Fixture Kitchen" }, { venue: "Not Chipotle" },
    { menuUrl: "https://chipotle.com.evil.org/menu" }, { locationUrl: "https://evilchipotle.com/branch" },
    { locationUrl: meal.locationUrl },
  ]) assert.equal(groundedChainMeals([{ ...candidate, ...patch }], research).length, 0);

  await withResearchServer(body => fixtureResponse(!!body.tools, [chainMeal], chainSources.slice(0, 1)), async client => {
    const result = await researchNearbyMeals({ area: "Nashville, TN", kind: "restaurant" }, undefined, client, async () => []);
    assert.deepEqual(result.meals, []);
    assert.deepEqual(result.sources, []);
  });
});

test("cancellation never launches a chain fallback", async () => {
  const controller = new AbortController();
  await withResearchServer(body => fixtureResponse(!!body.tools, [chainMeal]), async (client, requests) => {
    await assert.rejects(researchNearbyMeals({ area: "Nashville, TN", kind: "restaurant" }, controller.signal, client,
      async () => { controller.abort(); return []; }), /abort/i);
    assert.equal(requests.length, 2);
  });
});

test("a failed fallback reports failure instead of fabricating choices", async () => {
  await withResearchServer(() => ({ id: "resp_failed", status: "failed", output: [] }), async (client, requests) => {
    await assert.rejects(researchNearbyMeals({ area: "LGA Terminal B", kind: "airport" }, undefined, client), /Search did not complete/);
    assert.equal(requests.length, 2);
    assert.equal(JSON.parse(requests[1].input).kind, "airport");
    assert.match(requests[1].instructions, /never substitute off-airport venues/);
  });
});
