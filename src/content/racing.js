// Spring Racing Carnival page (/spring-racing-carnival-chauffeur): race days
// and venues. Verify dates against racingvictoria.com.au / vrc.com.au each year.

import { MAJOR_VENUE_FEE_NOTE, SPECIAL_QUOTE_NOTE } from "../lib/pricing.js";
import { MAX_PASSENGERS } from "../lib/booking.js";

// Season shown on the page. Leave `date` (and an unconfirmed `venue`) null until
// the official calendar is out; the page then shows "Date TBC".
export const RACING_SEASON = "2027";

// 2026 for reference (racingvictoria.com.au / vrc.com.au): Caulfield Cup Sat 17 Oct,
// Cox Plate Sat 24 Oct (at Flemington, Moonee Valley closed), Derby Day Sat 31 Oct,
// Melbourne Cup Tue 3 Nov, Oaks Day Thu 5 Nov, Stakes Day Sat 7 Nov.
export const RACE_DAYS = [
  { name: "Caulfield Cup", venue: "Caulfield", date: null },
  // 2027 venue depends on the Moonee Valley redevelopment.
  { name: "Cox Plate", venue: null, date: null },
  { name: "Derby Day", venue: "Flemington", date: null },
  { name: "Melbourne Cup", venue: "Flemington", date: null },
  { name: "Oaks Day", venue: "Flemington", date: null },
  { name: "Stakes Day", venue: "Flemington", date: null },
];

export const RACING_VENUE_NOTE =
  `${RACING_SEASON} race dates are not announced yet. We'll add them here once Racing Victoria ` +
  "and the VRC confirm them; the Cox Plate venue depends on the Moonee Valley redevelopment.";

// What EventDetails (Home.jsx) shows on the racing page.
export const RACING_EVENT = {
  id: "race-days",
  label: `Spring Racing Carnival ${RACING_SEASON}`,
  heading: ["Race days at Flemington", "and Caulfield."],
  daysLabel: "Race days",
  days: RACE_DAYS.map((d) => ({ name: d.venue ? `${d.name} · ${d.venue}` : d.name, date: d.date || "Date TBC" })),
  items: [
    { name: "BMW i5 chauffeur", tag: "Fleet", desc: `An electric BMW i5 for up to ${MAX_PASSENGERS} passengers, with your chauffeur for the trip.` },
    { name: "Drop-off & pick-up", tag: "Race day", desc: "To and from Flemington and Caulfield racecourses, from your home, hotel or office." },
    { name: "Return trips", tag: "Race day", desc: "Book both directions at once — turn on 'Add return trip' in the booking form." },
    { name: "Full-day hire", tag: "Quote via WhatsApp", desc: "A chauffeur for the whole race day, with stops before and after the races." },
  ],
  notes: [RACING_VENUE_NOTE, MAJOR_VENUE_FEE_NOTE, SPECIAL_QUOTE_NOTE],
  waSource: "racing_quote",
};
