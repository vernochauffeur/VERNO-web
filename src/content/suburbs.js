// Suburb airport-transfer landing pages (/airport-transfer/<slug>).
//
// Fares are never written here: each page reads its price from the matching
// AIRPORT_FARE_EXAMPLES entry in src/lib/pricing.js (Distance Matrix reference
// distances), so a pricing change updates every page automatically.
// To add a suburb, first add its airport example (with referenceKm) there.

import { AIRPORT_FARE_EXAMPLES, PRICING, LATE_NIGHT_WINDOW, formatPrice } from "../lib/pricing.js";

export const SITE_URL = "https://www.vernochauffeur.com.au";

export const SUBURBS = [
  {
    slug: "melbourne-cbd",
    name: "Melbourne CBD",
    fareFrom: "CBD",
    intro:
      "From Collins Street offices to Southbank hotels and Docklands apartments, your chauffeur collects you at the door " +
      "and takes the freeway straight to Tullamarine — about 23 km, at a fare fixed before you travel.",
  },
  {
    slug: "st-kilda",
    name: "St Kilda",
    fareFrom: "St Kilda",
    intro:
      "Whether you are leaving from Fitzroy Street, Acland Street or a foreshore apartment, we collect you at the door " +
      "for the roughly 30 km run to Melbourne Airport, at a fare fixed before you travel.",
  },
  {
    slug: "south-yarra",
    name: "South Yarra",
    fareFrom: "South Yarra",
    intro:
      "From Chapel Street and Toorak Road to the apartments along the Yarra, we collect you at the door " +
      "for the roughly 33 km trip to Melbourne Airport, at a fare fixed before you travel.",
  },
  {
    slug: "toorak",
    name: "Toorak",
    fareFrom: "Toorak",
    intro:
      "From Toorak Village and St Georges Road to the quiet residential streets around them, we collect you at the door " +
      "for the roughly 32 km trip to Melbourne Airport, at a fare fixed before you travel.",
  },
  {
    slug: "brighton",
    name: "Brighton",
    fareFrom: "Brighton",
    intro:
      "From Church Street, Middle Brighton and the Esplanade, we collect you at the door " +
      "for the roughly 35 km trip to Melbourne Airport, at a fare fixed before you travel.",
  },
  {
    slug: "williamstown",
    name: "Williamstown",
    fareFrom: "Williamstown",
    intro:
      "From Nelson Place, The Strand and the streets around the waterfront, we collect you at the door " +
      "for the roughly 30 km trip to Melbourne Airport, at a fare fixed before you travel.",
  },
];

export function suburbPath(suburb) {
  return `/airport-transfer/${suburb.slug}`;
}

/** The suburb whose page lives at `pathname`, or null (home page, unknown paths). */
export function findSuburbByPath(pathname) {
  const path = (pathname || "").replace(/\/+$/, "");
  return SUBURBS.find((s) => suburbPath(s) === path) || null;
}

/** Fixed airport fare for the suburb, from the pricing engine's reference examples. */
export function suburbAirportFare(suburb) {
  const example = AIRPORT_FARE_EXAMPLES.find((e) => e.from === suburb.fareFrom);
  if (!example) throw new Error(`No airport fare example for "${suburb.fareFrom}"`);
  return example.price;
}

export function suburbHead(suburb) {
  const fare = formatPrice(suburbAirportFare(suburb));
  const wait = PRICING.WAITING.AIRPORT_COMPLIMENTARY_MINUTES;
  return {
    title: `${suburb.name} to Melbourne Airport Chauffeur | Fixed Fare from ${fare} | VÉRNO`,
    description:
      `Private BMW i5 chauffeur between ${suburb.name} and Melbourne Airport (Tullamarine). ` +
      `Fixed fare from ${fare}, live flight tracking and ${wait} minutes complimentary waiting on airport pickups. Book direct.`,
    url: `${SITE_URL}${suburbPath(suburb)}`,
  };
}

/** Schema.org Service + Offer for a suburb page. */
export function buildSuburbSchema(suburb) {
  const head = suburbHead(suburb);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${suburb.name} to Melbourne Airport chauffeur transfer`,
    serviceType: "Airport Transfer",
    url: head.url,
    description: head.description,
    provider: { "@type": "LocalBusiness", name: "VÉRNO Chauffeur", url: SITE_URL, telephone: "+61421238894" },
    areaServed: [
      { "@type": "Place", name: `${suburb.name}, VIC` },
      { "@type": "Airport", name: "Melbourne Airport", iataCode: "MEL" },
    ],
    offers: {
      "@type": "Offer",
      price: suburbAirportFare(suburb),
      priceCurrency: "AUD",
      description: `Fixed fare from; late-night surcharge applies to pickups ${LATE_NIGHT_WINDOW}.`,
    },
  };
}
