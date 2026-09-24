import { describe, it, expect } from "vitest";
import {
  PRICING, quoteFare, distanceCharge, roundUpFare, isLateNight, totalFare,
  detectAirport, normalizeAirportAddress, AIRPORTS, formatPrice,
  AIRPORT_FARE_EXAMPLES, POINT_TO_POINT_EXAMPLES, LATE_NIGHT_WINDOW, WAITING_POLICY,
  SERVICE_AREA, isWithinServiceArea, resolveLocation, assessJourney, findMajorEvent, MAJOR_EVENTS,
  MAJOR_VENUES, findMajorVenue, MAJOR_VENUE_FEE_NOTE,
} from "./pricing.js";

const fare = (km, opts = {}) => quoteFare({ km, ...opts }).fare;

describe("pricing configuration", () => {
  it("matches the published rate card", () => {
    expect(PRICING.BASE_FARE).toBe(55);
    expect(PRICING.MIN_FARE).toBe(100);
    expect(PRICING.DISTANCE_TIERS.map((t) => t.ratePerKm)).toEqual([3.10, 2.75, 2.40]);
    expect(PRICING.DISTANCE_TIERS.map((t) => t.upToKm)).toEqual([25, 50, Infinity]);
    expect(PRICING.ROUND_UP_TO).toBe(5);
    expect(PRICING.LATE_NIGHT).toEqual({ START_HOUR: 0, END_HOUR: 5, SURCHARGE: 0.15 });
    expect(PRICING.WAITING).toEqual({ COMPLIMENTARY_MINUTES: 15, RATE_PER_MINUTE: 1.25 });
  });

  it("has no discount model", () => {
    expect(JSON.stringify(PRICING)).not.toMatch(/DISCOUNT/i);
  });
});

describe("distanceCharge", () => {
  it("applies each tier only to the km inside it", () => {
    expect(distanceCharge(0)).toBe(0);
    expect(distanceCharge(10)).toBeCloseTo(31);
    expect(distanceCharge(25)).toBeCloseTo(77.5);
    expect(distanceCharge(30)).toBeCloseTo(77.5 + 5 * 2.75);
    expect(distanceCharge(50)).toBeCloseTo(77.5 + 68.75);
    expect(distanceCharge(80)).toBeCloseTo(77.5 + 68.75 + 30 * 2.40);
  });
});

describe("roundUpFare", () => {
  it("rounds up to the next $5 and leaves exact multiples alone", () => {
    expect(roundUpFare(100)).toBe(100);
    expect(roundUpFare(100.01)).toBe(105);
    expect(roundUpFare(142.125)).toBe(145);
    // 100 * 1.15 === 114.99999999999999 in floating point — must stay $115, not jump to $120
    expect(roundUpFare(100 * 1.15)).toBe(115);
  });
});

describe("isLateNight", () => {
  it.each([
    ["00:00", true], ["02:00", true], ["04:45", true], ["4:59", true],
    ["05:00", false], ["12:00", false], ["23:45", false],
    ["", false], [undefined, false], ["abc", false], ["25:00", false],
  ])("%s → %s", (time, expected) => {
    expect(isLateNight(time)).toBe(expected);
  });

  it("labels the window from config", () => {
    expect(LATE_NIGHT_WINDOW).toBe("00:00–05:00");
  });
});

describe("quoteFare — standard journeys", () => {
  it("applies the minimum fare to short trips", () => {
    expect(fare(0)).toBe(100);
    expect(fare(6.7)).toBe(100); // CBD → St Kilda: 55 + 20.77 = 75.77 → $100 minimum
    expect(quoteFare({ km: 6.7 }).minimumApplied).toBe(true);
  });

  it("prices across tier boundaries", () => {
    expect(fare(25)).toBe(135);   // 132.50
    expect(fare(28.5)).toBe(145); // 142.125
    expect(fare(50)).toBe(205);   // 201.25
    expect(fare(73.4)).toBe(260); // 257.41
    expect(fare(100)).toBe(325);  // 321.25
  });

  it("adds the late-night surcharge on top of the minimum, then rounds", () => {
    expect(fare(6.7, { time: "02:00" })).toBe(115);   // 100 × 1.15
    expect(fare(28.5, { time: "02:00" })).toBe(165);  // 142.125 × 1.15 = 163.44
    expect(fare(28.5, { time: "05:00" })).toBe(145);
    expect(quoteFare({ km: 28.5, time: "02:00" }).lateNight).toBe(true);
  });

  it("rejects invalid distances", () => {
    expect(quoteFare({ km: null })).toBeNull();
    expect(quoteFare({ km: -1 })).toBeNull();
    expect(quoteFare({ km: NaN })).toBeNull();
    expect(quoteFare()).toBeNull();
  });
});

describe("quoteFare — airport transfers", () => {
  const airport = (km, time) => fare(km, { isAirportTransfer: true, time });

  it("uses the airport rate and airport minimum", () => {
    expect(airport(22.9)).toBe(120); // CBD: 125.99 × 0.9 = 113.39 → $120 airport minimum
    expect(airport(35.0)).toBe(145); // Brighton: 160 × 0.9 = 144
    expect(airport(79.8)).toBe(250); // Geelong
    expect(quoteFare({ km: 22.9, isAirportTransfer: true }).isAirportTransfer).toBe(true);
  });

  it("applies the late-night surcharge to airport fares", () => {
    expect(airport(22.9, "02:00")).toBe(140); // 120 × 1.15 = 138
  });

  // Live Google Distance Matrix driving distances (suburb → Melbourne Airport,
  // measured Sept 2026) against VÉRNO's benchmark airport fares.
  const BENCHMARKS = [
    ["CBD", 22.9, 120], ["Port Melbourne", 25.8, 135], ["South Melbourne", 25.4, 139],
    ["St Kilda", 30.1, 139], ["Elwood", 32.5, 140], ["Brighton", 35.0, 148],
    ["Hampton", 38.3, 152], ["Sandringham", 41.3, 155], ["Cheltenham", 50.5, 164],
    ["Frankston", 77.8, 248], ["Mornington", 95.0, 285], ["Geelong", 79.8, 260],
    ["Hawthorn", 33.3, 143], ["Toorak", 32.0, 141], ["South Yarra", 33.2, 137],
    ["Caulfield", 36.1, 145], ["Kew", 27.6, 140], ["Williamstown", 30.2, 143],
    ["Altona", 28.9, 144], ["Lara", 66.4, 215], ["Beaumaris", 46.7, 165], ["Richmond", 32.0, 140],
  ];

  it("stays commercially close to the Melbourne Airport benchmarks", () => {
    const errors = BENCHMARKS.map(([, km, target]) => airport(km) - target);
    const meanAbs = errors.reduce((s, e) => s + Math.abs(e), 0) / errors.length;
    const bias = errors.reduce((s, e) => s + e, 0) / errors.length;
    expect(meanAbs).toBeLessThanOrEqual(8);
    expect(Math.abs(bias)).toBeLessThanOrEqual(5);
    for (const e of errors) expect(Math.abs(e)).toBeLessThanOrEqual(25);
  });

  it("keeps the CBD airport fare at the advertised $120", () => {
    expect(airport(22.9)).toBe(120);
    expect(airport(22.5)).toBe(120); // reverse direction (airport → CBD)
  });
});

describe("totalFare", () => {
  it("adds actual leg fares", () => {
    expect(totalFare(130, 150)).toBe(280);
  });
  it("is null until every leg is priced", () => {
    expect(totalFare(130, null)).toBeNull();
    expect(totalFare(null, 150)).toBeNull();
    expect(totalFare()).toBeNull();
  });
});

describe("detectAirport", () => {
  it.each([
    ["Melbourne Airport (MEL), Melbourne Airport VIC 3045, Australia", "MEL"],
    ["Departure Dr, Melbourne Airport VIC 3045, Australia", "MEL"],
    ["Melbourne Airport (Tullamarine) VIC, Australia", "MEL"],
    ["Tullamarine Airport", "MEL"],
    ["Melbourne International Airport", "MEL"],
    ["Avalon Airport, 80 Beach Rd, Avalon VIC 3212, Australia", "AVV"],
    ["Avalon Airport (AVV)", "AVV"],
  ])("recognises %s", (address, code) => {
    expect(detectAirport(address)).toBe(code);
  });

  it.each([
    "Tullamarine VIC 3043, Australia",
    "Airport West VIC 3042, Australia",
    "12 Terminal Rd, Port Melbourne VIC 3207, Australia",
    "Avalon Beach NSW 2107, Australia",
    "Avalon Parade, Avalon Beach NSW 2107, Australia",
    "Essendon Fields VIC 3041, Australia",
    "Melbourne VIC 3000, Australia",
    "Mel's Cafe, Richmond VIC 3121, Australia",
    "",
    null,
  ])("does not flag %s", (address) => {
    expect(detectAirport(address)).toBeNull();
  });

  it("uses Places coordinates when the address text doesn't say 'airport'", () => {
    expect(detectAirport("80 Beach Rd, Avalon VIC 3212, Australia", { lat: -38.0390, lng: 144.4700 })).toBe("AVV");
    expect(detectAirport("Arrival Dr, VIC, Australia", { lat: -37.6713, lng: 144.8466 })).toBe("MEL"); // airport hotel precinct
  });

  it("doesn't flag places near but outside the airport precinct", () => {
    expect(detectAirport("Westmeadows VIC 3049, Australia", { lat: -37.6755, lng: 144.8866 })).toBeNull();
    expect(detectAirport("Tullamarine VIC 3043, Australia", { lat: -37.7010, lng: 144.8800 })).toBeNull();
    expect(detectAirport("Melbourne VIC 3000, Australia", { lat: -37.8136, lng: 144.9631 })).toBeNull();
  });
});

describe("normalizeAirportAddress", () => {
  it("maps airport addresses to the canonical Distance Matrix address", () => {
    expect(normalizeAirportAddress("Departure Dr, Melbourne Airport VIC 3045, Australia")).toBe(AIRPORTS.MEL.canonicalAddress);
    expect(normalizeAirportAddress("80 Beach Rd, Avalon VIC 3212", { lat: -38.0394, lng: 144.4694 })).toBe(AIRPORTS.AVV.canonicalAddress);
  });
  it("passes other addresses through unchanged", () => {
    expect(normalizeAirportAddress("St Kilda VIC 3182, Australia")).toBe("St Kilda VIC 3182, Australia");
  });
});

describe("published pricing examples", () => {
  it("airport headline prices stay within $10 of the live engine", () => {
    for (const { from, price, referenceKm } of AIRPORT_FARE_EXAMPLES) {
      const engine = fare(referenceKm, { isAirportTransfer: true });
      expect(Math.abs(engine - price), `${from}: published ${price}, engine ${engine}`).toBeLessThanOrEqual(10);
    }
  });

  it("publishes the requested airport examples", () => {
    expect(AIRPORT_FARE_EXAMPLES.map((e) => [e.from, e.price])).toEqual([
      ["CBD", 120], ["St Kilda", 139], ["South Yarra", 137], ["Toorak", 141], ["Brighton", 148], ["Williamstown", 143],
    ]);
  });

  it("point-to-point examples come from the engine", () => {
    expect(POINT_TO_POINT_EXAMPLES.map((e) => [e.to, e.price])).toEqual([
      ["St Kilda", 100], ["Ringwood", 145], ["Dandenong", 160], ["Frankston", 215], ["Mornington", 255],
    ]);
    for (const e of POINT_TO_POINT_EXAMPLES) expect(e.price).toBeGreaterThanOrEqual(PRICING.MIN_FARE);
  });

  it("only publishes point-to-point prices the calculator will actually quote", () => {
    for (const e of POINT_TO_POINT_EXAMPLES) expect(isWithinServiceArea(e.location), e.to).toBe(true);
  });
});

describe("copy helpers", () => {
  it("formats prices", () => {
    expect(formatPrice(120)).toBe("$120");
    expect(formatPrice(1.25)).toBe("$1.25");
    expect(formatPrice(null)).toBe("");
  });
  it("states the waiting policy from config", () => {
    expect(WAITING_POLICY).toBe(
      "15 minutes complimentary waiting time is included with standard pickups. Additional waiting time is charged at $1.25 per minute. Airport pickups are monitored using live flight information, so flight delays do not reduce your complimentary waiting time."
    );
  });
});

// Google Places coordinates (Sept 2026).
const PLACES = {
  cbd: { address: "Melbourne VIC 3000, Australia", location: { lat: -37.8152, lng: 144.9639 } },
  stKilda: { address: "St Kilda VIC 3182, Australia", location: { lat: -37.8640, lng: 144.9820 } },
  hawthorn: { address: "Hawthorn VIC 3122, Australia", location: { lat: -37.8226, lng: 145.0354 } },
  crown: { address: "Crown Melbourne, 8 Whiteman St, Southbank VIC 3006, Australia", location: { lat: -37.8242, lng: 144.9575 } },
  frankston: { address: "Frankston VIC 3199, Australia", location: { lat: -38.1466, lng: 145.1357 } },
  mornington: { address: "Mornington VIC 3931, Australia", location: { lat: -38.2288, lng: 145.0600 } },
  yarraGlen: { address: "Yarra Glen VIC 3775, Australia", location: { lat: -37.6571, lng: 145.3746 } },
  torquay: { address: "Torquay VIC 3228, Australia", location: { lat: -38.3148, lng: 144.3183 } },
  mtDuneed: { address: "Mount Duneed Estate, 65 Pettavel Rd, Waurn Ponds VIC 3217, Australia", location: { lat: -38.2175, lng: 144.2471 } },
  healesville: { address: "Healesville VIC 3777, Australia", location: { lat: -37.6541, lng: 145.5168 } },
  sorrento: { address: "Sorrento VIC 3943, Australia", location: { lat: -38.3401, lng: 144.7365 } },
  redHill: { address: "Red Hill VIC 3937, Australia", location: { lat: -38.3697, lng: 145.0106 } },
  geelong: { address: "Geelong VIC 3220, Australia", location: { lat: -38.1493, lng: 144.3598 } },
  melAirport: { address: "Terminal 2 - International, Arrival Dr, Melbourne Airport VIC 3045, Australia", location: { lat: -37.6708, lng: 144.8430 } },
  melAirportChip: { address: "Melbourne Airport (Tullamarine) VIC, Australia", location: null },
  avalon: { address: "Avalon Airport, 80 Beach Rd, Lara VIC 3212, Australia", location: { lat: -38.0390, lng: 144.4684 } },
  mcg: { address: "Melbourne Cricket Ground, Brunton Ave, Richmond VIC 3002, Australia", location: { lat: -37.8200, lng: 144.9834 } },
  rodLaver: { address: "Rod Laver Arena, 200 Batman Ave, Melbourne VIC 3004, Australia", location: { lat: -37.8216, lng: 144.9786 } },
  williamstown: { address: "Williamstown VIC 3016, Australia", location: { lat: -37.8636, lng: 144.8979 } },
  johnCain: { address: "John Cain Arena, Olympic Blvd, Melbourne VIC 3001, Australia", location: { lat: -37.82277, lng: 144.98197 } },
  marvel: { address: "Marvel Stadium, 740 Bourke St, Docklands VIC 3008, Australia", location: { lat: -37.81650, lng: 144.94760 } },
  flemington: { address: "Flemington Racecourse, 448 Epsom Rd, Flemington VIC 3031, Australia", location: { lat: -37.79097, lng: 144.91189 } },
  caulfield: { address: "Caulfield Racecourse, Station St, Caulfield East VIC 3145, Australia", location: { lat: -37.87759, lng: 145.03841 } },
};

const journey = (from, to, date = "") => assessJourney({
  from: PLACES[from].address, fromLocation: PLACES[from].location,
  to: PLACES[to].address, toLocation: PLACES[to].location, date,
});

describe("service area", () => {
  it("is a 50 km radius around Melbourne CBD", () => {
    expect(SERVICE_AREA.radiusKm).toBe(50);
    expect(SERVICE_AREA.center).toEqual({ lat: -37.8136, lng: 144.9631 });
  });

  it.each(["cbd", "stKilda", "hawthorn", "frankston", "mornington", "yarraGlen", "melAirport"])("%s is inside", (place) => {
    expect(isWithinServiceArea(PLACES[place].location)).toBe(true);
  });

  it.each(["torquay", "mtDuneed", "healesville", "sorrento", "redHill", "geelong"])("%s is outside", (place) => {
    expect(isWithinServiceArea(PLACES[place].location)).toBe(false);
  });

  it("has no coordinates without a Places selection, unless the address is an airport", () => {
    expect(resolveLocation("Some typed text")).toBeNull();
    expect(resolveLocation(PLACES.melAirportChip.address)).toEqual(AIRPORTS.MEL.location);
  });
});

describe("regional bookings", () => {
  it.each([
    ["torquay", "mtDuneed"],
    ["healesville", "yarraGlen"],
    ["sorrento", "redHill"],
    ["cbd", "geelong"],   // destination outside
    ["geelong", "cbd"],   // pickup outside
    ["geelong", "avalon"],
  ])("%s → %s requires a quote", (from, to) => {
    const j = journey(from, to);
    expect(j.located).toBe(true);
    expect(j.regional).toBe(true);
  });

  it("Torquay → Mt Duneed Estate is never auto-priced at the $115 passenger-distance fare", () => {
    // 18.3 km would be $115 on distance alone — the assessment must stop it being quoted.
    expect(quoteFare({ km: 18.3 }).fare).toBe(115);
    expect(journey("torquay", "mtDuneed").regional).toBe(true);
    expect(journey("mtDuneed", "torquay").regional).toBe(true);
  });

  it.each([
    ["cbd", "melAirport"],
    ["melAirport", "cbd"],
    ["cbd", "melAirportChip"],   // quick "airport" chip has no Places coordinates
    ["melAirportChip", "frankston"],
    ["cbd", "avalon"],           // Avalon sits just beyond 50 km but airports are always serviced
    ["stKilda", "mornington"],
    ["crown", "hawthorn"],
  ])("%s → %s is priced automatically", (from, to) => {
    const j = journey(from, to);
    expect(j.located).toBe(true);
    expect(j.regional).toBe(false);
  });

  it("can't be assessed without coordinates (typed text) — so it isn't auto-priced", () => {
    const j = assessJourney({ from: "Torquay", to: "Mt Duneed", fromLocation: null, toLocation: null });
    expect(j.located).toBe(false);
    expect(j.regional).toBe(false);
  });
});

describe("major events", () => {
  it("are configured with verified dates and a venue radius", () => {
    expect(MAJOR_EVENTS.map((e) => [e.name, e.start, e.end, e.venue.name])).toEqual([
      ["AFL Grand Final", "2026-09-26", "2026-09-26", "MCG"],
      ["Boxing Day Test", "2026-12-26", "2026-12-30", "MCG"],
      ["Australian Open Finals", "2027-01-30", "2027-01-31", "Melbourne Park"],
    ]);
    for (const e of MAJOR_EVENTS) {
      expect(e.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.end >= e.start).toBe(true);
      expect(e.venue.radiusKm).toBeGreaterThan(0);
      expect(Number.isFinite(e.venue.location.lat) && Number.isFinite(e.venue.location.lng)).toBe(true);
    }
  });

  it("flags an MCG trip on Grand Final day", () => {
    expect(journey("cbd", "mcg", "2026-09-26").event?.name).toBe("AFL Grand Final");
    expect(journey("mcg", "stKilda", "2026-09-26").event?.name).toBe("AFL Grand Final"); // pickup at the venue
  });

  it("does not flag an airport transfer on Grand Final day", () => {
    expect(journey("cbd", "melAirport", "2026-09-26").event).toBeNull();
    expect(journey("stKilda", "melAirportChip", "2026-09-26").event).toBeNull();
  });

  it("does not flag the MCG on other days", () => {
    expect(journey("cbd", "mcg", "2026-09-25").event).toBeNull();
    expect(journey("cbd", "mcg", "2026-09-27").event).toBeNull();
    expect(journey("cbd", "mcg", "").event).toBeNull();
  });

  it("flags every day of the Boxing Day Test, and only those", () => {
    for (const d of ["2026-12-26", "2026-12-27", "2026-12-28", "2026-12-29", "2026-12-30"]) {
      expect(journey("stKilda", "mcg", d).event?.name).toBe("Boxing Day Test");
    }
    expect(journey("stKilda", "mcg", "2026-12-25").event).toBeNull();
    expect(journey("stKilda", "mcg", "2026-12-31").event).toBeNull();
  });

  it("flags Melbourne Park on Australian Open finals weekend only", () => {
    expect(journey("hawthorn", "rodLaver", "2027-01-30").event?.name).toBe("Australian Open Finals");
    expect(journey("rodLaver", "crown", "2027-01-31").event?.name).toBe("Australian Open Finals");
    expect(journey("hawthorn", "rodLaver", "2027-01-29").event).toBeNull();
  });

  it("does not flag trips that don't touch the venue", () => {
    expect(journey("crown", "hawthorn", "2026-09-26").event).toBeNull(); // Southbank → Hawthorn
    expect(journey("cbd", "stKilda", "2026-12-26").event).toBeNull();
  });

  it("accepts new events without engine changes", () => {
    const custom = [{ name: "Test Event", start: "2027-03-01", end: "2027-03-02", venue: { name: "X", location: PLACES.crown.location, radiusKm: 1 } }];
    expect(findMajorEvent("2027-03-02", [PLACES.crown.location], custom)?.name).toBe("Test Event");
    expect(findMajorEvent("2027-03-03", [PLACES.crown.location], custom)).toBeNull();
    expect(findMajorEvent("not-a-date", [PLACES.crown.location], custom)).toBeNull();
  });
});

describe("major venue fee", () => {
  // Google Places coordinates of the configured venues and their close neighbours (Sept 2026).
  const VENUE_POINTS = {
    "John Cain Arena": { lat: -37.82277, lng: 144.98197 },
    "Rod Laver Arena": { lat: -37.82162, lng: 144.97856 },
    "MCG": { lat: -37.81997, lng: 144.98345 },
    "Marvel Stadium": { lat: -37.81650, lng: 144.94760 },
    "Flemington Racecourse": { lat: -37.79097, lng: 144.91189 },
    "Caulfield Racecourse": { lat: -37.87759, lng: 145.03841 },
  };
  const NEIGHBOURS = {
    "Margaret Court Arena": { lat: -37.82113, lng: 144.97764 },   // 100 m from Rod Laver Arena
    "AAMI Park": { lat: -37.82443, lng: 144.98441 },              // 280 m from John Cain Arena
    "Jolimont station": { lat: -37.81656, lng: 144.98410 },
    "Richmond station": { lat: -37.82379, lng: 144.98920 },
    "Southern Cross Station": { lat: -37.81839, lng: 144.95250 },
    "Caulfield station": { lat: -37.87706, lng: 145.04203 },
    "Monash University Caulfield": { lat: -37.87735, lng: 145.04500 },
    "Melbourne Showgrounds": { lat: -37.78213, lng: 144.90900 },
    "Palais Theatre": { lat: -37.86758, lng: 144.97603 },
    "Crown Melbourne": { lat: -37.82423, lng: 144.95753 },
    "Melbourne CBD": { lat: -37.8152, lng: 144.9639 },
  };

  it("configures exactly the six major venues, with a $20 fee", () => {
    expect(PRICING.MAJOR_VENUE_FEE).toBe(20);
    expect(MAJOR_VENUES.map((v) => v.name)).toEqual(Object.keys(VENUE_POINTS));
    for (const v of MAJOR_VENUES) expect(v.radiusKm).toBeGreaterThan(0);
  });

  it.each(Object.entries(VENUE_POINTS))("detects %s from its Places coordinates", (name, location) => {
    expect(findMajorVenue(location)?.name).toBe(name);
  });

  it.each(Object.entries(NEIGHBOURS))("does not charge nearby %s", (_, location) => {
    expect(findMajorVenue(location)).toBeNull();
  });

  it("never uses text matching", () => {
    expect(findMajorVenue(null)).toBeNull();
    const j = assessJourney({ from: "Melbourne Cricket Ground", to: "Marvel Stadium" }); // typed, no coordinates
    expect(j.majorVenue).toBeNull();
  });

  it("Williamstown → John Cain Arena: $105 becomes $125 one way", () => {
    const j = journey("williamstown", "johnCain");
    expect(j.majorVenue?.name).toBe("John Cain Arena");
    expect(quoteFare({ km: 15.443 }).fare).toBe(105);
    const q = quoteFare({ km: 15.443, atMajorVenue: !!j.majorVenue });
    expect(q.fare).toBe(125);
    expect(q.venueFee).toBe(20);
  });

  it("each return leg pays its own fee", () => {
    const out = quoteFare({ km: 15.443, atMajorVenue: !!journey("williamstown", "johnCain").majorVenue });
    // With a same-length return route: $125 + $125 = $250
    const sameRoute = quoteFare({ km: 15.443, atMajorVenue: !!journey("johnCain", "williamstown").majorVenue });
    expect(totalFare(out.fare, sameRoute.fare)).toBe(250);
    // Google's actual John Cain Arena → Williamstown route is 20.7 km: $120 + $20 = $140, total $265
    const actualBack = quoteFare({ km: 20.7, atMajorVenue: true });
    expect(actualBack.fare).toBe(140);
    expect(totalFare(out.fare, actualBack.fare)).toBe(265);
  });

  it.each(["rodLaver", "mcg", "marvel", "flemington", "caulfield"])("applies to trips to and from %s", (venue) => {
    expect(journey("stKilda", venue).majorVenue).not.toBeNull();
    expect(journey(venue, "stKilda").majorVenue).not.toBeNull();
  });

  it("charges only once per leg when both ends are major venues", () => {
    const j = journey("mcg", "marvel");
    expect(j.majorVenue).not.toBeNull();
    expect(quoteFare({ km: 4, atMajorVenue: !!j.majorVenue }).fare).toBe(120); // $100 minimum + one $20 fee
  });

  it("is a flat fee: added after the minimum, surcharge and rounding", () => {
    expect(quoteFare({ km: 2.5, atMajorVenue: true }).fare).toBe(120);                    // 100 + 20
    expect(quoteFare({ km: 15.443, time: "02:00", atMajorVenue: true }).fare).toBe(140);  // 102.87 × 1.15 → 120, + 20
    expect(quoteFare({ km: 22.9, isAirportTransfer: true, atMajorVenue: true }).fare).toBe(140); // 120 airport + 20
  });

  it("does not apply to ordinary trips", () => {
    expect(journey("cbd", "stKilda").majorVenue).toBeNull();
    expect(quoteFare({ km: 6.7 }).venueFee).toBe(0);
  });

  it("stays separate from event flagging: MCG on Grand Final day gets both", () => {
    const j = journey("cbd", "mcg", "2026-09-26");
    expect(j.event?.name).toBe("AFL Grand Final");
    expect(j.majorVenue?.name).toBe("MCG");
  });

  it("is overridden by the regional quote rule", () => {
    const j = assessJourney({
      from: PLACES.torquay.address, fromLocation: PLACES.torquay.location,
      to: PLACES.flemington.address, toLocation: PLACES.flemington.location,
    });
    expect(j.majorVenue?.name).toBe("Flemington Racecourse");
    expect(j.regional).toBe(true); // UI shows "Quote Required" — no automatic fare or fee
  });

  it("publishes the fee and venue list", () => {
    expect(MAJOR_VENUE_FEE_NOTE).toBe(
      "A $20 major venue fee applies per trip to or from John Cain Arena, Rod Laver Arena, MCG, Marvel Stadium, Flemington Racecourse and Caulfield Racecourse."
    );
  });
});
