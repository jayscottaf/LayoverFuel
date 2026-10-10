import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { load } from "cheerio";
import ipaddr from "ipaddr.js";
import { publicSourceUrl, type NearbyMeal } from "@shared/nearby-meals";

export function publicAddress(address: string): boolean {
  try { return ipaddr.process(address).range() === "unicast"; } catch { return false; }
}

export function normalizeEvidence(text: string): string {
  const abbreviations: Record<string, string> = { avenue: "ave", street: "st", road: "rd", boulevard: "blvd", drive: "dr", north: "n", south: "s", east: "e", west: "w" };
  return text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/\b(avenue|street|road|boulevard|drive|north|south|east|west)\b/g, word => abbreviations[word])
    .replace(/[^a-z0-9]/g, "");
}

async function loadPage(value: string, signal: AbortSignal, redirects = 0): Promise<string> {
  const safe = publicSourceUrl(value);
  if (!safe || redirects > 2) throw new Error("Unsupported source");
  const url = new URL(safe);
  const addresses = await lookup(url.hostname, { all: true });
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(address => !publicAddress(address.address))) throw new Error("Nonpublic source");
  const pinned = addresses.find(address => address.family === 4) ?? addresses[0];
  // Pin the already-validated address. A second DNS lookup must not allow rebinding.
  return new Promise((resolve, reject) => {
    const req = request(url, {
      signal,
      family: pinned.family,
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
      headers: { "User-Agent": "LayoverFuel/1.0 menu-evidence", Accept: "text/html,text/plain", "Accept-Encoding": "identity" },
    }, response => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0) && response.headers.location) {
        response.destroy();
        loadPage(new URL(response.headers.location, url).href, signal, redirects + 1).then(resolve, reject);
        return;
      }
      const contentType = response.headers["content-type"] ?? "";
      if (response.statusCode !== 200 || !/text\/(html|plain)|application\/xhtml\+xml/i.test(contentType) ||
        response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
        response.destroy(); reject(new Error("Readable public HTML required")); return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 1_000_000) { response.destroy(); reject(new Error("Source too large")); return; }
        chunks.push(chunk);
      });
      response.on("error", reject);
      response.on("end", () => {
        try {
          const $ = load(Buffer.concat(chunks).toString("utf8"));
          $("script,style,noscript,iframe,form").remove();
          resolve($("body").text().replace(/\s+/g, " ").trim());
        } catch (error) { reject(error); }
      });
    });
    req.on("error", reject); req.end();
  });
}

export async function publicPageText(url: string, signal?: AbortSignal): Promise<string> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener("abort", cancel, { once: true });
  if (signal?.aborted) cancel();
  const timer = setTimeout(cancel, 8_000);
  let rejectAbort: () => void = () => {};
  const aborted = new Promise<never>((_, reject) => {
    rejectAbort = () => reject(new Error("Source check timed out or cancelled"));
    controller.signal.addEventListener("abort", rejectAbort, { once: true });
    if (controller.signal.aborted) rejectAbort();
  });
  try { return await Promise.race([loadPage(url, controller.signal), aborted]); }
  finally { clearTimeout(timer); signal?.removeEventListener("abort", cancel); controller.signal.removeEventListener("abort", rejectAbort); controller.abort(); }
}

export function supportedMeal(meal: NearbyMeal, menuText: string, locationText: string): boolean {
  if (!normalizeEvidence(menuText).includes(normalizeEvidence(meal.name))) return false;
  const location = normalizeEvidence(locationText);
  const terminal = /\bterminal\s+([a-z]|\d+)\b/i.exec(`${meal.address} ${meal.access}`);
  if (terminal) return location.includes(normalizeEvidence(terminal[0])) && location.includes(normalizeEvidence(meal.venue));
  const street = meal.address.split(",")[0].trim();
  return /\d/.test(street) && normalizeEvidence(street).length >= 8 && location.includes(normalizeEvidence(street));
}

export async function verifyLiveMeals(meals: NearbyMeal[], signal?: AbortSignal): Promise<NearbyMeal[]> {
  const urls = [...new Set(meals.flatMap(meal => [meal.menuUrl, meal.locationUrl]))].slice(0, 12);
  const pages = new Map(await Promise.all(urls.map(async url => [url, await publicPageText(url, signal).catch(() => "")] as const)));
  if (signal?.aborted) throw new Error("Search cancelled");
  return meals.filter(meal => supportedMeal(meal, pages.get(meal.menuUrl) ?? "", pages.get(meal.locationUrl) ?? ""));
}
