import { describe, it, expect, vi, afterEach } from "vitest";
import { validateEnquiry, normalizeEnquiry, enquiryText, enquiryMailtoUrl, SERVICES } from "./corporate.js";
import handler from "../../api/corporate-enquiry.js";

const VALID = {
  name: "Sam Lee", company: "Acme Pty Ltd", email: "sam@acme.com.au", phone: "0400 000 000", tripsPerMonth: "6–15",
};

describe("corporate enquiry form", () => {
  it("requires name, company, a valid email, a phone and trips per month", () => {
    expect(Object.keys(validateEnquiry({})).sort()).toEqual(["company", "email", "name", "phone", "tripsPerMonth"]);
    expect(validateEnquiry({ ...VALID, email: "sam@acme" }).email).toBeTruthy();
    expect(validateEnquiry(VALID)).toEqual({});
  });

  it("keeps only known fields and choices, trimmed and capped", () => {
    const e = normalizeEnquiry({ ...VALID, name: "  Sam  ", notes: "x".repeat(5000), tripsPerMonth: "1000", services: [SERVICES[0], "Hacked"], extra: 1 });
    expect(e.name).toBe("Sam");
    expect(e.notes).toHaveLength(3000);
    expect(e.tripsPerMonth).toBe("");
    expect(e.services).toEqual([SERVICES[0]]);
    expect(e).not.toHaveProperty("extra");
  });

  it("writes every answer into the email and the mailto fallback", () => {
    const text = enquiryText({ ...VALID, services: [SERVICES[0], SERVICES[2]], notes: "Monthly invoice to finance" });
    expect(text).toContain("Company: Acme Pty Ltd");
    expect(text).toContain("Trips per month: 6–15");
    expect(text).toContain(`Services: ${SERVICES[0]}, ${SERVICES[2]}`);
    expect(text).toContain("Monthly invoice to finance");
    expect(enquiryMailtoUrl(VALID)).toMatch(/^mailto:book@vernochauffeur\.com\.au\?subject=Corporate%20account%20enquiry/);
  });
});

function call(body, method = "POST") {
  const res = { statusCode: 0, body: null, headers: {} };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  return handler({ method, body }, res).then(() => res);
}

describe("api/corporate-enquiry", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("rejects other methods and invalid enquiries", async () => {
    expect((await call(VALID, "GET")).statusCode).toBe(405);
    const res = await call({ ...VALID, email: "" });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.email).toBeTruthy();
  });

  it("returns 503 until RESEND_API_KEY is set, so the form falls back to email", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    expect((await call(VALID)).statusCode).toBe(503);
  });

  it("silently accepts the bot honeypot without sending", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await call({ ...VALID, website: "spam" })).statusCode).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("emails the enquiry through Resend with the visitor as reply-to", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const res = await call(JSON.stringify(VALID));
    expect(res.statusCode).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.Authorization).toBe("Bearer test-key");
    expect(sent.to).toEqual(["book@vernochauffeur.com.au"]);
    expect(sent.reply_to).toBe("sam@acme.com.au");
    expect(sent.subject).toBe("Corporate account enquiry: Acme Pty Ltd");
  });

  it("reports a failed send so the form can fall back", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "bad" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await call(VALID)).statusCode).toBe(502);
  });
});
