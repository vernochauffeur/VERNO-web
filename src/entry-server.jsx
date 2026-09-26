import { renderToString } from "react-dom/server";
import App from "./pages/Home.jsx";
import { SITE_URL } from "./content/places.js";
import { PAGES, faqSetFor } from "./content/pages.js";
import { faqsFor, buildFaqSchema } from "./content/faq.js";

export { PAGES, SITE_URL };

/** FAQPage structured data for exactly the questions a page shows. */
export function faqSchemaFor(props = {}) {
  return buildFaqSchema(faqsFor(faqSetFor(props)));
}

// Used only at build time by scripts/prerender.mjs to produce static HTML.
export function render(props = {}) {
  return renderToString(<App {...props} />);
}
