// Spring Racing Carnival page (/spring-racing-carnival-chauffeur): race days
// and venues. Verify dates against racingvictoria.com.au / vrc.com.au each year.

// 2026 dates, checked October 2026 on racingvictoria.com.au and vrc.com.au.
// Moonee Valley is closed for redevelopment in 2026, so the Cox Plate is at Flemington.
export const RACE_DAYS = [
  { name: "Caulfield Cup", venue: "Caulfield", date: "Sat 17 October" },
  { name: "Cox Plate", venue: "Flemington", date: "Sat 24 October" },
  { name: "Derby Day", venue: "Flemington", date: "Sat 31 October" },
  { name: "Melbourne Cup", venue: "Flemington", date: "Tue 3 November" },
  { name: "Oaks Day", venue: "Flemington", date: "Thu 5 November" },
  { name: "Stakes Day", venue: "Flemington", date: "Sat 7 November" },
];

export const RACING_VENUE_NOTE =
  "In 2026 the Cox Plate is run at Flemington while Moonee Valley is being redeveloped. " +
  "Race dates from Racing Victoria and the VRC.";
