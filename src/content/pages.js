// Every prerendered page besides the home page: suburb and hotel landing pages
// (places.js), the corporate, racing and Australian Open pages, the airport-transfer hub listing them and /faq. Each entry gives the URL path, the props
// the Home component renders with, and the page's head tags and schema.

import { PLACES, SITE_URL, placePath, placeHead, buildPlaceSchema } from "./places.js";
import { PRICING, formatPrice } from "../lib/pricing.js";

export const CORPORATE_PATH = "/corporate";
export const FAQ_PATH = "/faq";
export const RACING_PATH = "/spring-racing-carnival-chauffeur";
export const AUSOPEN_PATH = "/australian-open-chauffeur";

/** Which FAQ list (see faqsFor in faq.js) a page with these Home props shows. */
export function faqSetFor({ place = null, corporate = false, racing = false, ausOpen = false, airportHub = false, faqPage = false } = {}) {
  if (faqPage) return "all";
  if (corporate) return "corporate";
  if (racing) return "racing";
  if (ausOpen) return "ausOpen";
  if (place || airportHub) return "airport";
  return "home";
}

function faqHead() {
  return {
    title: "Chauffeur FAQ Melbourne | Fares, Airport Pickups & Bookings | VÉRNO",
    description:
      "Answers on VÉRNO chauffeur fares, Melbourne and Avalon airport pickups, " +
      `${PRICING.WAITING.AIRPORT_COMPLIMENTARY_MINUTES} minutes complimentary waiting, return trips and corporate accounts.`,
    url: `${SITE_URL}${FAQ_PATH}`,
  };
}
export const AIRPORT_HUB_PATH = "/melbourne-airport-transfers";

/** Hero background (public/images/<name>.jpg + .webp) for a page with these Home props. */
export function heroImageFor({ place = null, corporate = false, racing = false, ausOpen = false, airportHub = false, faqPage = false } = {}) {
  if (corporate) return "svc-corporate";
  if (racing) return "svc-events";
  if (ausOpen) return "journey-4";
  if (place || airportHub) return "journey-1";
  if (faqPage) return "journey-2";
  return "hero-bg";
}

/** The nav link path for the page with these Home props, or null (home, landing pages). */
export function navPathFor({ corporate = false, racing = false, ausOpen = false, airportHub = false, faqPage = false } = {}) {
  if (corporate) return CORPORATE_PATH;
  if (racing) return RACING_PATH;
  if (ausOpen) return AUSOPEN_PATH;
  if (airportHub) return AIRPORT_HUB_PATH;
  if (faqPage) return FAQ_PATH;
  return null;
}

function airportHubHead() {
  return {
    title: `Melbourne Airport Transfers by Hotel & Suburb | From ${formatPrice(PRICING.AIRPORT.MIN_FARE)} | VÉRNO`,
    description:
      "Fixed-fare BMW i5 transfers between Melbourne Airport and the city's hotels and suburbs, " +
      `with name board meet & greet and ${PRICING.WAITING.AIRPORT_COMPLIMENTARY_MINUTES} minutes complimentary waiting.`,
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
      "Corporate chauffeur accounts in Melbourne: weekly tax invoices, no card at booking, " +
      "airport meet & greet with a name board and an electric BMW i5 fleet.",
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

function racingHead() {
  return {
    title: "Melbourne Cup & Spring Racing Chauffeur | VÉRNO",
    description:
      "BMW i5 chauffeur for the Melbourne Cup and Spring Racing Carnival: drop-off and pick-up at Flemington " +
      "and Caulfield, return trips and full-day hire.",
    url: `${SITE_URL}${RACING_PATH}`,
  };
}

function racingSchema() {
  const head = racingHead();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Melbourne Cup & Spring Racing Carnival chauffeur",
    serviceType: "Event Chauffeur",
    url: head.url,
    description: head.description,
    provider: { "@type": "LocalBusiness", name: "VÉRNO Chauffeur", url: SITE_URL, telephone: "+61421238894" },
    areaServed: { "@type": "City", name: "Melbourne" },
  };
}

function ausOpenHead() {
  return {
    title: "Australian Open Chauffeur Melbourne | Melbourne Park | VÉRNO",
    description:
      "BMW i5 chauffeur for the Australian Open: drop-off and pick-up at Melbourne Park, " +
      "return trips after night sessions and full-day hire.",
    url: `${SITE_URL}${AUSOPEN_PATH}`,
  };
}

function ausOpenSchema() {
  const head = ausOpenHead();
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Australian Open chauffeur",
    serviceType: "Event Chauffeur",
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
  { path: RACING_PATH, props: { racing: true }, head: racingHead(), schema: racingSchema() },
  { path: AUSOPEN_PATH, props: { ausOpen: true }, head: ausOpenHead(), schema: ausOpenSchema() },
  { path: AIRPORT_HUB_PATH, props: { airportHub: true }, head: airportHubHead(), schema: airportHubSchema() },
  // FAQPage data for /faq comes from the per-page FAQ schema, like every page.
  { path: FAQ_PATH, props: { faqPage: true }, head: faqHead(), schema: null },
];

/** The page at `pathname`, or null (home page, unknown paths). */
export function findPageByPath(pathname) {
  const path = (pathname || "").replace(/\/+$/, "");
  return PAGES.find((p) => p.path === path) || null;
}
