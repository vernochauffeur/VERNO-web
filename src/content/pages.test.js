import { describe, it, expect } from "vitest";
import { PAGES, CORPORATE_PATH, findPageByPath } from "./pages.js";
import { PLACES } from "./places.js";

describe("prerendered pages", () => {
  it("cover every landing page plus /corporate, with unique paths", () => {
    const paths = PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(PAGES).toHaveLength(PLACES.length + 3);
    for (const p of PAGES) {
      expect(p.path).toMatch(/^\/[a-z0-9/-]+$/);
      expect(p.head.url).toBe(`https://www.vernochauffeur.com.au${p.path}`);
      expect(p.head.title).toMatch(/VÉRNO$/);
    }
  });

  it("finds the corporate page and passes its props", () => {
    const page = findPageByPath(`${CORPORATE_PATH}/`);
    expect(page.props).toEqual({ corporate: true });
    expect(page.head.description).toContain("weekly tax invoices");
    expect(findPageByPath("/")).toBeNull();
  });
});

describe("per-page FAQ lists", async () => {
  const { faqSetFor, FAQ_PATH } = await import("./pages.js");
  const { faqsFor, FAQS } = await import("./faq.js");
  it("gives each page type its own short list, and /faq every question", () => {
    expect(faqSetFor({})).toBe("home");
    expect(faqSetFor({ place: PLACES[0] })).toBe("airport");
    expect(faqSetFor({ airportHub: true })).toBe("airport");
    expect(faqSetFor({ corporate: true })).toBe("corporate");
    expect(faqSetFor({ faqPage: true })).toBe("all");
    for (const set of ["home", "airport", "corporate"]) {
      expect(faqsFor(set).length).toBeGreaterThanOrEqual(3);
      expect(faqsFor(set).length).toBeLessThan(FAQS.length);
    }
    expect(faqsFor("all")).toBe(FAQS);
    expect(findPageByPath(FAQ_PATH).props).toEqual({ faqPage: true });
  });
});
