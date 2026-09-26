import React from "react";
import ReactDOM from "react-dom/client";
import App from "./pages/Home.jsx";
import { findSuburbByPath } from "./content/suburbs.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App suburb={findSuburbByPath(window.location.pathname)} />
  </React.StrictMode>
);
