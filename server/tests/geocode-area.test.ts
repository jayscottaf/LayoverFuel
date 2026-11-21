import test from "node:test";
import assert from "node:assert/strict";
import { areaFromGeocode } from "../../shared/geocode-area";

const admin = (...levels: [string, number][]) => ({ administrative: levels.map(([name, adminLevel]) => ({ name, adminLevel })) });

test("a US town with no principalSubdivision gets its county and state from the admin list", () => {
  // Shape BigDataCloud returns for Greenfield Center, NY (12833).
  const area = areaFromGeocode({
    lookupSource: "coordinates", locality: "Town of Greenfield", city: "Town of Greenfield",
    principalSubdivision: "", countryName: "United States of America", countryCode: "US",
    localityInfo: admin(["United States of America", 2], ["New York", 4], ["Saratoga County", 6], ["Town of Greenfield", 7]),
  });
  assert.equal(area, "Town of Greenfield, Saratoga County, New York, United States of America");
});

test("a normal US city keeps its state and adds the county", () => {
  const area = areaFromGeocode({
    lookupSource: "coordinates", locality: "Nashville", city: "Nashville", principalSubdivision: "Tennessee",
    countryName: "United States of America", countryCode: "US",
    localityInfo: admin(["United States of America", 2], ["Tennessee", 4], ["Davidson County", 6]),
  });
  assert.equal(area, "Nashville, Davidson County, Tennessee, United States of America");
});

test("outside the US the label is unchanged and no county-level name is added", () => {
  const area = areaFromGeocode({
    lookupSource: "coordinates", locality: "Camden Town", city: "London", principalSubdivision: "England",
    countryName: "United Kingdom", countryCode: "GB", localityInfo: admin(["United Kingdom", 2], ["England", 4], ["Greater London", 6]),
  });
  assert.equal(area, "Camden Town, London, England, United Kingdom");
});

test("unconfirmed or empty lookups are still rejected", () => {
  assert.throws(() => areaFromGeocode({ lookupSource: "ipGeolocation", city: "Albany" }), /could not confirm/);
  assert.throws(() => areaFromGeocode({ lookupSource: "coordinates", countryName: "United States of America" }), /No city/);
  assert.throws(() => areaFromGeocode(null), /could not be identified/);
});
