// Guards that published copy stays in sync with the pricing engine.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { FAQS, buildFaqSchema } from "./faq.js";
import { PRICING, WAITING_POLICY, formatPrice } from "../lib/pricing.js";

const root = join(import.meta.dirname, "..", "..");
const indexHtml = readFileSync(join(root, "index.html"), "utf8");

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(jsx?|css)$/.test(name) && !/\.test\.js$/.test(name) ? [path] : [];
  });
}

describe("FAQ", () => {
  const text = FAQS.map((f) => `${f.q} ${f.a}`).join("\n");

  it("quotes the current starting fare and airport examples", () => {
    expect(text).toContain(`Private chauffeur fares start from ${formatPrice(PRICING.MIN_FARE)}`);
    expect(text).toContain("CBD from $120, St Kilda from $139 and Brighton from $148");
  });

  it("states the waiting policy", () => {
    expect(FAQS.find((f) => f.q === "Do you charge a waiting fee?").a).toBe(WAITING_POLICY);
  });

  it("produces valid FAQPage structured data covering every question", () => {
    const schema = JSON.parse(JSON.stringify(buildFaqSchema()));
    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity.map((q) => q.name)).toEqual(FAQS.map((f) => f.q));
    expect(schema.mainEntity.map((q) => q.acceptedAnswer.text)).toEqual(FAQS.map((f) => f.a));
  });
});

describe("index.html", () => {
  it("gets its FAQ structured data from src/content/faq.js", () => {
    expect(indexHtml).toContain("<!-- FAQ_SCHEMA -->");
    expect(indexHtml).not.toContain('"@type": "FAQPage"');
  });

  it("advertises a price range that matches the minimum fare", () => {
    expect(indexHtml).toContain(`"priceRange": "${formatPrice(PRICING.MIN_FARE)}+"`);
  });

  it("no longer loads the unused QR-code script", () => {
    expect(indexHtml).not.toMatch(/qrcode/i);
  });
});

describe("no stale pricing anywhere", () => {
  const files = [...sourceFiles(join(root, "src")), join(root, "index.html")];
  const all = files.map((f) => [f, readFileSync(f, "utf8")]);

  it.each([
    ["15% discount", /15\s*%\s*off/i],
    ["discount model", /DISCOUNT/],
    ["struck-through prices", /fare-original|line-through/],
    ["old $90 pricing", /\$90\b/],
    ["old $115/$133 airport prices", /\$(115|133)\b/],
    ["return fare assumed equal to outbound", /fare\s*\*\s*2/],
  ])("%s", (_, pattern) => {
    for (const [file, content] of all) expect(content, file).not.toMatch(pattern);
  });
});

describe("Google reviews", async () => {
  const { REVIEWS, GOOGLE_RATING, GOOGLE_REVIEWS_URL } = await import("./reviews.js");
  it("only shows five-star-scale reviews with text, and a rating that matches", () => {
    expect(REVIEWS.length).toBeGreaterThan(0);
    for (const r of REVIEWS) {
      expect(r.stars).toBeGreaterThanOrEqual(1);
      expect(r.stars).toBeLessThanOrEqual(5);
      expect(r.text.trim().length).toBeGreaterThan(0);
      expect(r.name).toMatch(/^\S+ \S\.$/); // first name + initial
    }
    expect(GOOGLE_RATING.count).toBeGreaterThanOrEqual(REVIEWS.length);
    expect(GOOGLE_REVIEWS_URL).toMatch(/^https:\/\/maps\.app\.goo\.gl\//);
  });
});
