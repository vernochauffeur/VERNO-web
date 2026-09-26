import { renderToString } from "react-dom/server";
import App from "./pages/Home.jsx";
import { PLACES, SITE_URL, placePath, placeHead, buildPlaceSchema } from "./content/places.js";

export { PLACES, SITE_URL, placePath, placeHead, buildPlaceSchema };

// Used only at build time by scripts/prerender.mjs to produce static HTML.
export function render(place = null) {
  return renderToString(<App place={place} />);
}
