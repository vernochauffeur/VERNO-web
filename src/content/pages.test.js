import { describe, it, expect } from "vitest";
import { PAGES, CORPORATE_PATH, findPageByPath } from "./pages.js";
import { PLACES } from "./places.js";

describe("prerendered pages", () => {
  it("cover every landing page plus /corporate, with unique paths", () => {
    const paths = PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(PAGES).toHaveLength(PLACES.length + 2);
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
