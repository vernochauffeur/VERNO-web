// Loads the Google Maps JavaScript API (Places Autocomplete + Distance Matrix for
// the fare calculator) on first focus of an address field, not on page load.
//
// This is a browser key and is visible by design. Keep it restricted in Google Cloud Console:
// Application restriction = HTTP referrers (https://www.vernochauffeur.com.au/* and https://vernochauffeur.com.au/*),
// API restriction = Maps JavaScript API, Places API and Distance Matrix API only.
const MAPS_SRC = "https://maps.googleapis.com/maps/api/js?key=AIzaSyDewj3mAviH1TlgbCnSc2XnkXMzz4R6hZA&libraries=places,geometry";

let requested = false;

/** Injects the Maps script once. Safe to call repeatedly. */
export function loadGoogleMaps() {
  if (requested || typeof document === "undefined") return;
  requested = true;
  const script = document.createElement("script");
  script.src = MAPS_SRC;
  script.async = true;
  document.head.appendChild(script);
}
