// Airport-transfer landing pages (/airport-transfer/<slug>) for suburbs and hotels.
//
// Fares are never written here. Suburb pages read their price from the matching
// AIRPORT_FARE_EXAMPLES entry in src/lib/pricing.js (Distance Matrix reference
// distances); to add a suburb, first add its airport example (with referenceKm)
// there. Hotel pages quote the airport minimum fare as a "from" price, so they
// need no distance and never show one.

import { AIRPORT_FARE_EXAMPLES, PRICING, LATE_NIGHT_WINDOW, formatPrice } from "../lib/pricing.js";

export const SITE_URL = "https://www.vernochauffeur.com.au";

export const SUBURBS = [
  {
    kind: "suburb",
    slug: "melbourne-cbd",
    name: "Melbourne CBD",
    fareFrom: "CBD",
    intro:
      "From Collins Street offices to Southbank hotels and Docklands apartments, your chauffeur collects you at the door " +
      "and takes the freeway straight to Tullamarine — about 23 km, at a fare fixed before you travel.",
  },
  {
    kind: "suburb",
    slug: "st-kilda",
    name: "St Kilda",
    fareFrom: "St Kilda",
    intro:
      "Whether you are leaving from Fitzroy Street, Acland Street or a foreshore apartment, we collect you at the door " +
      "for the roughly 30 km run to Melbourne Airport, at a fare fixed before you travel.",
  },
  {
    kind: "suburb",
    slug: "south-yarra",
    name: "South Yarra",
    fareFrom: "South Yarra",
    intro:
      "From Chapel Street and Toorak Road to the apartments along the Yarra, we collect you at the door " +
      "for the roughly 33 km trip to Melbourne Airport, at a fare fixed before you travel.",
  },
  {
    kind: "suburb",
    slug: "toorak",
    name: "Toorak",
    fareFrom: "Toorak",
    intro:
      "From Toorak Village and St Georges Road to the quiet residential streets around them, we collect you at the door " +
      "for the roughly 32 km trip to Melbourne Airport, at a fare fixed before you travel.",
  },
  {
    kind: "suburb",
    slug: "brighton",
    name: "Brighton",
    fareFrom: "Brighton",
    intro:
      "From Church Street, Middle Brighton and the Esplanade, we collect you at the door " +
      "for the roughly 35 km trip to Melbourne Airport, at a fare fixed before you travel.",
  },
  {
    kind: "suburb",
    slug: "williamstown",
    name: "Williamstown",
    fareFrom: "Williamstown",
    intro:
      "From Nelson Place, The Strand and the streets around the waterfront, we collect you at the door " +
      "for the roughly 30 km trip to Melbourne Airport, at a fare fixed before you travel.",
  },
];

// shortName keeps the hero headline ("Park Hyatt, privately.") to hotel-card length.
const hotel = (slug, name, shortName, area) => ({
  kind: "hotel", slug, name, shortName,
  intro:
    `From the front entrance of ${name} ${area}, your chauffeur collects you and your luggage ` +
    "for the trip to Melbourne Airport, at a fare confirmed before you travel.",
});

export const HOTELS = [
  hotel("crown-towers-melbourne", "Crown Towers Melbourne", "Crown Towers", "in Southbank"),
  hotel("park-hyatt-melbourne", "Park Hyatt Melbourne", "Park Hyatt", "near St Patrick's Cathedral"),
  hotel("w-melbourne", "W Melbourne", "W Melbourne", "on Flinders Lane"),
  hotel("grand-hyatt-melbourne", "Grand Hyatt Melbourne", "Grand Hyatt", "on Collins Street"),
  hotel("ritz-carlton-melbourne", "The Ritz-Carlton, Melbourne", "The Ritz-Carlton", "on Lonsdale Street"),
  hotel("langham-melbourne", "The Langham, Melbourne", "The Langham", "on Southbank"),
  hotel("sofitel-melbourne-on-collins", "Sofitel Melbourne on Collins", "Sofitel", "on Collins Street"),
  hotel("intercontinental-melbourne-the-rialto", "InterContinental Melbourne The Rialto", "The Rialto", "on Collins Street"),
  hotel("1-hotel-melbourne", "1 Hotel Melbourne", "1 Hotel", "on the Yarra River"),
];

export const PLACES = [...SUBURBS, ...HOTELS];

export function placePath(place) {
  return `/airport-transfer/${place.slug}`;
}

/** The place whose page lives at `pathname`, or null (home page, unknown paths). */
export function findPlaceByPath(pathname) {
  const path = (pathname || "").replace(/\/+$/, "");
  return PLACES.find((p) => placePath(p) === path) || null;
}

/**
 * "From" airport fare for the page: a suburb's published airport example, or the
 * airport minimum fare for a hotel (CBD hotels start at the minimum).
 */
export function placeAirportFare(place) {
  if (place.kind === "hotel") return PRICING.AIRPORT.MIN_FARE;
  const example = AIRPORT_FARE_EXAMPLES.find((e) => e.from === place.fareFrom);
  if (!example) throw new Error(`No airport fare example for "${place.fareFrom}"`);
  return example.price;
}

export function placeHead(place) {
  const fare = formatPrice(placeAirportFare(place));
  const wait = PRICING.WAITING.AIRPORT_COMPLIMENTARY_MINUTES;
  return {
    title: `${place.name} to Melbourne Airport Chauffeur | ${place.kind === "hotel" ? "From" : "Fixed Fare from"} ${fare} | VÉRNO`,
    description:
      `Private BMW i5 chauffeur between ${place.name} and Melbourne Airport (Tullamarine). ` +
      `Fixed fare from ${fare}, live flight tracking and ${wait} minutes complimentary waiting on airport pickups. Book direct.`,
    url: `${SITE_URL}${placePath(place)}`,
  };
}

/** Schema.org Service + Offer for a landing page. */
export function buildPlaceSchema(place) {
  const head = placeHead(place);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${place.name} to Melbourne Airport chauffeur transfer`,
    serviceType: "Airport Transfer",
    url: head.url,
    description: head.description,
    provider: { "@type": "LocalBusiness", name: "VÉRNO Chauffeur", url: SITE_URL, telephone: "+61421238894" },
    areaServed: [
      place.kind === "hotel"
        ? { "@type": "Hotel", name: place.name, address: { "@type": "PostalAddress", addressLocality: "Melbourne", addressRegion: "VIC", addressCountry: "AU" } }
        : { "@type": "Place", name: `${place.name}, VIC` },
      { "@type": "Airport", name: "Melbourne Airport", iataCode: "MEL" },
    ],
    offers: {
      "@type": "Offer",
      price: placeAirportFare(place),
      priceCurrency: "AUD",
      description: `Fixed fare from; late-night surcharge applies to pickups ${LATE_NIGHT_WINDOW}.`,
    },
  };
}
