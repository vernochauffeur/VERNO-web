import { describe, it, expect } from "vitest";
import {
  SUBURBS, suburbPath, findSuburbByPath, suburbAirportFare, suburbHead, buildSuburbSchema,
} from "./suburbs.js";
import { AIRPORT_FARE_EXAMPLES } from "../lib/pricing.js";

describe("suburb pages", () => {
  it("have unique, URL-safe slugs", () => {
    const slugs = SUBURBS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("take every fare from the pricing engine's airport examples", () => {
    for (const s of SUBURBS) {
      const example = AIRPORT_FARE_EXAMPLES.find((e) => e.from === s.fareFrom);
      expect(example).toBeDefined();
      expect(suburbAirportFare(s)).toBe(example.price);
    }
  });

  it("resolves page paths, with or without a trailing slash", () => {
    const toorak = SUBURBS.find((s) => s.slug === "toorak");
    expect(suburbPath(toorak)).toBe("/airport-transfer/toorak");
    expect(findSuburbByPath("/airport-transfer/toorak")).toBe(toorak);
    expect(findSuburbByPath("/airport-transfer/toorak/")).toBe(toorak);
    expect(findSuburbByPath("/")).toBeNull();
    expect(findSuburbByPath("/airport-transfer/unknown")).toBeNull();
  });

  it("builds page titles, canonical URLs and offers with the real fare", () => {
    const toorak = SUBURBS.find((s) => s.slug === "toorak");
    const head = suburbHead(toorak);
    expect(head.title).toBe("Toorak to Melbourne Airport Chauffeur | Fixed Fare from $141 | VÉRNO");
    expect(head.url).toBe("https://www.vernochauffeur.com.au/airport-transfer/toorak");
    expect(head.description).toContain("60 minutes complimentary waiting");
    expect(buildSuburbSchema(toorak).offers).toMatchObject({ price: 141, priceCurrency: "AUD" });
  });
});
