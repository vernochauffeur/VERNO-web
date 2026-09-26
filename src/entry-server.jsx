import { renderToString } from "react-dom/server";
import App from "./pages/Home.jsx";
import { SITE_URL } from "./content/places.js";
import { PAGES } from "./content/pages.js";

export { PAGES, SITE_URL };

// Used only at build time by scripts/prerender.mjs to produce static HTML.
export function render(props = {}) {
  return renderToString(<App {...props} />);
}
