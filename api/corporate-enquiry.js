// Vercel serverless function: emails a corporate account enquiry from the
// /corporate form through Resend (https://resend.com).
//
// Vercel environment variables:
//   RESEND_API_KEY  required. Until it is set this returns 503 and the form
//                   falls back to opening the visitor's email app.
//   ENQUIRY_FROM    optional sender, e.g. "VÉRNO Website <website@vernochauffeur.com.au>"
//                   once the domain is verified in Resend. The default
//                   onboarding@resend.dev only delivers to the Resend account's own email.
//   ENQUIRY_TO      optional recipient, defaults to book@vernochauffeur.com.au.

import { validateEnquiry, normalizeEnquiry, enquirySubject, enquiryText } from "../src/lib/corporate.js";
import { VERNO_EMAIL } from "../src/lib/booking.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { return res.status(400).json({ error: "invalid_json" }); }
  }
  body = body || {};

  // Hidden field only bots fill in: pretend it worked, send nothing.
  if (body.website) return res.status(200).json({ ok: true });

  const errors = validateEnquiry(body);
  if (Object.keys(errors).length) return res.status(400).json({ error: "invalid", errors });

  const key = process.env.RESEND_API_KEY;
  if (!key) return res.status(503).json({ error: "not_configured" });

  const enquiry = normalizeEnquiry(body);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ENQUIRY_FROM || "VÉRNO Website <onboarding@resend.dev>",
      to: [process.env.ENQUIRY_TO || VERNO_EMAIL],
      reply_to: enquiry.email,
      subject: enquirySubject(enquiry),
      text: enquiryText(enquiry),
    }),
  }).catch(() => null);

  if (!response || !response.ok) {
    console.error("Resend failed", response && response.status, response && (await response.text()));
    return res.status(502).json({ error: "send_failed" });
  }
  return res.status(200).json({ ok: true });
}
