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

  // Flat fee per leg whose pickup or destination is a configured major venue
  // (see MAJOR_VENUES). Added after the minimum fare, surcharge and rounding.
  MAJOR_VENUE_FEE: 20,

  // Waiting time (not added automatically — charged only if it occurs).
  // Airport pickups count from the flight's actual landing time.
  WAITING: { COMPLIMENTARY_MINUTES: 15, AIRPORT_COMPLIMENTARY_MINUTES: 60, RATE_PER_MINUTE: 1.25 },
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
  `Airport pickups include ${PRICING.WAITING.AIRPORT_COMPLIMENTARY_MINUTES} minutes complimentary waiting from your flight's actual landing time. ` +
  `Standard pickups include ${PRICING.WAITING.COMPLIMENTARY_MINUTES} minutes. ` +
  `Additional waiting time is charged at ${formatPrice(PRICING.WAITING.RATE_PER_MINUTE)} per minute. ` +
  "Flights are tracked live, so delays never reduce your complimentary waiting time.";

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
 * Order: (base + distance) → airport rate → minimum fare → late-night surcharge → round up
 *        → + flat major venue fee (once per leg).
 *
 * @param {object} args
 * @param {number} args.km                   driving distance in km
 * @param {string} [args.time]               pickup time "HH:MM" (drives late-night surcharge)
 * @param {boolean} [args.isAirportTransfer] pickup or drop-off is an airport
 * @param {boolean} [args.atMajorVenue]      pickup or drop-off is a configured major venue
 * @returns {{ fare:number, km:number, lateNight:boolean, isAirportTransfer:boolean, minimumApplied:boolean, venueFee:number } | null}
 */
export function quoteFare({ km, time = "", isAirportTransfer = false, atMajorVenue = false } = {}) {
  if (typeof km !== "number" || !Number.isFinite(km) || km < 0) return null;

  const multiplier = isAirportTransfer ? PRICING.AIRPORT.RATE_MULTIPLIER : 1;
  const minimum = isAirportTransfer ? PRICING.AIRPORT.MIN_FARE : PRICING.MIN_FARE;

  const distanceFare = (PRICING.BASE_FARE + distanceCharge(km)) * multiplier;
  const minimumApplied = distanceFare < minimum;
  let fare = Math.max(distanceFare, minimum);

  const lateNight = isLateNight(time);
  if (lateNight) fare *= 1 + PRICING.LATE_NIGHT.SURCHARGE;

  const venueFee = atMajorVenue ? PRICING.MAJOR_VENUE_FEE : 0;
  return { fare: roundUpFare(fare) + venueFee, km, lateNight, isAirportTransfer, minimumApplied, venueFee };
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
// Service area (regional bookings)
// ---------------------------------------------------------------------------

// Automatic fares are only offered when both ends of a journey are inside this
// straight-line radius (measured from the Places coordinates of each address).
// Beyond it the chauffeur has to position from Melbourne, so a passenger-distance
// fare would underprice the job — those bookings are quoted manually instead.
// Airports (Melbourne and Avalon) always count as inside the service area.
export const SERVICE_AREA = {
  name: "Melbourne",
  center: { lat: -37.8136, lng: 144.9631 }, // Melbourne CBD
  radiusKm: 50,
};

export const REGIONAL_QUOTE_LABEL = "Regional Transfer — Quote Required";
export const REGIONAL_QUOTE_NOTE =
  "Regional bookings may include additional chauffeur positioning time and distance. We’ll confirm a fixed price when your booking is reviewed.";

export function isWithinServiceArea(location) {
  return isValidLocation(location) && haversineKm(location, SERVICE_AREA.center) <= SERVICE_AREA.radiusKm;
}

/** Coordinates for an address: the Places result, or the airport's own coordinates. */
export function resolveLocation(address, location = null) {
  if (isValidLocation(location)) return location;
  const code = detectAirport(address);
  return code ? AIRPORTS[code].location : null;
}

// ---------------------------------------------------------------------------
// Major venues (flat venue fee)
// ---------------------------------------------------------------------------

// EDIT HERE to add or remove venues. A leg whose pickup or destination is within
// `radiusKm` of a venue's Google Places coordinates pays PRICING.MAJOR_VENUE_FEE
// once. Radii are kept tight so neighbouring places are not charged (e.g. AAMI
// Park, Southern Cross, Caulfield station) and so the Melbourne Park arenas
// (Rod Laver / Margaret Court, 100 m apart) never overlap each other.
export const MAJOR_VENUES = [
  { name: "John Cain Arena", location: { lat: -37.82277, lng: 144.98197 }, radiusKm: 0.15 },
  { name: "Rod Laver Arena", location: { lat: -37.82162, lng: 144.97856 }, radiusKm: 0.08 },
  { name: "Margaret Court Arena", location: { lat: -37.82113, lng: 144.97764 }, radiusKm: 0.06 },
  { name: "MCG", location: { lat: -37.81997, lng: 144.98345 }, radiusKm: 0.25 },
  { name: "Marvel Stadium", location: { lat: -37.81650, lng: 144.94760 }, radiusKm: 0.2 },
  { name: "Flemington Racecourse", location: { lat: -37.79097, lng: 144.91189 }, radiusKm: 0.6 },
  { name: "Caulfield Racecourse", location: { lat: -37.87759, lng: 145.03841 }, radiusKm: 0.3 },
];

/** The configured major venue at `location`, or null. */
export function findMajorVenue(location, venues = MAJOR_VENUES) {
  if (!isValidLocation(location)) return null;
  return venues.find((venue) => haversineKm(location, venue.location) <= venue.radiusKm) || null;
}

function listNames(names) {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
}

export const MAJOR_VENUE_FEE_NOTE =
  `A ${formatPrice(PRICING.MAJOR_VENUE_FEE)} major venue fee applies per trip to or from ${listNames(MAJOR_VENUES.map((v) => v.name))}.`;

// ---------------------------------------------------------------------------
// Major events
// ---------------------------------------------------------------------------

// EDIT HERE to add or update events. A booking is flagged (never surcharged
// automatically) when its date falls within [start, end] AND its pickup or
// destination is within `radiusKm` of the venue. Dates are Melbourne local
// dates, "YYYY-MM-DD", inclusive. Verify dates against the official source.
const MCG = { name: "MCG", location: { lat: -37.8200, lng: 144.9834 }, radiusKm: 1.5 };
const MELBOURNE_PARK = { name: "Melbourne Park", location: { lat: -37.8216, lng: 144.9786 }, radiusKm: 1.5 };

export const MAJOR_EVENTS = [
  // afl.com.au / mcg.org.au: Sat 26 September 2026, MCG
  { name: "AFL Grand Final", start: "2026-09-26", end: "2026-09-26", venue: MCG },
  // mcg.org.au: Australia v New Zealand, 26–30 December 2026
  { name: "Boxing Day Test", start: "2026-12-26", end: "2026-12-30", venue: MCG },
  // ausopen.com: AO 2027 runs 11–31 January; finals weekend 30–31 January 2027
  { name: "Australian Open Finals", start: "2027-01-30", end: "2027-01-31", venue: MELBOURNE_PARK },
];

export const EVENT_FARE_LABEL = "Event Day — Final Fare to Be Confirmed";
export const EVENT_FARE_NOTE =
  "Major-event pricing may apply. Your final fixed fare will be confirmed before the booking is accepted.";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The first configured event on `date` whose venue is near any of `locations`, or null. */
export function findMajorEvent(date, locations = [], events = MAJOR_EVENTS) {
  if (typeof date !== "string" || !ISO_DATE.test(date)) return null;
  const points = locations.filter(isValidLocation);
  return events.find((event) =>
    date >= event.start && date <= event.end &&
    points.some((point) => haversineKm(point, event.venue.location) <= event.venue.radiusKm)
  ) || null;
}

/**
 * Everything the calculator needs to know about one journey leg before pricing it.
 *
 * - located:  both ends have coordinates (a Places selection, or a recognised airport)
 * - regional: an end is outside the service area → quote required, no automatic fare
 * - event:    a configured major event on this date near either end → fare shown as a guide
 * - majorVenue: the configured major venue at either end (flat venue fee, once per leg)
 */
export function assessJourney({ from, to, fromLocation = null, toLocation = null, date = "" } = {}) {
  const fromAirport = detectAirport(from, fromLocation);
  const toAirport = detectAirport(to, toLocation);
  const fromPoint = resolveLocation(from, fromLocation);
  const toPoint = resolveLocation(to, toLocation);
  const located = !!fromPoint && !!toPoint;
  const outside = (airport, point) => !airport && !isWithinServiceArea(point);
  return {
    fromAirport,
    toAirport,
    isAirportTransfer: !!(fromAirport || toAirport),
    located,
    regional: located && (outside(fromAirport, fromPoint) || outside(toAirport, toPoint)),
    event: located ? findMajorEvent(date, [fromPoint, toPoint]) : null,
    majorVenue: located ? findMajorVenue(fromPoint) || findMajorVenue(toPoint) : null,
  };
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
  { from: "South Yarra", to: "Melbourne Airport", price: 140, referenceKm: 33.2 },
  { from: "Toorak", to: "Melbourne Airport", price: 141, referenceKm: 32.0 },
  { from: "Brighton", to: "Melbourne Airport", price: 148, referenceKm: 35.0 },
  { from: "Williamstown", to: "Melbourne Airport", price: 143, referenceKm: 30.2 },
];

// Point-to-point examples are generated by the engine from reference distances
// (Distance Matrix, Melbourne CBD → destination), so they can never drift.
// Destinations must be inside the service area (checked in pricing.test.js).
const POINT_TO_POINT_ROUTES = [
  { from: "CBD", to: "St Kilda", referenceKm: 6.7, location: { lat: -37.8640, lng: 144.9820 } },
  { from: "CBD", to: "Ringwood", referenceKm: 28.5, location: { lat: -37.8146, lng: 145.2310 } },
  { from: "CBD", to: "Dandenong", referenceKm: 34.8, location: { lat: -37.9848, lng: 145.2140 } },
  { from: "CBD", to: "Frankston", referenceKm: 54.4, location: { lat: -38.1466, lng: 145.1357 } },
  { from: "CBD", to: "Mornington", referenceKm: 71.6, location: { lat: -38.2288, lng: 145.0600 } },
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
