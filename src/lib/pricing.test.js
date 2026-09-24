import { describe, it, expect } from "vitest";
import {
  PRICING, quoteFare, distanceCharge, roundUpFare, isLateNight, totalFare,
  detectAirport, normalizeAirportAddress, AIRPORTS, formatPrice,
  AIRPORT_FARE_EXAMPLES, POINT_TO_POINT_EXAMPLES, LATE_NIGHT_WINDOW, WAITING_POLICY,
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
      ["St Kilda", 100], ["Ringwood", 145], ["Frankston", 215], ["Mornington", 255], ["Geelong", 260],
    ]);
    for (const e of POINT_TO_POINT_EXAMPLES) expect(e.price).toBeGreaterThanOrEqual(PRICING.MIN_FARE);
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
