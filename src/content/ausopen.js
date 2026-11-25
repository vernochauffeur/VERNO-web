// Australian Open page (/australian-open-chauffeur). Verify dates against
// ausopen.com / tennis.com.au each year, and keep the finals in step with
// the "Australian Open Finals" entry in MAJOR_EVENTS (src/lib/pricing.js).

import { PRICING, EVENT_FARE_NOTE, SPECIAL_QUOTE_NOTE, formatPrice } from "../lib/pricing.js";
import { MAX_PASSENGERS } from "../lib/booking.js";

// AO 2027, checked November 2026 on ausopen.com and tennis.com.au.
export const AO_DATES = [
  { name: "Tournament · Melbourne Park", date: "11–31 January" },
  { name: "Main draw begins", date: "Sun 17 January" },
  { name: "Singles finals", date: "Sat 30 & Sun 31 January" },
];

export const AO_EVENT = {
  id: "australian-open",
  label: "Australian Open 2027",
  heading: ["Australian Open", "at Melbourne Park."],
  daysLabel: "Key dates",
  days: AO_DATES,
  items: [
    { name: "BMW i5 chauffeur", tag: "Fleet", desc: `An electric BMW i5 for up to ${MAX_PASSENGERS} passengers, with your chauffeur for the trip.` },
    { name: "Drop-off & pick-up", tag: "Match day", desc: "To and from Melbourne Park, from your home, hotel or office." },
    { name: "Night sessions", tag: "Match day", desc: "Book a pick-up for after the evening session, and message us on WhatsApp if your match runs late." },
    { name: "Full-day hire", tag: "Quote via WhatsApp", desc: "A chauffeur for the whole day at the tennis, with stops before and after." },
  ],
  notes: [
    "Dates from ausopen.com and Tennis Australia. Session times are announced closer to the tournament.",
    `A ${formatPrice(PRICING.MAJOR_VENUE_FEE)} major venue fee applies per trip to or from Rod Laver Arena, Margaret Court Arena or John Cain Arena.`,
    `Finals weekend (30–31 January): ${EVENT_FARE_NOTE}`,
    SPECIAL_QUOTE_NOTE,
  ],
  waSource: "ausopen_quote",
};
