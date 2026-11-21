// Major passenger airports, so a device location or a typed code/nickname resolves to the airport
// without a network lookup. Coordinates are the terminal area, to two or more decimals.
export interface Airport { code: string; name: string; city: string; lat: number; lon: number; aliases: string[] }

const A = (code: string, name: string, city: string, lat: number, lon: number, ...aliases: string[]): Airport =>
  ({ code, name, city, lat, lon, aliases });

export const AIRPORTS: Airport[] = [
  A("ATL", "Hartsfield-Jackson Atlanta International Airport", "Atlanta", 33.6407, -84.4277, "hartsfield"),
  A("BOS", "Boston Logan International Airport", "Boston", 42.3656, -71.0096, "logan"),
  A("BWI", "Baltimore/Washington International Airport", "Baltimore", 39.1754, -76.6683, "thurgood marshall"),
  A("CLT", "Charlotte Douglas International Airport", "Charlotte", 35.214, -80.9431, "charlotte douglas"),
  A("ORD", "Chicago O'Hare International Airport", "Chicago", 41.9742, -87.9073, "o'hare", "ohare"),
  A("MDW", "Chicago Midway International Airport", "Chicago", 41.7868, -87.7522, "midway"),
  A("DFW", "Dallas Fort Worth International Airport", "Dallas", 32.8998, -97.0403, "dallas fort worth", "dallas/fort worth"),
  A("DAL", "Dallas Love Field", "Dallas", 32.8471, -96.8518, "love field"),
  A("DEN", "Denver International Airport", "Denver", 39.8561, -104.6737),
  A("DTW", "Detroit Metropolitan Wayne County Airport", "Detroit", 42.2124, -83.3534, "detroit metro"),
  A("EWR", "Newark Liberty International Airport", "Newark", 40.6895, -74.1745, "newark liberty"),
  A("FLL", "Fort Lauderdale-Hollywood International Airport", "Fort Lauderdale", 26.0726, -80.1527),
  A("HNL", "Daniel K. Inouye International Airport", "Honolulu", 21.3187, -157.9225, "inouye"),
  A("IAH", "George Bush Intercontinental Airport", "Houston", 29.9902, -95.3368, "bush intercontinental"),
  A("HOU", "William P. Hobby Airport", "Houston", 29.6454, -95.2789, "hobby"),
  A("JFK", "John F. Kennedy International Airport", "New York", 40.6413, -73.7781, "kennedy"),
  A("LGA", "LaGuardia Airport", "New York", 40.7769, -73.874, "laguardia", "la guardia"),
  A("LAS", "Harry Reid International Airport", "Las Vegas", 36.084, -115.1537, "harry reid", "mccarran"),
  A("LAX", "Los Angeles International Airport", "Los Angeles", 33.9416, -118.4085),
  A("MCO", "Orlando International Airport", "Orlando", 28.4312, -81.3081),
  A("MIA", "Miami International Airport", "Miami", 25.7959, -80.287),
  A("MSP", "Minneapolis-Saint Paul International Airport", "Minneapolis", 44.8848, -93.2223),
  A("BNA", "Nashville International Airport", "Nashville", 36.1263, -86.6774),
  A("PHL", "Philadelphia International Airport", "Philadelphia", 39.8744, -75.2424),
  A("PHX", "Phoenix Sky Harbor International Airport", "Phoenix", 33.4352, -112.0101, "sky harbor"),
  A("PDX", "Portland International Airport", "Portland", 45.5898, -122.5951),
  A("SLC", "Salt Lake City International Airport", "Salt Lake City", 40.7899, -111.9791),
  A("SAN", "San Diego International Airport", "San Diego", 32.7338, -117.1933),
  A("SFO", "San Francisco International Airport", "San Francisco", 37.6213, -122.379),
  A("SJC", "San Jose Mineta International Airport", "San Jose", 37.3639, -121.9289, "mineta"),
  A("OAK", "Oakland International Airport", "Oakland", 37.7126, -122.2197),
  A("SEA", "Seattle-Tacoma International Airport", "Seattle", 47.4502, -122.3088, "sea-tac", "seatac"),
  A("TPA", "Tampa International Airport", "Tampa", 27.9755, -82.5332),
  A("IAD", "Washington Dulles International Airport", "Washington", 38.9531, -77.4565, "dulles"),
  A("DCA", "Ronald Reagan Washington National Airport", "Washington", 38.8512, -77.0402, "reagan national", "reagan"),
  A("AUS", "Austin-Bergstrom International Airport", "Austin", 30.1975, -97.6664, "bergstrom"),
  A("RDU", "Raleigh-Durham International Airport", "Raleigh", 35.8801, -78.788, "raleigh-durham"),
  A("STL", "St. Louis Lambert International Airport", "St. Louis", 38.7487, -90.37, "lambert"),
  A("MCI", "Kansas City International Airport", "Kansas City", 39.2976, -94.7139),
  A("CLE", "Cleveland Hopkins International Airport", "Cleveland", 41.4117, -81.8498, "hopkins"),
  A("PIT", "Pittsburgh International Airport", "Pittsburgh", 40.4915, -80.2329),
  A("CVG", "Cincinnati/Northern Kentucky International Airport", "Cincinnati", 39.0488, -84.6678),
  A("IND", "Indianapolis International Airport", "Indianapolis", 39.7173, -86.2944),
  A("CMH", "John Glenn Columbus International Airport", "Columbus", 39.998, -82.8919, "john glenn"),
  A("MSY", "Louis Armstrong New Orleans International Airport", "New Orleans", 29.9934, -90.258, "louis armstrong"),
  A("SAT", "San Antonio International Airport", "San Antonio", 29.5337, -98.4698),
  A("SMF", "Sacramento International Airport", "Sacramento", 38.6954, -121.5908),
  A("SNA", "John Wayne Airport", "Santa Ana", 33.6757, -117.8682, "john wayne"),
  A("BUR", "Hollywood Burbank Airport", "Burbank", 34.2007, -118.3587),
  A("RSW", "Southwest Florida International Airport", "Fort Myers", 26.5362, -81.7552),
  A("PBI", "Palm Beach International Airport", "West Palm Beach", 26.6832, -80.0956),
  A("JAX", "Jacksonville International Airport", "Jacksonville", 30.4941, -81.6879),
  A("CHS", "Charleston International Airport", "Charleston", 32.8986, -80.0405),
  A("SAV", "Savannah/Hilton Head International Airport", "Savannah", 32.1276, -81.2021),
  A("MEM", "Memphis International Airport", "Memphis", 35.0424, -89.9767),
  A("MKE", "Milwaukee Mitchell International Airport", "Milwaukee", 42.9472, -87.8966),
  A("OMA", "Eppley Airfield", "Omaha", 41.3032, -95.8941, "eppley"),
  A("ABQ", "Albuquerque International Sunport", "Albuquerque", 35.0402, -106.609, "sunport"),
  A("ANC", "Ted Stevens Anchorage International Airport", "Anchorage", 61.1743, -149.9962),
  A("OGG", "Kahului Airport", "Kahului", 20.8986, -156.4305),
  A("BDL", "Bradley International Airport", "Hartford", 41.9389, -72.6832, "bradley"),
  A("PVD", "Rhode Island T.F. Green International Airport", "Providence", 41.724, -71.4283, "t.f. green", "tf green"),
  A("ALB", "Albany International Airport", "Albany", 42.7483, -73.8017),
  A("BUF", "Buffalo Niagara International Airport", "Buffalo", 42.9405, -78.7322),
  A("SYR", "Syracuse Hancock International Airport", "Syracuse", 43.1112, -76.1063),
  A("ROC", "Greater Rochester International Airport", "Rochester", 43.1189, -77.6724),
  A("RIC", "Richmond International Airport", "Richmond", 37.5052, -77.3197),
  A("ORF", "Norfolk International Airport", "Norfolk", 36.8946, -76.2012),
  A("GSP", "Greenville-Spartanburg International Airport", "Greenville", 34.8957, -82.2189),
  A("SDF", "Louisville Muhammad Ali International Airport", "Louisville", 38.1744, -85.736),
  A("OKC", "Will Rogers International Airport", "Oklahoma City", 35.3931, -97.6007, "will rogers"),
  A("TUL", "Tulsa International Airport", "Tulsa", 36.1984, -95.8881),
  A("ELP", "El Paso International Airport", "El Paso", 31.8072, -106.3776),
  A("TUS", "Tucson International Airport", "Tucson", 32.1161, -110.941),
  A("BOI", "Boise Airport", "Boise", 43.5644, -116.2228),
  A("GEG", "Spokane International Airport", "Spokane", 47.6199, -117.5338),
  A("SJU", "Luis Muñoz Marín International Airport", "San Juan", 18.4394, -66.0018),
  A("YYZ", "Toronto Pearson International Airport", "Toronto", 43.6777, -79.6248, "pearson"),
  A("YVR", "Vancouver International Airport", "Vancouver", 49.1947, -123.1792),
  A("YUL", "Montréal-Trudeau International Airport", "Montreal", 45.4706, -73.7408, "trudeau"),
  A("MEX", "Mexico City International Airport", "Mexico City", 19.4363, -99.0721, "benito juarez"),
  A("CUN", "Cancún International Airport", "Cancun", 21.0365, -86.8771),
  A("LHR", "London Heathrow Airport", "London", 51.47, -0.4543, "heathrow"),
  A("LGW", "London Gatwick Airport", "London", 51.1537, -0.1821, "gatwick"),
  A("CDG", "Paris Charles de Gaulle Airport", "Paris", 49.0097, 2.5479, "charles de gaulle"),
  A("AMS", "Amsterdam Airport Schiphol", "Amsterdam", 52.3105, 4.7683, "schiphol"),
  A("FRA", "Frankfurt Airport", "Frankfurt", 50.0379, 8.5622),
  A("MUC", "Munich Airport", "Munich", 48.3537, 11.775),
  A("MAD", "Madrid-Barajas Airport", "Madrid", 40.4983, -3.5676, "barajas"),
  A("BCN", "Barcelona-El Prat Airport", "Barcelona", 41.2974, 2.0833, "el prat"),
  A("FCO", "Rome Fiumicino Airport", "Rome", 41.8003, 12.2389, "fiumicino"),
  A("DUB", "Dublin Airport", "Dublin", 53.4264, -6.2499),
  A("ZRH", "Zurich Airport", "Zurich", 47.4582, 8.5555),
  A("IST", "Istanbul Airport", "Istanbul", 41.2753, 28.7519),
  A("DXB", "Dubai International Airport", "Dubai", 25.2532, 55.3657),
  A("DOH", "Hamad International Airport", "Doha", 25.2731, 51.6081, "hamad"),
  A("SIN", "Singapore Changi Airport", "Singapore", 1.3644, 103.9915, "changi"),
  A("HKG", "Hong Kong International Airport", "Hong Kong", 22.308, 113.9185),
  A("NRT", "Narita International Airport", "Tokyo", 35.772, 140.3929, "narita"),
  A("HND", "Tokyo Haneda Airport", "Tokyo", 35.5494, 139.7798, "haneda"),
  A("ICN", "Incheon International Airport", "Seoul", 37.4602, 126.4407, "incheon"),
  A("SYD", "Sydney Kingsford Smith Airport", "Sydney", -33.9399, 151.1753, "kingsford smith"),
  A("GRU", "São Paulo/Guarulhos International Airport", "Sao Paulo", -23.4356, -46.4731, "guarulhos"),
  A("BOG", "El Dorado International Airport", "Bogota", 4.7016, -74.1469, "el dorado"),
];

export const airportLabel = (airport: Airport) => `${airport.name} (${airport.code})`;

const plain = (text: string) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();

function kilometres(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

/** The listed airport whose terminals are within about 3.5 km of this position, if any. */
export function nearestAirport(lat: number, lon: number, withinKm = 3.5): Airport | null {
  let best: Airport | null = null; let bestKm = withinKm;
  for (const airport of AIRPORTS) {
    const km = kilometres(lat, lon, airport.lat, airport.lon);
    if (km <= bestKm) { best = airport; bestKm = km; }
  }
  return best;
}

/** Recognise an airport from typed text: a code ("bos", "BOS Terminal B"), a nickname ("Boston Logan") or "<city> airport". */
export function resolveAirport(text: string): Airport | null {
  const value = plain(text).trim();
  if (value.length < 3) return null;
  const words = value.split(/[^a-z0-9']+/).filter(Boolean);
  const mentionsAirport = /\b(airport|terminal|concourse|gate)\b/.test(value);
  const byCode = AIRPORTS.find(a => {
    const code = a.code.toLowerCase();
    return value === code || value.includes(`(${code})`) || (words[0] === code && (words.length === 1 || mentionsAirport)) ||
      (mentionsAirport && text.split(/[^A-Za-z]+/).includes(a.code));
  });
  if (byCode) return byCode;
  // A one-word nickname ("logan", "midway") is also a place name, so it needs the city or the word airport beside it.
  const byName = AIRPORTS.find(a => value.includes(plain(a.name)) || a.aliases.some(alias => {
    const found = new RegExp(`(^|[^a-z])${alias.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([^a-z]|$)`).test(value);
    return found && (alias.includes(" ") || value === alias || mentionsAirport || value.includes(plain(a.city)));
  }));
  if (byName) return byName;
  if (!mentionsAirport) return null;
  const inCity = AIRPORTS.filter(a => value.includes(plain(a.city)));
  return inCity.length === 1 ? inCity[0] : null;
}

/** Words that place something inside this airport: its code, its nicknames, or its name. */
export function airportTerms(airport: Airport): string[] {
  return [airport.code.toLowerCase(), ...airport.aliases, plain(airport.name.replace(/\b(international|airport)\b/gi, "")).trim()];
}
