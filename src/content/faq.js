// FAQ content — single source for the on-page FAQ (Home.jsx) and the
// FAQPage structured data injected into index.html at build time (vite.config.js).
// Prices come from src/lib/pricing.js so the copy can't drift from the calculator.

import { PRICING, WAITING_POLICY, SPECIAL_QUOTE_NOTE, formatPrice, airportExamplePrice } from "../lib/pricing.js";
import { MAX_PASSENGERS } from "../lib/booking.js";

const airportFrom = (suburb) => formatPrice(airportExamplePrice(suburb));

export const FAQS = [
  {
    q: "How much does a chauffeur cost in Melbourne?",
    a: `Private chauffeur fares start from ${formatPrice(PRICING.MIN_FARE)}, with the final fare determined by distance, pickup time and journey requirements. ` +
      `Melbourne Airport transfers: CBD from ${airportFrom("CBD")}, St Kilda from ${airportFrom("St Kilda")} and Brighton from ${airportFrom("Brighton")}. ` +
      "Enter your pickup and destination in the booking form to see your fare instantly.",
  },
  {
    q: "Do you provide airport transfers from Tullamarine and Avalon?",
    a: "Yes. We specialise in Melbourne airport transfers — both Tullamarine (MEL) and Avalon (AVV). Your flight is tracked in real-time, so we adjust pickup if your flight is delayed or arrives early. No extra charge for waiting if your flight is late.",
  },
  {
    q: "What if my flight is delayed?",
    a: "No problem — we monitor your flight automatically using the flight number you provide. If your flight is delayed, we adjust your pickup accordingly with no additional charge. If your flight arrives early, we'll be there waiting.",
  },
  {
    q: "How far in advance should I book?",
    a: "We recommend booking at least 12 hours in advance to guarantee availability. For peak times (early mornings, weekends, major events) earlier booking is best. For last-minute requests, message us on WhatsApp — we'll do our best to accommodate.",
  },
  {
    q: "Do you charge a waiting fee?",
    a: WAITING_POLICY,
  },
  {
    q: "What vehicles do you operate?",
    a: `Our fleet consists of modern BMW i5 electric sedans — premium, quiet, and zero-emission. Each vehicle seats up to ${MAX_PASSENGERS} passengers comfortably with generous luggage capacity. All vehicles are kept immaculate and fully equipped for executive travel.`,
  },
  {
    q: "Do you serve corporate clients?",
    a: "Yes. We offer dedicated corporate chauffeur services for executives, business guests and clients across Melbourne. Account billing, recurring transfers and priority booking available. Contact us via the Corporate Enquiries section for tailored arrangements.",
  },
  {
    q: "Can I book a return trip?",
    a: "Yes. When booking, toggle 'Add return trip' to schedule both directions in one booking. You can specify a different return address if needed. The return fare is calculated separately for the return route and pickup time, and both fares and the total are shown in your quote.",
  },
  {
    q: "Is pricing different for major events?",
    a: `Standard bookings use our normal distance-based pricing — there is no surge pricing. ${SPECIAL_QUOTE_NOTE}`,
  },
];

/** Schema.org FAQPage object for structured data. */
export function buildFaqSchema(faqs = FAQS) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
