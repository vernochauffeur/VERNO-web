// Spring Racing Carnival page (/spring-racing-carnival-chauffeur): the
// carnival's main race days, without exact dates. The 2026 carnival is over
// and 2027 dates aren't announced yet. When Racing Victoria / the VRC publish
// them, put exact dates back in `when` (and update RACING_VENUE_NOTE).
export const RACE_DAYS = [
  { name: "Caulfield Cup", venue: "Caulfield", when: "October" },
  { name: "Cox Plate", venue: "Moonee Valley / Flemington", when: "October" },
  { name: "Derby Day", venue: "Flemington", when: "Cup week" },
  { name: "Melbourne Cup", venue: "Flemington", when: "1st Tue of Nov" },
  { name: "Oaks Day", venue: "Flemington", when: "Cup week" },
  { name: "Stakes Day", venue: "Flemington", when: "Cup week" },
];

export const RACING_VENUE_NOTE =
  "The 2026 carnival has finished. Race dates for 2027 are set by Racing Victoria and the VRC — " +
  "message us and we'll hold your race days as soon as they're confirmed.";
