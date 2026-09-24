// VÉRNO pricing — the single source of truth for every fare shown on the site.
//
// The fare calculator, return-trip pricing, pricing tables, FAQ copy, booking
// messages and structured data all derive from this file. Change prices here.
//
// This module is pure (no DOM / Google Maps access) so it can be unit tested.

export const PRICING = {
  CURRENCY_SYMBOL: "$",

  // Standard distance-based fare
  BASE_FARE: 55,
  MIN_FARE: 100,
  DISTANCE_TIERS: [
    { upToKm: 25, ratePerKm: 3.10 },       // 0–25 km
    { upToKm: 50, ratePerKm: 2.75 },       // 25–50 km
    { upToKm: Infinity, ratePerKm: 2.40 }, // 50+ km
  ],
  ROUND_UP_TO: 5, // final fare is rounded UP to the next $5

  // Applied by pickup time (24h clock, END_HOUR exclusive).
  LATE_NIGHT: { START_HOUR: 0, END_HOUR: 5, SURCHARGE: 0.15 },

  // Airport transfers (to or from Melbourne / Avalon Airport).
  // Freeway airport runs are priced at 90% of the standard distance fare, with
  // their own minimum. Calibrated against VÉRNO's Melbourne Airport benchmark
  // fares (e.g. CBD ≈ $120, Brighton ≈ $148, Geelong ≈ $260) using live
  // Distance Matrix distances — see src/lib/pricing.test.js.
  AIRPORT: { RATE_MULTIPLIER: 0.90, MIN_FARE: 120 },

  // Waiting time (not added automatically — charged only if it occurs).
  WAITING: { COMPLIMENTARY_MINUTES: 15, RATE_PER_MINUTE: 1.25 },
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatPrice(amount) {
  if (amount == null || !Number.isFinite(amount)) return "";
  const value = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${PRICING.CURRENCY_SYMBOL}${value}`;
}

function formatHour(hour) {
  return `${String(hour % 24).padStart(2, "0")}:00`;
}

/** e.g. "00:00–05:00" */
export const LATE_NIGHT_WINDOW = `${formatHour(PRICING.LATE_NIGHT.START_HOUR)}–${formatHour(PRICING.LATE_NIGHT.END_HOUR)}`;

/** e.g. "15%" */
export const LATE_NIGHT_SURCHARGE_LABEL = `${Math.round(PRICING.LATE_NIGHT.SURCHARGE * 100)}%`;

export const WAITING_POLICY =
  `${PRICING.WAITING.COMPLIMENTARY_MINUTES} minutes complimentary waiting time is included with standard pickups. ` +
  `Additional waiting time is charged at ${formatPrice(PRICING.WAITING.RATE_PER_MINUTE)} per minute. ` +
  "Airport pickups are monitored using live flight information, so flight delays do not reduce your complimentary waiting time.";

export const SPECIAL_QUOTE_NOTE =
  "Major events, extended waiting requirements and special itinerary bookings may be quoted separately.";

// ---------------------------------------------------------------------------
// Fare engine
// ---------------------------------------------------------------------------

/** True when an "HH:MM" pickup time falls inside the late-night window. */
export function isLateNight(time) {
  if (typeof time !== "string") return false;
  const match = /^(\d{1,2}):(\d{2})/.exec(time.trim());
  if (!match) return false;
  const hour = Number(match[1]);
  if (hour > 23) return false;
  const { START_HOUR, END_HOUR } = PRICING.LATE_NIGHT;
  return START_HOUR <= END_HOUR
    ? hour >= START_HOUR && hour < END_HOUR
    : hour >= START_HOUR || hour < END_HOUR; // window crossing midnight
}

/** Tiered per-km charge. */
export function distanceCharge(km) {
  let charge = 0;
  let lowerKm = 0;
  for (const { upToKm, ratePerKm } of PRICING.DISTANCE_TIERS) {
    if (km <= lowerKm) break;
    charge += (Math.min(km, upToKm) - lowerKm) * ratePerKm;
    lowerKm = upToKm;
  }
  return charge;
}

/** Round UP to the next ROUND_UP_TO dollars (cents-normalised first to avoid float noise). */
export function roundUpFare(amount) {
  const step = PRICING.ROUND_UP_TO;
  const cents = Math.round(amount * 100) / 100;
  return Math.ceil(cents / step) * step;
}

/**
 * Price one journey leg.
 *
 * Order: (base + distance) → airport rate → minimum fare → late-night surcharge → round up.
 *
 * @param {object} args
 * @param {number} args.km                   driving distance in km
 * @param {string} [args.time]               pickup time "HH:MM" (drives late-night surcharge)
 * @param {boolean} [args.isAirportTransfer] pickup or drop-off is an airport
 * @returns {{ fare:number, km:number, lateNight:boolean, isAirportTransfer:boolean, minimumApplied:boolean } | null}
 */
export function quoteFare({ km, time = "", isAirportTransfer = false } = {}) {
  if (typeof km !== "number" || !Number.isFinite(km) || km < 0) return null;

  const multiplier = isAirportTransfer ? PRICING.AIRPORT.RATE_MULTIPLIER : 1;
  const minimum = isAirportTransfer ? PRICING.AIRPORT.MIN_FARE : PRICING.MIN_FARE;

  const distanceFare = (PRICING.BASE_FARE + distanceCharge(km)) * multiplier;
  const minimumApplied = distanceFare < minimum;
  let fare = Math.max(distanceFare, minimum);

  const lateNight = isLateNight(time);
  if (lateNight) fare *= 1 + PRICING.LATE_NIGHT.SURCHARGE;

  return { fare: roundUpFare(fare), km, lateNight, isAirportTransfer, minimumApplied };
}

/** Sum of leg fares, or null if any leg has no fare yet. */
export function totalFare(...fares) {
  if (fares.length === 0 || fares.some((f) => typeof f !== "number" || !Number.isFinite(f))) return null;
  return fares.reduce((sum, f) => sum + f, 0);
}

// ---------------------------------------------------------------------------
// Airport detection
// ---------------------------------------------------------------------------

export const AIRPORTS = {
  MEL: {
    code: "MEL",
    name: "Melbourne Airport",
    // Canonical address sent to Distance Matrix for any MEL terminal/precinct address.
    canonicalAddress: "Melbourne Airport (Tullamarine) VIC 3045, Australia",
    location: { lat: -37.6690, lng: 144.8410 }, // terminal precinct
    radiusKm: 2.5,
    // "Melbourne Airport VIC 3045" is the airport's own locality, so it appears in the
    // formatted address of every terminal, hotel and car park inside the precinct.
    // Deliberately NOT matching bare "Tullamarine" (a neighbouring suburb, VIC 3043),
    // "Airport West", "terminal" or "Essendon".
    patterns: [
      /\bmelbourne (international )?airport\b/,
      /\btullamarine airport\b/,
      /\bvic 3045\b/,
    ],
    codePattern: /\(mel\)/i,
  },
  AVV: {
    code: "AVV",
    name: "Avalon Airport",
    canonicalAddress: "Avalon Airport VIC 3212, Australia",
    location: { lat: -38.0394, lng: 144.4694 },
    radiusKm: 2.0,
    // Only "Avalon Airport" — never bare "Avalon" (e.g. Avalon Beach NSW).
    patterns: [/\bavalon airport\b/],
    codePattern: /\(avv\)/i,
  },
};

function normalizeText(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Great-circle distance in km. */
export function haversineKm(a, b) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function isValidLocation(loc) {
  return !!loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng);
}

/**
 * Identify an airport from an address and (optionally) the coordinates of the
 * place selected in Google Places Autocomplete. Coordinates are the most
 * reliable signal; text matching is the fallback (e.g. the quick "airport" chip).
 *
 * @returns {"MEL"|"AVV"|null}
 */
export function detectAirport(address, location = null) {
  if (isValidLocation(location)) {
    for (const airport of Object.values(AIRPORTS)) {
      if (haversineKm(location, airport.location) <= airport.radiusKm) return airport.code;
    }
  }
  if (!address) return null;
  const text = normalizeText(address);
  for (const airport of Object.values(AIRPORTS)) {
    if (airport.codePattern.test(address) || airport.patterns.some((re) => re.test(text))) return airport.code;
  }
  return null;
}

/** Map any airport address to its canonical Distance Matrix address; other addresses pass through. */
export function normalizeAirportAddress(address, location = null) {
  const code = detectAirport(address, location);
  return code ? AIRPORTS[code].canonicalAddress : address;
}

// ---------------------------------------------------------------------------
// Published pricing examples (Pricing section, FAQ)
// ---------------------------------------------------------------------------

// Headline Melbourne Airport prices. These are published marketing figures;
// `referenceKm` is the Google Distance Matrix driving distance to the airport,
// and pricing.test.js checks each figure stays within $10 of the live engine.
export const AIRPORT_FARE_EXAMPLES = [
  { from: "CBD", to: "Melbourne Airport", price: 120, referenceKm: 22.9 },
  { from: "St Kilda", to: "Melbourne Airport", price: 139, referenceKm: 30.1 },
  { from: "South Yarra", to: "Melbourne Airport", price: 137, referenceKm: 33.2 },
  { from: "Toorak", to: "Melbourne Airport", price: 141, referenceKm: 32.0 },
  { from: "Brighton", to: "Melbourne Airport", price: 148, referenceKm: 35.0 },
  { from: "Williamstown", to: "Melbourne Airport", price: 143, referenceKm: 30.2 },
];

// Point-to-point examples are generated by the engine from reference distances
// (Distance Matrix, Melbourne CBD → destination), so they can never drift.
const POINT_TO_POINT_ROUTES = [
  { from: "CBD", to: "St Kilda", referenceKm: 6.7 },
  { from: "CBD", to: "Ringwood", referenceKm: 28.5 },
  { from: "CBD", to: "Frankston", referenceKm: 54.4 },
  { from: "CBD", to: "Mornington", referenceKm: 71.6 },
  { from: "CBD", to: "Geelong", referenceKm: 73.4 },
];

export const POINT_TO_POINT_EXAMPLES = POINT_TO_POINT_ROUTES.map((route) => ({
  ...route,
  price: quoteFare({ km: route.referenceKm }).fare,
}));

export function airportExamplePrice(from) {
  const example = AIRPORT_FARE_EXAMPLES.find((e) => e.from === from);
  if (!example) throw new Error(`No airport fare example for "${from}"`);
  return example.price;
}
