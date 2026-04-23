import { useState } from "react";

const WHATSAPP_NUMBER = "610421238894";

const AIRPORT_FIXED = {
  "cbd": 105,
  "melbourne cbd": 105,
  "city": 105,
  "docklands": 105,
  "southbank": 110,
  "south melbourne": 110,
  "st kilda": 130,
  "south yarra": 120,
  "brighton": 145,
  "frankston": 245,
  "mornington": 275,
  "mount eliza": 260,
  "mount martha": 285,
  "geelong": 175,
};

const NEARBY_GROUPS = [
  ["mornington", "mount eliza", "mount martha"],
  ["brighton", "hampton", "sandringham"],
  ["south yarra", "prahran", "windsor"],
  ["st kilda", "elwood", "balaclava"],
];

function normalize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isAirport(text) {
  const t = normalize(text);
  return (
    t.includes("airport") ||
    t.includes("tullamarine") ||
    t.includes("avalon") ||
    t.includes("terminal")
  );
}

function getAnchor(text) {
  const t = normalize(text);
  const entries = Object.entries(AIRPORT_FIXED).sort((a, b) => b[0].length - a[0].length);
  for (const [key, value] of entries) {
    if (t.includes(key)) return value;
  }
  return null;
}

function inSameNearbyGroup(from, to) {
  const a = normalize(from);
  const b = normalize(to);
  return NEARBY_GROUPS.some(
    (group) => group.some((x) => a.includes(x)) && group.some((x) => b.includes(x))
  );
}

function round5(n) {
  return Math.round(n / 5) * 5;
}

function calculateFare(from, to) {
  const hasAirport = isAirport(from) || isAirport(to);
  const fromAnchor = getAnchor(from);
  const toAnchor = getAnchor(to);
  const maxAnchor = Math.max(fromAnchor || 0, toAnchor || 0);

  if (hasAirport && maxAnchor) {
    return round5(maxAnchor);
  }

  if (fromAnchor && toAnchor && inSameNearbyGroup(from, to)) {
    return round5(Math.max(75, maxAnchor * 0.4));
  }

  if (fromAnchor && toAnchor) {
    return round5(Math.max(75, maxAnchor * 0.55));
  }

  if (maxAnchor) {
    return round5(Math.max(75, maxAnchor * 0.65));
  }

  return 95;
}

function buildWhatsAppLink(from, to, fare) {
  const msg = [
    "Hello, I'd like to book a transfer:",
    "",
    `Pickup: ${from || "--"}`,
    `Drop-off: ${to || "--"}`,
    `Estimated fare: $${fare}`,
    "",
    "Please confirm availability.",
  ].join("\n");

  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
}

export default function Home() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const canCalculate = from.trim().length > 2 && to.trim().length > 2;
  const fare = canCalculate ? calculateFare(from, to) : null;
  const waLink = fare ? buildWhatsAppLink(from, to, fare) : "#";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#111111",
        color: "#ffffff",
        fontFamily: "Arial, sans-serif",
        padding: "48px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "760px",
          margin: "0 auto",
        }}
      >
        <p
          style={{
            color: "#9E8A6A",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            fontSize: "12px",
            marginBottom: "16px",
          }}
        >
          VÉRNO Premium Transfers
        </p>

        <h1
          style={{
            fontSize: "48px",
            lineHeight: 1.1,
            margin: "0 0 16px 0",
            fontWeight: 400,
          }}
        >
          Private chauffeur
          <br />
          in Melbourne.
        </h1>

        <p
          style={{
            color: "rgba(255,255,255,.65)",
            fontSize: "16px",
            lineHeight: 1.6,
            marginBottom: "40px",
            maxWidth: "560px",
          }}
        >
          Fixed fares. Direct booking. Airport and suburb transfers without surge pricing.
        </p>

        <div
          style={{
            background: "#ffffff",
            color: "#111111",
            padding: "24px",
            borderRadius: "0",
          }}
        >
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "8px",
                color: "#666666",
              }}
            >
              Pickup
            </label>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="e.g. Mornington"
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: "16px",
                border: "1px solid #dddddd",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginBottom: "8px",
                color: "#666666",
              }}
            >
              Destination
            </label>
            <input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="e.g. Mount Eliza or Melbourne Airport"
              style={{
                width: "100%",
                padding: "14px 16px",
                fontSize: "16px",
                border: "1px solid #dddddd",
                outline: "none",
              }}
            />
          </div>

          {fare !== null && (
            <div
              style={{
                background: "#111111",
                color: "#ffffff",
                padding: "24px",
                marginBottom: "20px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#9E8A6A",
                  marginBottom: "8px",
                }}
              >
                Estimated Fare
              </div>
              <div
                style={{
                  fontSize: "48px",
                  lineHeight: 1,
                  marginBottom: "8px",
                }}
              >
                ${fare}
              </div>
              <div
                style={{
                  color: "rgba(255,255,255,.6)",
                  fontSize: "14px",
                }}
              >
                Final confirmation via WhatsApp
              </div>
            </div>
          )}

          <a
            href={fare !== null ? waLink : "#"}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              background: fare !== null ? "#128C7E" : "#999999",
              color: "#ffffff",
              padding: "14px 20px",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Reserve via WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
