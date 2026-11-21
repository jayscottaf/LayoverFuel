// Turns a BigDataCloud reverse-geocode response into the area name used for meal search.
// The flat fields sometimes come back empty (US towns often have no principalSubdivision),
// so the state and, in the US, the county are read from the administrative list instead.
// Without them "Town of Greenfield, United States of America" resolved to the wrong state.
export function areaFromGeocode(data: unknown): string {
  if (!data || typeof data !== "object") throw new Error("Your area could not be identified. Enter a city instead.");
  const record = data as Record<string, unknown>;
  const clean = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 60) : "";
  const read = (key: string) => clean(record[key]);
  if (read("lookupSource") !== "coordinates" && read("lookupSource") !== "reverseGeocoding") {
    throw new Error("The location service could not confirm your device location. Enter a city instead.");
  }
  if (!read("city") && !read("locality")) throw new Error("No city was found. Enter an area instead.");
  const info = record.localityInfo as { administrative?: unknown } | undefined;
  const admin = Array.isArray(info?.administrative) ? info.administrative as Record<string, unknown>[] : [];
  const adminName = (level: number) => clean(admin.find(item => item?.adminLevel === level)?.name);
  const state = read("principalSubdivision") || adminName(4);
  const county = read("countryCode") === "US" || read("countryName") === "United States of America" ? adminName(6) : "";
  return [...new Set([read("locality"), read("city"), county, state, read("countryName")].filter(Boolean))].join(", ").slice(0, 160);
}
