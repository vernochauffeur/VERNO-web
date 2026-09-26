import React from "react";
import ReactDOM from "react-dom/client";
import App from "./pages/Home.jsx";
import { findPlaceByPath } from "./content/places.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App place={findPlaceByPath(window.location.pathname)} />
  </React.StrictMode>
);
