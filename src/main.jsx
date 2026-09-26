import React from "react";
import ReactDOM from "react-dom/client";
import App from "./pages/Home.jsx";
import { findPageByPath } from "./content/pages.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App {...findPageByPath(window.location.pathname)?.props} />
  </React.StrictMode>
);
