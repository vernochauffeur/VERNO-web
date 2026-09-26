import { describe, it, expect } from "vitest";
import {
  SUBURBS, HOTELS, PLACES, placePath, findPlaceByPath, placeAirportFare, placeHead, buildPlaceSchema,
} from "./places.js";
import { AIRPORT_FARE_EXAMPLES, PRICING } from "../lib/pricing.js";

describe("landing pages", () => {
  it("have unique, URL-safe slugs", () => {
    const slugs = PLACES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("take suburb fares from the pricing engine's airport examples", () => {
    for (const s of SUBURBS) {
      const example = AIRPORT_FARE_EXAMPLES.find((e) => e.from === s.fareFrom);
      expect(example).toBeDefined();
      expect(placeAirportFare(s)).toBe(example.price);
    }
  });

  it("quote hotels from the airport minimum fare, without a distance", () => {
    expect(HOTELS).toHaveLength(9);
    for (const h of HOTELS) {
      expect(placeAirportFare(h)).toBe(PRICING.AIRPORT.MIN_FARE);
      expect(h.intro).not.toMatch(/\bkm\b/);
      expect(h.shortName.length).toBeLessThanOrEqual(16);
    }
  });

  it("resolves page paths, with or without a trailing slash", () => {
    const toorak = SUBURBS.find((s) => s.slug === "toorak");
    expect(placePath(toorak)).toBe("/airport-transfer/toorak");
    expect(findPlaceByPath("/airport-transfer/toorak")).toBe(toorak);
    expect(findPlaceByPath("/airport-transfer/toorak/")).toBe(toorak);
    expect(findPlaceByPath("/airport-transfer/park-hyatt-melbourne").name).toBe("Park Hyatt Melbourne");
    expect(findPlaceByPath("/")).toBeNull();
    expect(findPlaceByPath("/airport-transfer/unknown")).toBeNull();
  });

  it("builds page titles, canonical URLs and offers with the real fare", () => {
    const toorak = SUBURBS.find((s) => s.slug === "toorak");
    const head = placeHead(toorak);
    expect(head.title).toBe("Toorak to Melbourne Airport Chauffeur | Fixed Fare from $141 | VÉRNO");
    expect(head.url).toBe("https://www.vernochauffeur.com.au/airport-transfer/toorak");
    expect(head.description).toContain("60 minutes complimentary waiting");
    expect(buildPlaceSchema(toorak).offers).toMatchObject({ price: 141, priceCurrency: "AUD" });

    const crown = HOTELS.find((h) => h.slug === "crown-towers-melbourne");
    expect(placeHead(crown).title).toBe("Crown Towers Melbourne to Melbourne Airport Chauffeur | From $120 | VÉRNO");
    expect(buildPlaceSchema(crown).areaServed[0]).toMatchObject({ "@type": "Hotel", name: "Crown Towers Melbourne" });
  });
});
