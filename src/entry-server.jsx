import { renderToString } from "react-dom/server";
import App from "./pages/Home.jsx";
import { SUBURBS, SITE_URL, suburbPath, suburbHead, buildSuburbSchema } from "./content/suburbs.js";

export { SUBURBS, SITE_URL, suburbPath, suburbHead, buildSuburbSchema };

// Used only at build time by scripts/prerender.mjs to produce static HTML.
export function render(suburb = null) {
  return renderToString(<App suburb={suburb} />);
}
