// Corporate account enquiry: the form's questions, validation and the email
// text. Shared by the form on /corporate (Home.jsx) and the serverless
// function that emails it (api/corporate-enquiry.js).

import { VERNO_EMAIL } from "./booking.js";

export const TRIPS_PER_MONTH = ["1–5", "6–15", "16–30", "30+"];
export const COMPANY_SIZES = ["1–10", "11–50", "51–200", "200+"];
export const SERVICES = [
  "Airport transfers",
  "Meetings & client visits",
  "Roadshows & conferences",
  "Events & functions",
  "Guest & VIP transfers",
  "Hourly or full-day hire",
];
export const BOOKERS = ["Travellers themselves", "Executive assistant or office manager", "Travel or admin team"];
export const START_OPTIONS = ["As soon as possible", "Within a month", "Just comparing options"];
export const SOURCES = ["Google search", "Email from VÉRNO", "Referral", "LinkedIn", "Other"];

const TEXT_FIELDS = { name: 120, jobTitle: 120, email: 200, phone: 40, company: 160, abn: 20, routes: 500, notes: 3000 };
const CHOICE_FIELDS = {
  tripsPerMonth: TRIPS_PER_MONTH, companySize: COMPANY_SIZES, bookers: BOOKERS, start: START_OPTIONS, source: SOURCES,
};

export const EMPTY_ENQUIRY = {
  ...Object.fromEntries(Object.keys(TEXT_FIELDS).map((k) => [k, ""])),
  ...Object.fromEntries(Object.keys(CHOICE_FIELDS).map((k) => [k, ""])),
  services: [],
};

/** Only the known fields, trimmed and length-capped; unknown choices are dropped. */
export function normalizeEnquiry(input = {}) {
  const out = { ...EMPTY_ENQUIRY, services: [] };
  for (const [key, max] of Object.entries(TEXT_FIELDS)) {
    out[key] = String(input[key] ?? "").trim().slice(0, max);
  }
  for (const [key, options] of Object.entries(CHOICE_FIELDS)) {
    out[key] = options.includes(input[key]) ? input[key] : "";
  }
  out.services = Array.isArray(input.services) ? SERVICES.filter((s) => input.services.includes(s)) : [];
  return out;
}

/** Field name → message for each problem; empty when the enquiry can be sent. */
export function validateEnquiry(enquiry) {
  const e = normalizeEnquiry(enquiry);
  const errors = {};
  if (!e.name) errors.name = "Please enter your name.";
  if (!e.company) errors.company = "Please enter your company.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) errors.email = "Please enter a valid work email.";
  if (e.phone.replace(/\D/g, "").length < 8) errors.phone = "Please enter a phone number.";
  if (!e.tripsPerMonth) errors.tripsPerMonth = "Please choose an estimate.";
  return errors;
}

export function enquirySubject(enquiry) {
  return `Corporate account enquiry: ${normalizeEnquiry(enquiry).company}`;
}

/** Plain-text email body, used for the email and the mailto fallback. */
export function enquiryText(enquiry) {
  const e = normalizeEnquiry(enquiry);
  const line = (label, value) => `${label}: ${value || "—"}`;
  return [
    "Corporate account enquiry (vernochauffeur.com.au/corporate)",
    "",
    "CONTACT",
    line("Name", e.name),
    line("Job title", e.jobTitle),
    line("Email", e.email),
    line("Phone", e.phone),
    "",
    "COMPANY",
    line("Company", e.company),
    line("ABN", e.abn),
    line("Company size", e.companySize && `${e.companySize} employees`),
    "",
    "TRAVEL",
    line("Trips per month", e.tripsPerMonth),
    line("Services", e.services.join(", ")),
    line("Typical routes", e.routes),
    line("Who books", e.bookers),
    line("Start", e.start),
    line("Heard about us", e.source),
    "",
    "NOTES",
    e.notes || "—",
  ].join("\n");
}

export function enquiryMailtoUrl(enquiry) {
  return `mailto:${VERNO_EMAIL}?subject=${encodeURIComponent(enquirySubject(enquiry))}&body=${encodeURIComponent(enquiryText(enquiry))}`;
}
