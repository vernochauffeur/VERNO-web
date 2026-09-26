import { renderToString } from "react-dom/server";
import App from "./pages/Home.jsx";

// Used only at build time by scripts/prerender.mjs to produce static HTML.
export function render() {
  return renderToString(<App />);
}
