// Major Melbourne events page (/melbourne-events-chauffeur). Dates are
// Melbourne local, "YYYY-MM-DD", inclusive. Verify each against the official
// source in the comment. Events whose end date has passed drop off the page
// by themselves; add next season's events here when they're announced.
// The Spring Racing Carnival has its own page (racing.js).
export const EVENTS = [
  // mcg.org.au: Australia v New Zealand, 26–30 December 2026
  { name: "Boxing Day Test", detail: "Australia v New Zealand", venue: "MCG", start: "2026-12-26", end: "2026-12-30" },
  // melbournepark.com.au / ausopen.com: 11–31 January 2027, finals 30–31 January
  { name: "Australian Open", detail: "Finals weekend 30–31 January", venue: "Melbourne Park", start: "2027-01-11", end: "2027-01-31" },
  // mcg.org.au: one-off day-night Test, 11–15 March 2027
  { name: "150th Anniversary Test", detail: "Australia v England, day-night", venue: "MCG", start: "2027-03-11", end: "2027-03-15" },
  // premier.vic.gov.au (17 Sept 2026): 1–4 April 2027, Sprint Sat 3, race Sun 4
  { name: "Formula 1 Australian Grand Prix", detail: "Sprint Sat 3, race Sun 4 April", venue: "Albert Park", start: "2027-04-01", end: "2027-04-04" },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "26–30 December 2026", "11–31 January 2027", "30 April – 2 May 2027". */
export function formatEventDates({ start, end }) {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  if (start === end) return `${sd} ${MONTHS[sm - 1]} ${sy}`;
  if (sy === ey && sm === em) return `${sd}–${ed} ${MONTHS[em - 1]} ${ey}`;
  if (sy === ey) return `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${sd} ${MONTHS[sm - 1]} ${sy} – ${ed} ${MONTHS[em - 1]} ${ey}`;
}

/** Today's date in Melbourne, "YYYY-MM-DD". */
export function melbourneToday(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Australia/Melbourne" });
}

/** Events that haven't finished by `today`, in date order. */
export function upcomingEvents(today = melbourneToday(), events = EVENTS) {
  return events.filter((e) => e.end >= today).sort((a, b) => a.start.localeCompare(b.start));
}
