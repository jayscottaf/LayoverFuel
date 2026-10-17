import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import OpenAI from "openai";
import { nearbyInputSchema, publicSourceUrl, rankNearbyMeals } from "../../shared/nearby-meals";
import { groundedDiscovery, groundedMeals, groundedPlaces, researchNearbyMeals } from "../services/nearby-meals-service";
import { planMealSchema } from "../../shared/travel-plan";
import { buildTravelPlan } from "../services/travel-plan-service";
import { publicAddress, supportedMeal } from "../services/public-menu-evidence";

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

const discovery = (meals: unknown[] = [], places: unknown[] = [], airport: unknown = null, locationNote = "") => ({ meals, places, airport, locationNote });
const independentMeal = { ...meal, menuUrl: "https://fixturekitchen.com/menu", locationUrl: "https://www.localdiningguide.com/fixture-kitchen" };
const independentSources = [independentMeal.menuUrl, independentMeal.locationUrl].map(url => ({ title: "Fixture source", url }));
const independentResearch = "Fixture Kitchen serves a Chicken bowl with chicken, rice and vegetables at 100 Fixture Street, Nashville, TN.";
const airportSource = { title: "CHS airport dining", url: "https://iflychs.com/passengers/dining-shopping/" };
const airport = { name: "Charleston International Airport", code: "CHS", sourceUrl: airportSource.url };
// Synthetic summaries of the kinds of location/food evidence available in an airport directory.
const airportResearch = "Charleston International Airport (CHS) serves North Charleston. Verde offers a Seasonal salad in Central Marketplace. Charleston Beer Works serves breakfast, lunch and dinner in Concourse A.";
const airportMeal = { ...meal, venue: "Verde", address: "Charleston International Airport, Central Marketplace",
  name: "Seasonal salad", menuUrl: airportSource.url, locationUrl: airportSource.url };
const airportPlace = { venue: "Charleston Beer Works", address: "CHS, Concourse A", access: "",
  details: "Breakfast, lunch and dinner; individual menu items not confirmed.", locationUrl: airportSource.url, menuUrl: null };

function fixtureResponse(search: boolean, data = discovery([independentMeal]), citations = independentSources, research = independentResearch) {
  return { id: "resp_fixture", object: "response", status: "completed", output: [
    ...(search ? [{ id: "search_fixture", type: "web_search_call", status: "completed", action: { type: "search", query: "fixture" } }] : []),
    { id: "msg_fixture", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text",
      text: search ? research : JSON.stringify(data),
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

test("independent restaurant meals use cited web menus without a brand whitelist or HTML re-download", async () => {
  await withResearchServer(body => fixtureResponse(!!body.tools), async (client, requests) => {
    const result = await researchNearbyMeals({ area: "Nashville, TN", kind: "restaurant" }, undefined, client);
    assert.equal(result.meals.length, 1);
    assert.equal(result.meals[0].evidence, "web");
    assert.deepEqual(result.sources, independentSources);
    assert.equal(requests.length, 2, "A web search and extraction are sufficient; no second menu download is required");
    assert.equal(requests[0].tools[0].type, "web_search");
    assert.equal(requests[0].tool_choice, "required");
    assert.equal(requests.every(body => body.store === false), true);
    assert.deepEqual(JSON.parse(requests[0].input), { area: "Nashville, TN", kind: "restaurant" });
  });
});

test("North Charleston airport search accepts directory meals and local concepts without street addresses or gate numbers", async () => {
  const data = discovery([airportMeal], [airportPlace], airport, "Using CHS, the principal passenger airport for this area.");
  await withResearchServer(body => fixtureResponse(!!body.tools, data, [airportSource], airportResearch), async (client, requests) => {
    const result = await researchNearbyMeals({ area: "North Charleston, South Carolina, United States of America", kind: "airport" }, undefined, client);
    assert.equal(result.airport?.code, "CHS");
    assert.equal(result.meals[0]?.venue, "Verde");
    assert.equal(result.meals[0]?.evidence, "web");
    assert.equal(result.places?.[0]?.venue, "Charleston Beer Works");
    assert.equal(result.places?.[0]?.menuUrl, null);
    assert.equal("calories" in result.places![0], false, "Unknown meals must not acquire fabricated nutrition");
    assert.match(result.locationNote!, /Using CHS/);
    assert.equal(requests.length, 2);
    assert.equal(JSON.parse(requests[0].input).kind, "airport");
    assert.match(requests[0].instructions, /A device-derived city is NOT an airport name/);
  });
});

test("place-only results survive when specific menu items are unknown", async () => {
  await withResearchServer(body => fixtureResponse(!!body.tools, discovery([], [airportPlace], airport), [airportSource], airportResearch), async (client, requests) => {
    const result = await researchNearbyMeals({ area: "CHS", kind: "airport" }, undefined, client);
    assert.deepEqual(result.meals, []);
    assert.equal(result.places?.length, 1);
    assert.equal(requests.length, 2, "Useful restaurants do not require another slow search");
  });
});

test("airport research excludes off-airport restaurants and unsupported airport identities", () => {
  const allSources = [airportSource, ...independentSources];
  const research = airportResearch + " " + independentResearch;
  const input = { area: "CHS", kind: "airport" as const };
  const result = groundedDiscovery(discovery([airportMeal, independentMeal], [airportPlace], airport), allSources, research, input);
  assert.equal(result.meals.length, 1);
  assert.equal(result.places?.length, 1);
  const reformatted = groundedDiscovery(discovery([airportMeal], [{ ...airportPlace, address: "CHS — Concourse A" }], airport),
    allSources, research.replace("Charleston International Airport", "Charleston International"), input);
  assert.equal(reformatted.meals.length, 1, "The word Airport is not required in every occurrence of the airport name");
  assert.equal(reformatted.places?.length, 1, "Concourse addresses can use punctuation other than commas");
  const wrongConcourse = groundedDiscovery(discovery([], [{ ...airportPlace, address: "CHS, Concourse Z" }], airport), allSources, research, input);
  assert.deepEqual(wrongConcourse.places, [], "Concourse claims must occur in the research");
  for (const patch of [{ name: "Invented International Airport" }, { code: "XYZ" }, { sourceUrl: "https://inventedairport.com/dining" }]) {
    const rejected = groundedDiscovery(discovery([airportMeal], [airportPlace], { ...airport, ...patch }), allSources, research, input);
    assert.equal(rejected.airport, null);
    assert.deepEqual(rejected.meals, []);
    assert.deepEqual(rejected.places, []);
  }
});

test("ambiguous city airports ask for a specific airport instead of inventing one", async () => {
  await withResearchServer(body => fixtureResponse(!!body.tools, discovery([], [], null, "Several airports serve this city.")), async (client, requests) => {
    const result = await researchNearbyMeals({ area: "London", kind: "airport" }, undefined, client);
    assert.equal(result.airport, null);
    assert.match(result.locationNote!, /airport name or code/);
    assert.deepEqual(result.meals, []);
    assert.equal(requests.length, 2);
  });
});

test("web research cannot turn uncited menus, guessed dishes or wrong locations into choices", () => {
  const input = { area: "Nashville, TN", kind: "restaurant" as const };
  for (const patch of [{ name: "Unsourced steak bowl" }, { venue: "Invented Kitchen" }, { address: "999 Other Road, Nashville" },
    { menuUrl: "https://inventedkitchen.com/menu" }]) {
    assert.equal(groundedDiscovery(discovery([{ ...independentMeal, ...patch }]), independentSources, independentResearch, input).meals.length, 0);
  }
  const place = { ...airportPlace, venue: independentMeal.venue, address: independentMeal.address, locationUrl: independentMeal.locationUrl };
  assert.equal(groundedPlaces({ places: [place, place] }, independentSources, independentResearch).length, 1);
  assert.equal(groundedPlaces({ places: [place] }, [], independentResearch).length, 0);
  for (const menuUrl of ["https://inventedkitchen.com/menu", "javascript:alert(1)"]) {
    const rescued = groundedPlaces({ places: [{ ...place, menuUrl }] }, independentSources, independentResearch);
    assert.equal(rescued.length, 1, "An unavailable menu must not discard a sourced restaurant");
    assert.equal(rescued[0].menuUrl, null);
  }
});

test("web evidence and legacy chain evidence survive a saved plan refresh", () => {
  for (const evidence of ["web", "chain_web", "live_menu"] as const) {
    const kept = planMealSchema.parse({ ...independentMeal, id: "kept-fixture", description: meal.order, status: "locked", source: "estimate",
      venue: { name: meal.venue, address: meal.address, menuUrl: independentMeal.menuUrl, locationUrl: independentMeal.locationUrl,
        checkedAt: "2026-10-17T12:00:00.000Z", evidence } });
    const refreshed = buildTravelPlan({ date: "2026-10-17", timezone: "UTC", savedMeals: [kept], logs: [],
      targets: { calories: 2200, protein: 130, carbs: 250, fat: 70 } });
    assert.equal(refreshed.meals.find(item => item.id === kept.id)?.venue?.evidence, evidence);
  }
});

test("empty research and failed search or extraction try one broader web search", async () => {
  for (const failure of ["empty", "search", "extraction"]) {
    await withResearchServer((body, index) => {
      if (failure === "search" && index === 0 || failure === "extraction" && index === 1) {
        return { id: "resp_failed", status: "failed", output: [] };
      }
      return fixtureResponse(!!body.tools, failure === "empty" && index === 1 ? discovery() : discovery([independentMeal]));
    }, async (client, requests) => {
      const result = await researchNearbyMeals({ area: "Nashville, TN", kind: "restaurant" }, undefined, client);
      assert.equal(result.meals[0]?.evidence, "web", failure);
      const searches = requests.filter(body => body.tools);
      assert.equal(searches.length, 2);
      assert.match(searches[1].instructions, /Try different search terms/);
    });
  }
});

test("searches without citations cannot produce food recommendations", async () => {
  await withResearchServer(body => fixtureResponse(!!body.tools, discovery([independentMeal]), []), async (client, requests) => {
    const result = await researchNearbyMeals({ area: "Nashville, TN", kind: "restaurant" }, undefined, client);
    assert.deepEqual(result.meals, []);
    assert.deepEqual(result.places, []);
    assert.deepEqual(result.sources, []);
    assert.equal(requests.length, 2, "No extraction runs when neither search returns citations");
  });
});

test("cancellation never starts another web search", async () => {
  const controller = new AbortController();
  await withResearchServer(body => { controller.abort(); return fixtureResponse(!!body.tools); }, async (client, requests) => {
    await assert.rejects(researchNearbyMeals({ area: "Nashville, TN", kind: "restaurant" }, controller.signal, client), /abort/i);
    assert.equal(requests.length, 1);
  });
});

test("failed searches report failure instead of fabricating food choices", async () => {
  await withResearchServer(() => ({ id: "resp_failed", status: "failed", output: [] }), async (client, requests) => {
    await assert.rejects(researchNearbyMeals({ area: "LGA Terminal B", kind: "airport" }, undefined, client), /Search did not complete/);
    assert.equal(requests.length, 2);
    assert.match(requests[1].instructions, /Never substitute off-airport venues/);
  });
});
