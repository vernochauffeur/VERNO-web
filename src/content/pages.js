// Every prerendered page besides the home page: suburb and hotel landing pages
// (places.js), the corporate page, the airport-transfer hub listing them and /faq. Each entry gives the URL path, the props
// the Home component renders with, and the page's head tags and schema.

import { PLACES, SITE_URL, placePath, placeHead, buildPlaceSchema } from "./places.js";
import { PRICING, formatPrice } from "../lib/pricing.js";

export const CORPORATE_PATH = "/corporate";
export const FAQ_PATH = "/faq";

/** Which FAQ list (see faqsFor in faq.js) a page with these Home props shows. */
export function faqSetFor({ place = null, corporate = false, airportHub = false, faqPage = false } = {}) {
  if (faqPage) return "all";
  if (corporate) return "corporate";
  if (place || airportHub) return "airport";
  return "home";
}

function faqHead() {
  return {
    title: "Chauffeur FAQ Melbourne | Fares, Airport Pickups & Bookings | VÉRNO",
    description:
      "Answers about VÉRNO chauffeur fares, Melbourne and Avalon airport pickups, name board meet & greet, " +
      `${PRICING.WAITING.AIRPORT_COMPLIMENTARY_MINUTES} minutes complimentary airport waiting, return trips and corporate accounts.`,
    url: `${SITE_URL}${FAQ_PATH}`,
  };
}
export const AIRPORT_HUB_PATH = "/melbourne-airport-transfers";

function airportHubHead() {
  return {
    title: `Melbourne Airport Transfers by Hotel & Suburb | From ${formatPrice(PRICING.AIRPORT.MIN_FARE)} | VÉRNO`,
    description:
      "Fixed-fare chauffeur transfers between Melbourne Airport and Melbourne's hotels and suburbs in a BMW i5: " +
      `name board meet & greet, live flight tracking and ${PRICING.WAITING.AIRPORT_COMPLIMENTARY_MINUTES} minutes complimentary waiting.`,
    url: `${SITE_URL}${AIRPORT_HUB_PATH}`,
  };
}

function airportHubSchema() {
  const head = airportHubHead();
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Melbourne Airport chauffeur transfers",
    url: head.url,
    itemListElement: PLACES.map((place, i) => ({
      "@type": "ListItem", position: i + 1, name: place.name, url: `${SITE_URL}${placePath(place)}`,
    })),
  };
}

function corporateHead() {
  return {
    title: "Corporate Chauffeur Melbourne | Accounts & Weekly Invoicing | VÉRNO",
    description:
      "Corporate chauffeur accounts in Melbourne: weekly tax invoices, no card needed at booking, airport meet & greet " +
      `with a name board, ${PRICING.WAITING.AIRPORT_COMPLIMENTARY_MINUTES} minutes complimentary waiting and an electric BMW i5 fleet.`,
    url: `${SITE_URL}${CORPORATE_PATH}`,
  };
}

function corporateSchema() {
  const head = corporateHead();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Corporate chauffeur accounts",
    serviceType: "Corporate Chauffeur",
    url: head.url,
    description: head.description,
    provider: { "@type": "LocalBusiness", name: "VÉRNO Chauffeur", url: SITE_URL, telephone: "+61421238894" },
    areaServed: { "@type": "City", name: "Melbourne" },
  };
}

export const PAGES = [
  ...PLACES.map((place) => ({
    path: placePath(place), props: { place }, head: placeHead(place), schema: buildPlaceSchema(place),
  })),
  { path: CORPORATE_PATH, props: { corporate: true }, head: corporateHead(), schema: corporateSchema() },
  { path: AIRPORT_HUB_PATH, props: { airportHub: true }, head: airportHubHead(), schema: airportHubSchema() },
  // FAQPage data for /faq comes from the per-page FAQ schema, like every page.
  { path: FAQ_PATH, props: { faqPage: true }, head: faqHead(), schema: null },
];

/** The page at `pathname`, or null (home page, unknown paths). */
export function findPageByPath(pathname) {
  const path = (pathname || "").replace(/\/+$/, "");
  return PAGES.find((p) => p.path === path) || null;
}
