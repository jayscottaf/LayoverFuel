import type { NearbyMeal } from "@shared/nearby-meals";
import { supportedMeal } from "./public-menu-evidence";

// National menus can be researched even when a branch's menu is JS-only.
// Match both the brand and its official domain; citations alone are not enough
// to turn an unrelated website or an invented restaurant into a chain option.
const chains = [
  { names: ["Chipotle"], domains: ["chipotle.com"] },
  { names: ["Sweetgreen"], domains: ["sweetgreen.com"] },
  { names: ["Cava"], domains: ["cava.com"] },
  { names: ["Panera", "Panera Bread"], domains: ["panerabread.com"] },
  { names: ["Subway"], domains: ["subway.com"] },
  { names: ["Chick-fil-A"], domains: ["chick-fil-a.com"] },
  { names: ["McDonald's", "McDonalds"], domains: ["mcdonalds.com"] },
  { names: ["Wendy's", "Wendys"], domains: ["wendys.com"] },
  { names: ["Burger King"], domains: ["bk.com"] },
  { names: ["Taco Bell"], domains: ["tacobell.com"] },
  { names: ["Panda Express"], domains: ["pandaexpress.com"] },
  { names: ["Starbucks"], domains: ["starbucks.com"] },
  { names: ["Dunkin", "Dunkin'"], domains: ["dunkindonuts.com"] },
  { names: ["Jersey Mike's", "Jersey Mikes"], domains: ["jerseymikes.com"] },
  { names: ["Potbelly"], domains: ["potbelly.com"] },
  { names: ["Qdoba"], domains: ["qdoba.com"] },
  { names: ["Noodles & Company", "Noodles and Company"], domains: ["noodles.com"] },
  { names: ["Shake Shack"], domains: ["shakeshack.com"] },
  { names: ["Popeyes"], domains: ["popeyes.com"] },
  { names: ["KFC", "Kentucky Fried Chicken"], domains: ["kfc.com"] },
  { names: ["Pret", "Pret A Manger"], domains: ["pret.com", "pretamanger.com"] },
  { names: ["Tim Hortons"], domains: ["timhortons.com"] },
  { names: ["Whole Foods", "Whole Foods Market"], domains: ["wholefoodsmarket.com"] },
  { names: ["Trader Joe's", "Trader Joes"], domains: ["traderjoes.com"] },
  { names: ["Kroger"], domains: ["kroger.com"] },
  { names: ["Publix"], domains: ["publix.com"] },
  { names: ["Wawa"], domains: ["wawa.com"] },
  { names: ["Sheetz"], domains: ["sheetz.com"] },
] as const;

export const chainSearchGuide = chains.map(chain => ({ name: chain.names[0], domains: chain.domains }));

function brandName(value: string) {
  return value.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function officialDomain(url: string, domains: readonly string[]) {
  const host = new URL(url).hostname.toLowerCase();
  return domains.some(domain => host === domain || host.endsWith(`.${domain}`));
}

export function groundedChainMeals(meals: NearbyMeal[], researchText: string): NearbyMeal[] {
  return meals.filter(meal => {
    const name = brandName(meal.venue);
    const chain = chains.find(chain => chain.names.some(alias =>
      name === brandName(alias) || name.startsWith(`${brandName(alias)} `)));
    return chain && officialDomain(meal.menuUrl, chain.domains) && officialDomain(meal.locationUrl, chain.domains) &&
      supportedMeal(meal, researchText, researchText);
  }).map(meal => ({ ...meal, evidence: "chain_web" }));
}
