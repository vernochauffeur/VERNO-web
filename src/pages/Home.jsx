import { useState, useEffect, useRef } from "react";

const MOMENTS_MAIN = "/images/moments-main.jpg";
const FLEET_IMG = "/images/fleet.jpg";
const WA_NUMBER = "610421238894";
const VERNO_EMAIL = "book@vernochauffeur.com.au";

const PRICING = { MIN_FARE: 75, BASE_FEE: 15, PER_MIN: 0.6, RATE_0_25: 3.2, RATE_25_50: 2.8, RATE_50UP: 2.3, LATE_SURCHARGE: 0.15, LATE_START: 0, LATE_END: 5, BUFFER: 5, ROUND_TO: 5 };
const AIRPORT_FIXED = {

  // 🟢 CBD CORE (en önemli satış bölgesi)
  "cbd": 100,
  "melbourne cbd": 100,
  "city": 100,
  "docklands": 100,
  "southbank": 110,
  "south melbourne": 105,
  "east melbourne": 110,
  "west melbourne": 105,
  "north melbourne": 105,
  "carlton": 105,
  "fitzroy": 110,
  "collingwood": 110,
  "richmond": 120,

  // 🏨 OTELLER
  "park hyatt": 110,
  "grand hyatt": 105,
  "crown": 110,
  "sofitel": 110,
  "langham": 110,
  "w melbourne": 100,
  "ritz carlton": 110,
  "marriott": 105,

  // 🟡 INNER EAST / SOUTH
  "south yarra": 120,
  "prahran": 120,
  "windsor": 120,
  "toorak": 125,
  "malvern": 125,
  "armadale": 125,
  "hawksburn": 125,
  "camberwell": 130,
  "hawthorn": 130,
  "kew": 135,

  // 🟠 INNER WEST / NORTH
  "footscray": 105,
  "yarraville": 110,
  "seddon": 110,
  "brunswick": 110,
  "coburg": 115,
  "northcote": 120,
  "preston": 120,
  "essendon": 115,

  // 🔵 BAYSIDE (yüksek ödeme potansiyeli)
  "st kilda": 125,
  "elwood": 130,
  "balaclava": 130,
  "brighton": 140,
  "hampton": 145,
  "sandringham": 150,
  "mentone": 155,
  "cheltenham": 155,

  // 🟣 EAST / SOUTHEAST
  "chadstone": 140,
  "oakleigh": 145,
  "glen waverley": 155,
  "knox": 160,
  "dandenong": 170,

  // 🔴 PENINSULA (en kritik profit zone)
  "frankston": 220,
  "mount eliza": 240,
  "mornington": 260,
  "mount martha": 280,
  "dromana": 300,
  "rosebud": 320,
  "rye": 340,
  "sorrento": 360,
  "portsea": 380,

  // 🟤 WEST / GEELONG
  "werribee": 150,
  "hoppers crossing": 155,
  "geelong": 180,
  "torquay": 190,
  "barwon heads": 195,

  // 🟢 YARRA VALLEY
  "lilydale": 170,
  "healesville": 190,
  "yarra valley": 190,
  "yarra glen": 185
};
const ROUTE_TABLE = [
  { keys: [["airport", "cbd"], ["airport", "melbourne city"], ["tullamarine", "cbd"]], km: 23, min: 32 },
  { keys: [["airport", "southbank"], ["airport", "crown"], ["airport", "docklands"]], km: 25, min: 34 },
  { keys: [["airport", "st kilda"], ["airport", "south yarra"], ["airport", "prahran"]], km: 29, min: 40 },
  { keys: [["airport", "brighton"], ["airport", "bayside"], ["airport", "sandringham"]], km: 35, min: 46 },
  { keys: [["airport", "geelong"], ["airport", "torquay"]], km: 90, min: 65 },
  { keys: [["airport", "mornington"], ["airport", "peninsula"], ["tullamarine", "mornington"]], km: 90, min: 72 },
  { keys: [["airport", "avalon"], ["tullamarine", "avalon"]], km: 50, min: 42 },
  { keys: [["avalon", "cbd"], ["avalon", "city"]], km: 56, min: 47 }
];

const NEARBY_GROUPS = [
  ["mornington", "mount eliza", "mount martha"], ["brighton", "hampton", "sandringham"],
  ["south yarra", "prahran", "windsor"], ["richmond", "hawthorn"], ["st kilda", "elwood", "balaclava"],
  ["cbd", "southbank", "docklands", "carlton"], ["toorak", "malvern"]
];
const ZONE_GROUPS = [
  ["mornington", "mount eliza", "mount martha", "frankston"], ["dromana", "rosebud", "rye", "sorrento", "portsea"],
  ["brighton", "hampton", "sandringham", "cheltenham", "mentone", "st kilda", "elwood", "balaclava"],
  ["south yarra", "prahran", "richmond", "windsor", "toorak", "hawthorn", "malvern", "camberwell"],
  ["cbd", "southbank", "docklands", "carlton", "fitzroy", "collingwood"]
];

function normalizeAddress(text) { return text.toLowerCase().replace(/\bvic\b|\bnsw\b|\bqld\b|\bsa\b|\bwa\b|\btas\b|\bact\b|\bnt\b/g, " ").replace(/\b3\d{3}\b/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
function isAirport(text) { const t = normalizeAddress(text); return t.includes("airport") || t.includes("tullamarine") || t.includes("terminal") || t.includes("avalon") || t.includes("avv") || t.includes(" mel "); }
function isLateNight() { const h = new Date().getHours(); return h >= PRICING.LATE_START && h < PRICING.LATE_END; }
function distanceCost(km) { if (km <= 25) return km * PRICING.RATE_0_25; if (km <= 50) return 25 * PRICING.RATE_0_25 + (km - 25) * PRICING.RATE_25_50; return 25 * PRICING.RATE_0_25 + 25 * PRICING.RATE_25_50 + (km - 50) * PRICING.RATE_50UP; }
function roundFare(n) { return Math.round(n / PRICING.ROUND_TO) * PRICING.ROUND_TO; }
function applyLateAndRound(fare) { return roundFare(isLateNight() ? Math.round(fare * (1 + PRICING.LATE_SURCHARGE)) : fare); }
function suburbToken(n) { const words = n.split(" "); const two = words.length >= 2 ? words[0] + " " + words[1] : ""; return Object.keys(AIRPORT_FIXED).includes(two) ? two : (words[0] || n); }
function getAnchor(text) { const n = normalizeAddress(text); const sorted = Object.entries(AIRPORT_FIXED).sort((a, b) => b[0].length - a[0].length); for (const [key, val] of sorted) { if (new RegExp("(?:^| )" + key.replace(/ /g, " ") + "(?= |$)").test(n)) return val; } return null; }
function inGroup(n, group) { return group.some((k) => new RegExp("(?:^| )" + k.replace(/ /g, " ") + "(?= |$)").test(n)); }
function isSameSuburb(a, b) { if (a === b) return true; const ta = suburbToken(a); const tb = suburbToken(b); return ta.length > 2 && ta === tb; }
function airportFixedFare(from, to) {
  const combined = normalizeAddress(from + " " + to);

  if (!isAirport(from + " " + to)) return null;

  // 🔥 1. CBD GLOBAL FIX (OTEL OLSUN OLMASIN)
  if (
    combined.includes("cbd") ||
    combined.includes("city") ||
    combined.includes("3000")
  ) {
    return 100;
  }

  // 🏨 HOTEL OVERRIDES (daha spesifik → yukarıdan önce çalışır)
  if (combined.includes("park hyatt")) return 110;
  if (combined.includes("sofitel")) return 110;
  if (combined.includes("ritz")) return 110;
  if (combined.includes("w melbourne") || combined.includes("flinders")) return 100;
  if (combined.includes("grand hyatt")) return 100;
  if (combined.includes("crown")) return 105;
  if (combined.includes("langham")) return 105;

  // 🔁 NORMAL SUBURB MATCH
  const sorted = Object.entries(AIRPORT_FIXED)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [zone, price] of sorted) {
    if (combined.includes(zone)) return price;
  }

  return null;
}
function lookupRoute(from, to) { const combined = (from + " " + to).toLowerCase(); for (const route of ROUTE_TABLE) { for (const pair of route.keys) { if (combined.includes(pair[0]) && combined.includes(pair[1])) return { km: route.km, min: route.min }; } } return null; }
function anchorSuburbFare(from, to) { const af = getAnchor(from); const at = getAnchor(to); const anchors = [af, at].filter((a) => a !== null); if (anchors.length === 0) return applyLateAndRound(PRICING.MIN_FARE + PRICING.BUFFER + 15); const nf = normalizeAddress(from); const nt = normalizeAddress(to); const cap = Math.max(...anchors); if (isSameSuburb(nf, nt)) return PRICING.MIN_FARE; let base; if (NEARBY_GROUPS.some((g) => inGroup(nf, g) && inGroup(nt, g))) { base = anchors.reduce((s, a) => s + a, 0) / anchors.length * 0.40; } else if (ZONE_GROUPS.some((g) => inGroup(nf, g) && inGroup(nt, g))) { base = Math.min(...anchors) * 0.50; } else { base = Math.max(...anchors) * 0.65; } return applyLateAndRound(Math.min(cap, Math.max(PRICING.MIN_FARE, base)) + PRICING.BUFFER); }
function calculateFare(from, to) {
  const fixed = airportFixedFare(from, to);

  // ✅ AIRPORT FIX → HER ŞEYİ EZER
  if (fixed !== null) {
    return roundFare(fixed + PRICING.BUFFER);
  }

  const airportRoute = isAirport(from + " " + to);

  if (airportRoute) {
    const route = lookupRoute(from, to);

    if (route) {
      return applyLateAndRound(
        Math.max(
          PRICING.BASE_FEE +
          distanceCost(route.km) +
          route.min * PRICING.PER_MIN,
          PRICING.MIN_FARE
        ) + PRICING.BUFFER
      );
    }

    return applyLateAndRound(120 + PRICING.BUFFER);
  }

  return anchorSuburbFare(from, to);
}
function estimateFare(from, to) { if (from.trim().length < 4 || to.trim().length < 4) return null; const fixed = airportFixedFare(from, to) !== null || lookupRoute(from, to) !== null; return { fare: calculateFare(from, to), isLate: isLateNight(), hasAirport: isAirport(from + " " + to), isFixed: fixed, isFallback: !fixed }; }

function AddressField({ label, placeholder, value, onChange, id }) {
  const inputRef = useRef(null);

  useEffect(() => {
    let timer;

    const initAutocomplete = () => {
      if (!window.google?.maps?.places || !inputRef.current) {
        timer = setTimeout(initAutocomplete, 300);
        return;
      }

      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "au" },
        fields: ["formatted_address", "name"]
      });

      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const selected = place.formatted_address || place.name || "";
        const lower = selected.toLowerCase();

if (
  lower.includes(" vic") ||
  lower.includes(" victoria")
) {
  onChange(selected);
} else {
  alert("Please select a location within Victoria.");
}
      });
    };

    initAutocomplete();

    return () => clearTimeout(timer);
  }, [onChange]);

  return (
    <div className="fg address-field">
      <label className="fl" htmlFor={id}>{label}</label>

      <input
        id={id}
        ref={inputRef}
        className="fi address-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
      />

      {value && (
        <button
          type="button"
          className="clear-address-btn"
          onClick={() => onChange("")}
          aria-label={`Clear ${label}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
function buildWhatsAppLink({
  from,
  to,
  date,
  time,
  pax,
  bags,
  fare,
  flightNumber
}) {
  const msg = [
    "Hi, I’d like to arrange a Verno chauffeur service.",
    "",
    `Pickup: ${from || ""}`,
    `Drop-off: ${to || ""}`,
    `Date: ${date || ""}`,
    `Time: ${time || ""}`,
    `Passengers: ${pax || ""}`,
    `Luggage: ${bags || ""}`,
    `Flight number (if required): ${flightNumber || ""}`,
    ...(fare ? [`Estimated fare: $${fare}`] : []),
    "",
    "Please provide a quote and confirm availability."
  ].join("\n");

  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}
function WAIcon({ s = 20 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 2.12.56 4.12 1.53 5.85L0 24l6.34-1.52A11.95 11.95 0 0012 24c6.63 0 12-5.37 12-12S18.63 0 12 0zm0 22a9.96 9.96 0 01-5.19-1.37l-.37-.22-3.84.92.98-3.73-.24-.38A9.96 9.96 0 012 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/></svg>; }
function MsgIcon({ s = 14 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function IconPlaneHero() {
  return (
    <svg viewBox="0 0 64 64" className="lux-icon" aria-hidden="true">
      <path d="M57 30.5c1.6.8 1.6 2.2 0 3L39.6 41l-6.7 16.2c-.5 1.2-2.2 1.1-2.6-.1l-4.2-12.4-12 5.1-2.4 5.1c-.4.8-1.5.8-1.9.1l-2-3.8-3.8-2c-.7-.4-.7-1.5.1-1.9l5.1-2.4 5.1-12-12.4-4.2c-1.2-.4-1.3-2.1-.1-2.6L22 19.4 29.5 2c.8-1.6 2.2-1.6 3 0l4.4 15.4L57 30.5Z"/>
    </svg>
  );
}

function IconBriefcaseHero() {
  return (
    <svg viewBox="0 0 64 64" className="lux-icon" aria-hidden="true">
      <path d="M19 20h26c5 0 9 4 9 9v20c0 5-4 9-9 9H19c-5 0-9-4-9-9V29c0-5 4-9 9-9Z"/>
      <path d="M24 20v-5c0-5 3.5-9 8-9s8 4 8 9v5"/>
      <path d="M10 34h44"/>
      <path d="M29 34v5h6v-5"/>
    </svg>
  );
}

function IconCarHero() {
  return (
    <svg viewBox="0 0 64 64" className="lux-icon" aria-hidden="true">
      <path d="M13 36l5.2-15c1-3 3.5-5 6.7-5h14.2c3.2 0 5.7 2 6.7 5L51 36"/>
      <path d="M12 36h40c2.2 0 4 1.8 4 4v9H8v-9c0-2.2 1.8-4 4-4Z"/>
      <path d="M17 49v5"/>
      <path d="M47 49v5"/>
      <circle cx="20" cy="47" r="3"/>
      <circle cx="44" cy="47" r="3"/>
      <path d="M22 24h20"/>
    </svg>
  );
}

function IconPrice() {
  return (
    <svg viewBox="0 0 24 24" className="trust-small-icon">
      <path d="M20.5 13.5l-7 7a2.2 2.2 0 0 1-3.1 0l-7-7V4h9.5l7.6 7.6a1.4 1.4 0 0 1 0 1.9Z"/>
      <circle cx="8" cy="8" r="1.4"/>
    </svg>
  );
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" className="trust-small-icon">
      <path d="M12 21s7-3.8 7-10V5.5L12 3 5 5.5V11c0 6.2 7 10 7 10Z"/>
      <path d="M9 12l2 2 4-5"/>
    </svg>
  );
}

function IconChatSmall() {
  return (
    <svg viewBox="0 0 24 24" className="trust-small-icon">
      <path d="M4 5h16v11H8l-4 4V5Z"/>
    </svg>
  );
}

function IconDiamond() {
  return (
    <svg viewBox="0 0 24 24" className="trust-small-icon">
      <path d="M6 4h12l4 7-10 10L2 11l4-7Z"/>
      <path d="M2 11h20"/>
      <path d="M8 4l4 17 4-17"/>
    </svg>
  );
}
function VernoMark({ dark = false, h = 44 }) {
  return (
    <div className="verno-logo">
      <div className="verno-logo-top">
        <span className="verno-dot" />
        <span className="verno-word">VÉRNO</span>
      </div>
      <span className="verno-city">MELBOURNE</span>
    </div>
  );
}
function useReveal(ref) { useEffect(() => { const root = ref.current; if (!root) return; root.querySelectorAll(".rv").forEach((el) => el.classList.add("in")); }, [ref]); }

function Nav() { const [solid, setSolid] = useState(false); useEffect(() => { const fn = () => setSolid(window.scrollY > 60); window.addEventListener("scroll", fn); return () => window.removeEventListener("scroll", fn); }, []); return <nav className={`nav${solid ? " solid" : ""}`}><a href="#" className="nav-logo-wrap"><VernoMark dark={solid} h={34}/></a><ul className="nav-links"><li><a href="#services">Services</a></li><li><a href="#fleet">Fleet</a></li><li><a href="#areas">Coverage</a></li><li><a href="#about">About</a></li></ul><div className="nav-right"><a href="#book" className="nav-btn">Reserve a Transfer</a></div></nav>; }
function IconPlane() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M21.7 16.2 13.3 12l8.4-4.2c.4-.2.4-.8 0-1l-1.1-.6c-.2-.1-.4-.1-.6 0l-9.4 3.1-4.1-5.2c-.1-.2-.3-.3-.6-.3H3.8c-.5 0-.8.5-.5.9L6.8 11 3.3 19.3c-.2.4.1.9.5.9h2.1c.2 0 .4-.1.6-.3l4.1-5.2 9.4 3.1c.2.1.4.1.6 0l1.1-.6c.4-.2.4-.8 0-1Z"/>
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M9 6V5.2C9 3.4 10.4 2 12.2 2h1.6C15.6 2 17 3.4 17 5.2V6h2.2C20.7 6 22 7.3 22 8.8v9.4c0 1.5-1.3 2.8-2.8 2.8H4.8C3.3 21 2 19.7 2 18.2V8.8C2 7.3 3.3 6 4.8 6H9Zm2 0h4v-.8c0-.7-.5-1.2-1.2-1.2h-1.6c-.7 0-1.2.5-1.2 1.2V6Zm-7 6.2V18c0 .6.4 1 1 1h14c.6 0 1-.4 1-1v-5.8h-6.6v1.1h-2.8v-1.1H4Zm6.6-2.2h2.8v1h-2.8v-1Z"/>
    </svg>
  );
}

function IconCar() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.2 10.2 7.4 6.8C7.8 5.7 8.8 5 10 5h4c1.2 0 2.2.7 2.6 1.8l1.2 3.4 1.3.4c1.1.4 1.9 1.4 1.9 2.6V18c0 .6-.4 1-1 1h-1.1a2.4 2.4 0 0 1-4.6 0H9.7a2.4 2.4 0 0 1-4.6 0H4c-.6 0-1-.4-1-1v-4.8c0-1.2.8-2.2 1.9-2.6l1.3-.4Zm2.4-.3h6.8l-.8-2.3c-.1-.4-.5-.6-.9-.6h-3.4c-.4 0-.8.2-.9.6l-.8 2.3ZM7.4 17.8a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm9.2 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>
    </svg>
  );
}
function Hero() {
  const wa = buildWhatsAppLink({ from: "", to: "", fare: null });

  return (
    <section className="hero">
      <div className="hero-content">
        <div className="hero-left">
          <p className="hero-label">Private Chauffeur — Melbourne</p>

          <h1 className="hero-h1">
            <span className="hero-top">Arrive in</span>
            <span className="hero-bottom">complete confidence.</span>
          </h1>

          <div className="hero-line" />

          <p className="hero-sub">
            Private airport, corporate and point-to-point transfers across Melbourne.
            <br />
            Fixed fares. Direct booking. Premium comfort.
          </p>

          {/* 🔥 SEO SATIRI (minimal ve görünümü bozmaz) */}
          <p
            style={{
              fontSize: "13px",
              color: "rgba(255,255,255,.35)",
              marginTop: "10px",
            }}
          >
            Melbourne private chauffeur and airport transfer service.
          </p>

          <div className="hero-actions">
  <a
    href={wa}
    target="_blank"
    rel="noopener noreferrer"
    className="btn-wa hero-gold"
  >
    <WAIcon s={18} /> Get Instant Quote
  </a>

  <a href="#book" className="btn-outline hero-outline">
    Get Instant Fare
  </a>

  <a href="#corporate" className="btn-outline hero-outline">
    Corporate Enquiries
  </a>
   <p className="btn-wa-note">
  Response within minutes
</p>         
</div>

          <div className="hero-trust">
            <div className="hero-trust-item">
              <IconPrice />
              <span>Fixed pricing</span>
            </div>
            <div className="hero-trust-item">
              <IconShield />
              <span>No surge</span>
            </div>
            <div className="hero-trust-item">
              <IconChatSmall />
              <span>Direct contact</span>
            </div>
            <div className="hero-trust-item">
              <IconDiamond />
              <span>Premium BMW i5</span>
            </div>
          </div>
        </div>

        <div className="hero-service-panel">
          <div className="hero-service-row">
            <div className="hero-service-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M2 16l20-8-8 20-2-9-10-3z" />
              </svg>
            </div>
            <div>
              <h3>Airport Transfers</h3>
              <p>Tullamarine &amp; Avalon</p>
              <p>Fixed fare, flight tracked</p>
            </div>
          </div>

          <div className="hero-service-row">
            <div className="hero-service-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <rect x="3" y="7" width="18" height="13" rx="2" />
                <path d="M16 7V5a2 2 0 00-4 0v2" />
              </svg>
            </div>
            <div>
              <h3>Corporate Travel</h3>
              <p>Executive ground transport</p>
              <p>Discreet &amp; reliable</p>
            </div>
          </div>

          <div className="hero-service-row">
            <div className="hero-service-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 13l2-5h14l2 5" />
                <path d="M5 13v6h14v-6" />
                <circle cx="7.5" cy="17" r="1" />
                <circle cx="16.5" cy="17" r="1" />
              </svg>
            </div>
            <div>
              <h3>Private Hire</h3>
              <p>Mornington, Yarra Valley</p>
              <p>&amp; beyond — BMW i5</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
function IconClock() {
  return <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>;
}

function IconPerson() {
  return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35"><circle cx="12" cy="7" r="4"/><path d="M4 21c1.7-4 4.2-6 8-6s6.3 2 8 6"/></svg>;
}

function IconStar() {
  return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.7 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.8-4.7 6.6-.9L12 2.5z"/></svg>;
}

function TrustStrip() {
  return (
    <div className="trust-strip">
      <div className="trust-strip-inner">
        <div className="trust-feature">
          <div className="trust-icon"><IconClock /></div>
          <div>
            <h4>On Time, Every Time</h4>
            <p>Punctual, professional and always reliable.</p>
          </div>
        </div>

        <div className="trust-feature">
          <div className="trust-icon"><IconPerson /></div>
          <div>
            <h4>Discreet & Professional</h4>
            <p>Your privacy is respected. Always.</p>
          </div>
        </div>

        <div className="trust-feature">
          <div className="trust-icon"><IconStar /></div>
          <div>
            <h4>Premium Experience</h4>
            <p>Luxury electric comfort from start to finish.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
function FareEstimate({ from, to }) { const result = estimateFare(from, to); if (!result) return null; return <div className="fare-estimate"><div className="fare-label">{result.isFixed ? "Fixed Price" : "Estimated Fare"}{result.isLate ? " - Late-night rate" : ""}</div><div className="fare-price">${result.fare}</div><div className="fare-guarantee">{result.isFallback ? "Estimate - final price confirmed on booking" : "Fixed price confirmed instantly via WhatsApp"}</div><div className="fare-trust"><span>No hidden costs</span><span>No surge pricing</span><span>No platform fees</span></div></div>; }
function getTodayLocal() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getMinBookingTime() {
  const min = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const h = String(min.getHours()).padStart(2, "0");
  const m = String(min.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
function InlineBooking() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pax, setPax] = useState("1");
  const [bags, setBags] = useState("1");
  const [flightNumber, setFlightNumber] = useState("");

  const fareResult = estimateFare(from, to);
  const fare = fareResult ? fareResult.fare : null;

  const isAirportPickup = from.toLowerCase().includes("airport");

  const handleWA = () =>
    window.open(
      buildWhatsAppLink({ from, to, date, time, pax, bags, fare, flightNumber }),
      "_blank",
      "noopener"
    );

  return (
    <div className="booking-panel" id="book">
      <div className="booking-panel-inner">
        <div>
          <h2 className="booking-panel-headline">
            Your fare,<br /><em>instantly.</em>
          </h2>
          <p className="booking-panel-sub">
            Enter your journey details to see your fare. Then reserve directly via WhatsApp.
          </p>
        </div>

        <div className="booking-panel-form">
          <button
            className="quick-chip"
            onClick={() => setTo("Melbourne Airport (Tullamarine)")}
          >
            <span className="quick-chip-dot" />
            Airport transfer? Set Melbourne Airport as destination
          </button>

          <AddressField
            id="from"
            label="Pickup"
            placeholder="Enter pickup address, suburb or hotel"
            value={from}
            onChange={setFrom}
          />

          <AddressField
            id="to"
            label="Destination"
            placeholder="Enter destination address or airport"
            value={to}
            onChange={setTo}
          />

          {isAirportPickup && (
            <div className="fg">
              <label className="fl">Flight Number</label>
              <input
                className="fi"
                placeholder="e.g. EK408"
                value={flightNumber}
                onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
              />

              <p style={{ fontSize: "12px", color: "#999", marginTop: "6px" }}>
                We monitor your flight to ensure perfect pickup timing.
              </p>
            </div>
          )}

          <div className="f2">
            <div className="fg">
              <label className="fl">Date</label>
              <input
                className="fi"
                type="date"
                value={date}
                min={getTodayLocal()}
                onChange={(e) => {
                  const selected = e.target.value;
                  const today = getTodayLocal();

                  if (selected < today) {
                    alert("Please select a valid date.");
                    setDate(today);
                    setTime("");
                    return;
                  }

                  setDate(selected);
                  setTime("");
                }}
              />
            </div>

            <div className="fg">
              <label className="fl">Time</label>
              <select
                className="fi"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              >
                <option value="">Select time</option>

                {(() => {
                  if (!date) {
                    return <option disabled>Please select date first</option>;
                  }

                  const minBooking = new Date(Date.now() + 3 * 60 * 60 * 1000);
                  const slots = [];

                  for (let i = 0; i < 48; i++) {
                    const hour = Math.floor(i / 2);
                    const minute = i % 2 === 0 ? "00" : "30";
                    const slot = `${String(hour).padStart(2, "0")}:${minute}`;
                    const slotDateTime = new Date(`${date}T${slot}`);

                    if (slotDateTime >= minBooking) {
                      slots.push(slot);
                    }
                  }

                  if (slots.length === 0) {
                    return <option disabled>No available times for this date</option>;
                  }

                  return slots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ));
                })()}
              </select>
            </div>
          </div>

          <div className="f2">
            <div className="fg">
              <label className="fl">Passengers</label>
              <select
                className="fi"
                value={pax}
                onChange={(e) => setPax(e.target.value)}
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="fg">
              <label className="fl">Luggage</label>
              <select
                className="fi"
                value={bags}
                onChange={(e) => setBags(e.target.value)}
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          <FareEstimate from={from} to={to} />

          <button className="btn-whatsapp premium-btn" onClick={handleWA}>
  <WAIcon s={18} /> Get Instant Quote on WhatsApp
</button>

<p className="wa-trust-line">
  Instant response · No commitment · Fixed pricing
</p>

          <a
            href={`mailto:${VERNO_EMAIL}?subject=Booking Request`}
            className="btn-email-secondary"
          >
            Prefer email? {VERNO_EMAIL}
          </a>
        </div>
      </div>
    </div>
  );
}
const SERVICES = [{ label: "Airport Transfers", h: "Airport Transfers", d: "Seamless arrivals and departures from Tullamarine and Avalon. Flight monitored. Driver in position." }, { label: "Corporate", h: "Corporate Travel", d: "Reliable ground transport for executives and business guests. Consistent, discreet, professionally managed." }, { label: "Private Hire", h: "Private Hire", d: "A dedicated BMW i5 at your disposal. Yarra Valley, Mornington Peninsula and beyond." }, { label: "Events", h: "Events & Occasions", d: "Premium transport for weddings, corporate functions, and private occasions." }];
function CorporateSection() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");

  const handleSubmit = () => {
    const subject = "Corporate Chauffeur Enquiry";

    const body = `
Name: ${name}
Company: ${company}
Email: ${email}

Details:
${details}
    `;

    window.location.href = `mailto:${VERNO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <section id="corporate" className="corporate-section">
      <div className="booking-panel-inner">

        <div>
          <h2 className="booking-panel-headline">
  Corporate Chauffeur Accounts
</h2>
          <p className="booking-panel-sub">
  Tailored chauffeur services for businesses, executives and ongoing travel requirements.
</p>
        </div>

        <div className="booking-panel-form">

  <div className="fg">
    <label className="fl">Full Name</label>
    <input className="fi" value={name} onChange={(e) => setName(e.target.value)} />
  </div>

  <div className="fg">
    <label className="fl">Company</label>
    <input className="fi" value={company} onChange={(e) => setCompany(e.target.value)} />
  </div>

  <div className="fg">
    <label className="fl">Work Email</label>
    <input className="fi" value={email} onChange={(e) => setEmail(e.target.value)} />
  </div>

  <div className="fg">
    <label className="fl">Estimated Monthly Trips</label>
    <select className="fi" onChange={(e) => setDetails(e.target.value)}>
      <option value="">Select</option>
      <option>1–5 trips</option>
      <option>5–15 trips</option>
      <option>15+ trips</option>
    </select>
  </div>

  <div className="fg">
    <label className="fl">Typical Route</label>
    <input
      className="fi"
      placeholder="e.g. Melbourne Airport ↔ CBD"
      onChange={(e) => setDetails((prev) => prev + "\nRoute: " + e.target.value)}
    />
  </div>

  <div className="fg">
    <label className="fl">Additional Details (optional)</label>
    <textarea
      className="fi"
      rows="3"
      placeholder="Any specific requirements..."
      value={details}
      onChange={(e) => setDetails(e.target.value)}
    />
  </div>

  <button className="btn-whatsapp" onClick={handleSubmit}>
  Request Corporate Account Access
</button>
<p style={{ fontSize: "12px", color: "#999", marginTop: "14px" }}>
  Suitable for businesses of all sizes — from occasional bookings to ongoing travel requirements.
</p>
</div>
      </div>
    </section>
  );
}
function Services() { const [active, setActive] = useState(0); const s = SERVICES[active]; return <section className="sec" id="services"><div className="wrap"><div className="s-label">Services</div><h2 className="s-h">Every journey,<br/><em>handled.</em></h2><div className="svc-layout"><nav className="svc-nav">{SERVICES.map((x, i) => <button key={x.label} className={`svc-nav-item${active === i ? " active" : ""}`} onClick={() => setActive(i)}>{x.label}</button>)}</nav><div className="svc-content"><h3 className="svc-content-h">{s.h}</h3><p className="svc-desc">{s.d}</p><ul className="svc-feat-list"><li>Fixed fare confirmed at booking</li><li>Direct WhatsApp confirmation</li><li>Premium electric BMW i5</li></ul><a href="#book" className="btn-o">Get Fare Estimate</a></div></div></div></section>; }
function Why() { return <section className="sec dark" id="about"><div className="wrap why-layout"><div><div className="s-label inv">Why VÉRNO</div><h2 className="s-h inv">A boutique<br/><em>standard.</em></h2><p className="s-body">Small fleet. Consistent quality. Every detail considered.</p></div><div className="why-grid">{["Fully electric", "Discreet by design", "Small, intentional fleet", "Direct booking"].map((t, i) => <div key={t} className="why-cell"><span className="why-n">0{i+1}</span><div className="why-t">{t}</div><p className="why-d">Premium, private, and consistent chauffeur service across Melbourne.</p></div>)}</div></div></section>; }
function Areas() { const areas = ["Melbourne CBD", "St Kilda & South Yarra", "Mornington Peninsula", "Yarra Valley", "Melbourne Airport", "Avalon Airport", "Geelong & Surf Coast", "Greater Melbourne"]; return <section className="sec" id="areas"><div className="wrap"><div className="s-label">Coverage</div><h2 className="s-h">Across Melbourne<br/><em>and beyond.</em></h2><div className="areas-list">{areas.map((name) => <div key={name} className="area-item" onClick={() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth" })}><div className="area-name">{name}</div><div className="area-time">Premium transfers</div><p className="area-desc">Private chauffeur service with fixed fare confirmation.</p></div>)}</div></div></section>; }
function Fleet() { return <section className="sec fleet-section" id="fleet"><div className="wrap"><div className="s-label inv">The Fleet</div><div className="fleet-layout"><div className="fleet-img-wrap"><img src={FLEET_IMG} alt="VERNO BMW i5 fleet" className="fleet-img" loading="lazy"/></div><div className="fleet-text"><p className="fleet-text-eyebrow">All-Electric Fleet</p><h2 className="fleet-text-title">BMW i5<br/><em>eDrive40</em></h2><p className="fleet-text-sub">Zero emissions. Executive comfort. Built for Melbourne.</p><p className="fleet-text-body">VÉRNO operates premium electric vehicles for comfort, consistency, and a seamless journey.</p><div className="fleet-ev-badge">100% Electric - BMW i5</div></div></div></div></section>; }
function Process() { return <section className="sec night2"><div className="wrap"><div className="s-label inv">How It Works</div><h2 className="s-h inv">Simple to arrange.<br/><em>Seamless to experience.</em></h2><div className="proc-track">{["Arrange your transfer", "Receive confirmation", "Arrive in comfort"].map((n, i) => <div key={n} className="proc-step"><span className="proc-roman">{["I", "II", "III"][i]}</span><div className="proc-name">{n}</div><p className="proc-desc">Submit details, receive confirmation, and travel in a premium BMW i5.</p></div>)}</div></div></section>; }
function Moments() { return <section className="moments"><div className="moments-inner"><div className="moments-img-wrap"><img src={MOMENTS_MAIN} alt="VERNO BMW i5" className="moments-img" loading="lazy"/><span className="moments-geo">Melbourne - Private Transfers</span></div><div className="moments-text"><p className="moments-eyebrow">Moments</p><h2 className="moments-title">Refined.<br/>Quiet.<br/><em>Consistent.</em></h2><div className="moments-rule"/><p className="moments-desc">Every journey is designed to feel effortless - from the first message to final arrival.</p></div></div></section>; }
function Testimonials() {
  return (
    <section className="sec">
      <div className="wrap">
        <div className="s-label">Client Experience</div>

        <h2 className="s-h">
          A service defined by consistency.
        </h2>

        <div style={{ maxWidth: "520px", marginTop: "20px" }}>
          <p style={{ color: "#555", lineHeight: "1.7" }}>
            Every journey is handled with precision, discretion and care.
          </p>

          <p style={{ color: "#999", fontSize: "13px", marginTop: "12px" }}>
            Verified client feedback will be shared here as VÉRNO continues to grow.
          </p>
        </div>
      </div>
    </section>
  );
}
function Closer() { return <section className="closer" id="contact"><div className="closer-inner"><p className="s-label inv closer-label">Melbourne, Victoria</p><h2 className="closer-h">Ready when<br/><em>you are.</em></h2><p className="closer-sub">Reserve your transfer directly. Instant confirmation, fixed price.</p><div className="closer-btns"><a href="#book" className="btn-wa">Reserve via WhatsApp</a><a href={`mailto:${VERNO_EMAIL}?subject=Booking Request`} className="btn-outline">Send an Email</a></div></div></section>; }
function Footer() {
  return (
    <footer>
      <div className="ft-grid">
        <div>
          <VernoMark h={32}/>
          <p className="ft-tagline">Private electric chauffeur for Melbourne.</p>
          <a href={`mailto:${VERNO_EMAIL}`} className="ft-msg-link">
            <MsgIcon s={12}/>{VERNO_EMAIL}
          </a>
        </div>

        <div>
          <p className="ft-col-h">Services</p>
          <ul className="ft-links">
            <li><a href="#services">Airport Transfers</a></li>
            <li><a href="#services">Corporate Travel</a></li>
            <li><a href="#services">Private Hire</a></li>
          </ul>
        </div>

        <div>
          <p className="ft-col-h">Coverage</p>
          <ul className="ft-links">
            <li><a href="#areas">Melbourne CBD</a></li>
            <li><a href="#areas">Melbourne Airport</a></li>
            <li><a href="#areas">Mornington Peninsula</a></li>
          </ul>
        </div>

        <div>
          <p className="ft-col-h">Reservations</p>
          <ul className="ft-links">
            <li><a href="#book">Fare Estimate</a></li>
            <li><a href={`mailto:${VERNO_EMAIL}`}>{VERNO_EMAIL}</a></li>
          </ul>
        </div>
      </div>

      <div className="ft-bottom">
        <p>© 2025 VÉRNO Private Chauffeur - Melbourne</p>
        <p>Melbourne - Airport - Corporate</p>
      </div>

      {/* 🔥 SEO */}
      <p
        style={{
          maxWidth: "1200px",
          margin: "18px auto 0",
          fontSize: "11px",
          color: "rgba(255,255,255,.25)",
          textAlign: "center"
        }}
      >
        Melbourne chauffeur service | Airport transfers Melbourne | Private driver Melbourne
      </p>

      {/* 🔥 TRUST (EN KRİTİK EKLEME) */}
      <p
        style={{
          maxWidth: "1200px",
          margin: "12px auto 0",
          fontSize: "11px",
          color: "rgba(255,255,255,.32)",
          textAlign: "center"
        }}
      >
        Licensed Chauffeur Service — Airport & Corporate Transfers — Melbourne, Victoria
      </p>

      <p
        style={{
          maxWidth: "1200px",
          margin: "4px auto 0",
          fontSize: "10px",
          color: "rgba(255,255,255,.22)",
          textAlign: "center"
        }}
      >
        Registered CPV Operator — ABN 37 903 967 567
      </p>

    </footer>
  );
}
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0} html{scroll-behavior:smooth} :root{--black:#111;--white:#fff;--gold:#9E8A6A;--gold2:#B8A48A;--grey1:#F5F5F5;--grey2:#EBEBEB;--grey3:#999;--grey4:#666;--wa:#128C7E;--serif:'Playfair Display',Georgia,serif;--sans:'Inter',Arial,sans-serif} body{font-family:var(--sans);background:#fff;color:#111;-webkit-font-smoothing:antialiased;overflow-x:hidden} a{text-decoration:none;color:inherit} button,input,select{font-family:var(--sans)}
.nav{
  position:fixed;
  top:0;
  left:0;
  right:0;
  z-index:100;
  height:82px;
  padding:0 5vw;
  display:flex;
  align-items:center;
  justify-content:space-between;
  background:transparent;
  border-bottom:1px solid transparent;
}
.nav.solid{
  background:rgba(12,12,12,.86);
  backdrop-filter:blur(16px);
  border-color:rgba(255,255,255,.08);
}
.nav-links{
  display:flex;
  gap:2.4rem;
  list-style:none;
}
.nav-links a,.nav-btn{
  font-size:.72rem;
  text-transform:uppercase;
  letter-spacing:.14em;
  color:rgba(255,255,255,.72);
}
.nav-btn{
  border:1px solid rgba(184,164,138,.65);
  padding:.85rem 1.7rem;
}
.nav-right{display:flex;align-items:center}
.hamburger,.mob-drawer{display:none}

.hero{
  position:relative;
  min-height:100vh;
  padding:120px 5vw 0;
  background:
    linear-gradient(90deg, rgba(8,8,8,.96) 0%, rgba(8,8,8,.83) 34%, rgba(8,8,8,.42) 62%, rgba(8,8,8,.55) 100%),
    linear-gradient(180deg, rgba(8,8,8,.18) 0%, rgba(8,8,8,.72) 100%),
    url("/images/hero-bg.jpg") center/cover no-repeat;
  color:#fff;
  overflow:hidden;
}
.hero::after{
  content:"";
  position:absolute;
  left:0;
  right:0;
  bottom:0;
  height:160px;
  background:linear-gradient(to bottom, transparent, rgba(10,10,10,.92));
  pointer-events:none;
}
.hero-content{
  position:relative;
  z-index:2;
  min-height:calc(100vh - 120px);
  max-width:1280px;
  margin:0 auto;
  display:grid;
  grid-template-columns:minmax(0, 1.05fr) 460px;
  gap:7vw;
  align-items:center;
}
.hero-left{
  padding-bottom:5vh;
}
.hero-label{
  font-size:.72rem;
  font-weight:500;
  letter-spacing:.22em;
  text-transform:uppercase;
  color:#b89870;
  margin-bottom:1.8rem;
}
.hero-h1{
  font-family:var(--serif);
  font-size:clamp(3.9rem,5.4vw,6.2rem);
  font-weight:400;
  line-height:1.08;
  letter-spacing:-.035em;
  color:#fff;
  margin-bottom:1.9rem;
  max-width:820px;
}

.hero-h1 span{
  display:block;
  font-style:normal;
  font-weight:400;
  color:#fff;
}

.hero-h1 em{
  display:block;
  font-style:italic;
  font-weight:400;
  color:rgba(255,255,255,.94);
  margin-top:.05em;
  white-space:nowrap;
}

@media(max-width:768px){
  .hero-h1{
    font-size:3rem;
    line-height:1.08;
  }

  .hero-h1 em{
    white-space:normal;
  }
}
.hero-sub{
  max-width:520px;
  font-size:1.02rem;
  line-height:1.65;
  font-weight:300;
  color:rgba(255,255,255,.62);
  margin-bottom:2.5rem;
}
.hero-actions{
  display:flex;
  align-items:center;
  gap:1.6rem;
  flex-wrap:wrap;
}
.btn-wa,.btn-p,.btn-o,.btn-outline{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:.65rem;
  padding:1rem 1.9rem;
  font-size:.8rem;
  font-weight:600;
  letter-spacing:.08em;
  text-transform:uppercase;
}
.btn-wa{background:var(--wa);color:#fff}
.hero-gold{
  background:#b18a55;
  color:#fff;
}
.btn-outline,.hero-outline{
  border:1px solid rgba(184,164,138,.7);
  color:#fff;
  background:rgba(0,0,0,.08);
}
.hero-trust{
  display:flex;
  align-items:center;
  gap:2.2rem;
  flex-wrap:wrap;
  margin-top:2.6rem;
}
.hero-trust div{
  font-size:.7rem;
  color:rgba(255,255,255,.56);
  letter-spacing:.13em;
  text-transform:uppercase;
}
.hero-service-panel{
  width:100%;
  border:1px solid rgba(184,164,138,.38);
  border-radius:16px;
  background:rgba(10,10,10,.48);
  backdrop-filter:blur(12px);
  overflow:hidden;
  box-shadow:0 25px 70px rgba(0,0,0,.34);
}
.hero-service-row{
  display:grid;
  grid-template-columns:70px 1fr;
  gap:1.2rem;
  padding:2rem;
  border-bottom:1px solid rgba(255,255,255,.09);
}
.hero-service-row:last-child{
  border-bottom:none;
}
.hero-service-icon{
  width:54px;
  height:54px;
  border-radius:999px;
  border:1px solid rgba(184,164,138,.35);
  display:flex;
  align-items:center;
  justify-content:center;
  color:#b89870;
  font-size:1.25rem;
}
.hero-service-row h3{
  font-family:var(--serif);
  font-size:1.25rem;
  font-weight:600;
  color:#fff;
  margin-bottom:.55rem;
}
.hero-service-row p{
  font-size:.88rem;
  line-height:1.45;
  color:rgba(255,255,255,.56);
}

.trust-strip{
  background:#111;
  padding:2.2rem 5vw;
  border-top:1px solid rgba(255,255,255,.06);
  border-bottom:1px solid rgba(255,255,255,.06);
}
.trust-strip-inner{
  max-width:1100px;
  margin:auto;
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:2rem;
}
.trust-item{
  display:flex;
  gap:.8rem;
  align-items:center;
  color:rgba(255,255,255,.55);
  font-size:.72rem;
  letter-spacing:.1em;
  text-transform:uppercase;
}
.trust-item-dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#b89870;
}

@media(max-width:1024px){
  .hero-content{
    grid-template-columns:1fr;
    gap:3rem;
    padding-bottom:4rem;
  }
  .hero-service-panel{
    max-width:620px;
  }
  .trust-strip-inner{
    grid-template-columns:repeat(2,1fr);
  }
}

@media(max-width:768px){
  .nav-links,.nav-btn{display:none}
  .hero{
    min-height:auto;
    padding:100px 5vw 55px;
  }
  .hero-content{
    min-height:auto;
    display:block;
  }
  .hero-h1{
    font-size:3.2rem;
    letter-spacing:-.04em;
  }
  .hero-sub{
    font-size:.95rem;
  }
  .hero-actions{
    flex-direction:column;
    align-items:stretch;
  }
  .hero-service-panel{
    margin-top:3rem;
  }
  .hero-service-row{
    grid-template-columns:52px 1fr;
    padding:1.4rem;
  }
  .hero-service-icon{
    width:42px;
    height:42px;
  }
  .hero-trust{
    gap:1.2rem;
  }
  .trust-strip-inner{
    grid-template-columns:1fr;
  }
}

.btn-wa,.btn-p,.btn-o,.btn-outline{display:inline-flex;align-items:center;gap:.6rem;padding:1rem 1.8rem;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase}.btn-wa{background:var(--wa);color:#fff}.btn-p{background:var(--gold);color:#fff}.btn-outline{border:1px solid rgba(255,255,255,.22);color:rgba(255,255,255,.7)}.btn-o{border:1px solid #e5e5e5;color:#555}.trust-strip{background:#111;padding:.85rem 5vw;border-top:1px solid rgba(255,255,255,.06)}.trust-strip-inner{max-width:1200px;margin:auto;display:flex;gap:2rem;flex-wrap:wrap}.trust-item{display:flex;gap:.5rem;align-items:center;color:rgba(255,255,255,.4);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase}.trust-item-dot{width:3px;height:3px;border-radius:50%;background:var(--gold)}
.booking-panel{padding:7rem 5vw}.booking-panel-inner{max-width:1200px;margin:auto;display:grid;grid-template-columns:1fr 1.5fr;gap:7rem}.booking-panel-headline,.s-h{font-family:var(--serif);font-size:clamp(2rem,4vw,3.4rem);font-weight:400;line-height:1.1;margin-bottom:2rem}.booking-panel-headline{font-size:clamp(1.8rem,2.5vw,2.4rem)}.booking-panel-headline em,.s-h em,.fleet-text-title em,.closer-h em{color:var(--gold);font-style:normal}.booking-panel-sub,.svc-desc,.area-desc{font-size:.9rem;line-height:1.75;color:#666;font-weight:300}.fg{position:relative;margin-bottom:1.3rem}.fl{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#666;margin-bottom:.5rem}.fi{width:100%;padding:.9rem 1rem;background:#f5f5f5;border:1px solid transparent;outline:none}.fi:focus{background:#fff;border-color:var(--gold)}.f2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}.quick-chip{border:1px solid rgba(158,138,106,.35);color:var(--gold);padding:.45rem 1rem;margin-bottom:1.5rem;font-size:.7rem;text-transform:uppercase;letter-spacing:.06em}.quick-chip-dot{display:inline-block;width:5px;height:5px;background:var(--wa);border-radius:50%;margin-right:.5rem}.ac-list{position:absolute;top:100%;left:0;right:0;background:#fff;z-index:10;border:1px solid #eee;box-shadow:0 8px 20px rgba(0,0,0,.08)}.ac-item{width:100%;text-align:left;padding:.8rem 1rem;border-bottom:1px solid #eee}.ac-item-main{display:block;font-weight:500}.ac-item-sub{font-size:.72rem;color:#999}
.fare-estimate{margin-top:1.5rem;background:#111;color:#fff;padding:2rem}.fare-label{font-size:.65rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:.7rem}.fare-price{font-family:var(--serif);font-size:4rem;line-height:1}.fare-guarantee{color:rgba(255,255,255,.35);font-size:.75rem}.fare-trust{display:flex;gap:1rem;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.08);padding-top:1rem;margin-top:1rem;color:rgba(255,255,255,.35);font-size:.7rem}.btn-whatsapp{width:100%;display:flex;justify-content:center;align-items:center;gap:.6rem;background:var(--wa);color:#fff;padding:1.1rem;margin-top:1.5rem;border:0;font-weight:600}.btn-wa-note,.btn-email-secondary{font-size:.75rem;color:#999;text-align:center;margin-top:.8rem;display:block}
.sec{padding:9rem 5vw}.sec.dark{background:#111}.night2{background:#0a0a0a}.wrap{max-width:1200px;margin:auto}.inv{color:var(--gold)}.s-h.inv{color:#fff}.svc-layout{display:grid;grid-template-columns:210px 1fr;gap:5rem;margin-top:4rem}.svc-nav{display:flex;flex-direction:column}.svc-nav-item{text-align:left;padding:1rem 0;border-bottom:1px solid #e5e5e5;color:#999}.svc-nav-item.active{color:#111;font-weight:600}.svc-content-h,.fleet-text-title,.closer-h{font-family:var(--serif);font-size:clamp(1.8rem,3vw,2.6rem);font-weight:400;line-height:1.15;margin-bottom:1rem}.svc-feat-list{list-style:none;display:grid;gap:.7rem;margin:1.5rem 0;color:#555}.svc-note-clean{border-top:1px solid #eee;padding-top:1rem;color:#999;font-size:.8rem}
.why-layout{display:grid;grid-template-columns:320px 1fr;gap:6rem}.s-body{color:rgba(255,255,255,.5);line-height:1.75}.why-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(255,255,255,.1)}.why-cell{padding:2rem;border-bottom:1px solid rgba(255,255,255,.1)}.why-n{color:var(--gold);font-size:.7rem}.why-t{font-family:var(--serif);color:#fff;margin:.7rem 0}.why-d{color:rgba(255,255,255,.4);font-size:.85rem;line-height:1.7}.areas-list{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #eee}.area-item{padding:2rem 1rem;border-bottom:1px solid #eee;cursor:pointer}.area-name{font-family:var(--serif);margin-bottom:.4rem}.area-time{font-size:.68rem;color:var(--gold);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.6rem}
.fleet-section{background:#111}.fleet-layout{display:grid;grid-template-columns:1.1fr 1fr;gap:6rem;align-items:center}.fleet-img-wrap,.moments-img-wrap{background:#1a1a1a;min-height:340px;overflow:hidden}.fleet-img{width:100%;min-height:340px;object-fit:cover}.fleet-text-eyebrow{color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.12em;font-size:.7rem}.fleet-text-title,.fleet-text-sub,.fleet-text-body{color:#fff}.fleet-text-sub,.fleet-text-body{color:rgba(255,255,255,.45);line-height:1.75}.fleet-text-specs{border-top:1px solid rgba(255,255,255,.08);padding-top:1rem;margin-top:1rem;display:grid;gap:.6rem}.fleet-spec-item{color:rgba(255,255,255,.45);font-size:.85rem}.fleet-ev-badge{display:inline-flex;color:var(--gold);border:1px solid rgba(158,138,106,.35);padding:.4rem .8rem;margin-top:1rem;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase}
.proc-track{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(255,255,255,.08);margin-top:3rem}.proc-step{padding:2rem;border-right:1px solid rgba(255,255,255,.08)}.proc-roman{font-size:2rem;color:var(--gold);opacity:.4}.proc-name{font-family:var(--serif);color:#fff;margin:1rem 0}.proc-desc{color:rgba(255,255,255,.4);font-size:.85rem;line-height:1.7}.moments{background:#111;padding:8rem 5vw}.moments-inner{max-width:1200px;margin:auto;display:grid;grid-template-columns:1.35fr 1fr;gap:7rem;align-items:center}.moments-img{width:100%;aspect-ratio:16/9;object-fit:cover}.moments-geo{position:absolute;left:1rem;bottom:1rem;color:rgba(255,255,255,.6);font-size:.7rem;background:rgba(0,0,0,.4);padding:.35rem .7rem}.moments-title{font-family:var(--serif);color:#fff;font-size:clamp(2rem,3vw,3rem);font-weight:400;line-height:1.2}.moments-title em{color:rgba(255,255,255,.45)}.moments-rule{width:2.5rem;height:2px;background:var(--gold);margin:1.5rem 0}.moments-desc{color:rgba(255,255,255,.45);line-height:1.75}.testi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#eee}.testi{background:#fff;padding:2.5rem}.testi-mark{font-family:var(--serif);font-size:2rem;color:var(--gold)}.testi-txt{font-family:var(--serif);font-style:italic;line-height:1.75}.testi-by{font-size:.7rem;color:#999;text-transform:uppercase;letter-spacing:.08em}.closer{background:#111;color:#fff;padding:10rem 5vw;text-align:center}.closer-inner{max-width:640px;margin:auto}.closer-sub,.closer-note{color:rgba(255,255,255,.35)}.closer-btns{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:3rem}footer{background:#080808;color:#fff;padding:5rem 5vw 2.5rem}.ft-grid{max-width:1200px;margin:auto;display:grid;grid-template-columns:1.8fr 1fr 1fr 1fr;gap:4rem}.ft-tagline,.ft-msg-link,.ft-links a,.ft-bottom p{color:rgba(255,255,255,.32);font-size:.8rem}.ft-col-h{font-size:.65rem;text-transform:uppercase;letter-spacing:.14em;color:rgba(255,255,255,.25);margin-bottom:1rem}.ft-links{list-style:none;display:grid;gap:.5rem}.ft-bottom{max-width:1200px;margin:4rem auto 0;border-top:1px solid rgba(255,255,255,.08);padding-top:2rem;display:flex;justify-content:space-between}.wa-float{position:fixed;right:2rem;bottom:2rem;background:var(--wa);color:#fff;padding:.8rem 1.3rem;z-index:999;display:flex;gap:.6rem;align-items:center;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;font-weight:600}
@media(max-width:1024px){.booking-panel-inner,.why-layout,.fleet-layout,.moments-inner{grid-template-columns:1fr;gap:3rem}.areas-list{grid-template-columns:repeat(2,1fr)}.ft-grid{grid-template-columns:1fr 1fr}.svc-layout{grid-template-columns:1fr}.svc-nav{flex-direction:row;overflow-x:auto;gap:1rem}.svc-nav-item{white-space:nowrap}}
@media(max-width:768px){.nav-links,.nav-btn{display:none} .hero{min-height:auto;padding:100px 5vw 60px}
.hero-h1{font-size:2.8rem;letter-spacing:-.035em}
.hero-services{max-width:100%}
.hero-actions{flex-direction:column}.booking-panel,.sec{padding:5rem 5vw}.f2,.areas-list,.testi-row,.proc-track,.why-grid,.ft-grid{grid-template-columns:1fr}.ft-bottom{flex-direction:column}.closer-btns{flex-direction:column}.btn-wa,.btn-outline,.btn-p,.btn-o{width:100%;justify-content:center}.wa-float{right:1rem;bottom:1rem}}
/* PREMIUM DARK GOLD STYLE PATCH */

:root{
  --gold:#D2B06D;
  --gold2:#C49A5A;
  --soft-gold:rgba(210,176,109,.72);
  --panel:#050505;
  --panel-border:rgba(210,176,109,.28);
  --text-muted:rgba(255,255,255,.48);
}

.verno-logo{
  display:flex;
  flex-direction:column;
  align-items:flex-start;
  line-height:1;
}

.verno-logo-top{
  display:flex;
  align-items:center;
  gap:10px;
}

.verno-dot{
  width:9px;
  height:9px;
  border-radius:50%;
  background:var(--gold);
  display:inline-block;
}

.verno-word{
  font-family:var(--serif);
  font-size:24px;
  font-weight:600;
  letter-spacing:.22em;
  color:#fff;
}

.verno-city{
  margin-left:29px;
  margin-top:5px;
  font-family:var(--sans);
  font-size:8px;
  letter-spacing:.42em;
  color:rgba(255,255,255,.36);
}

.hero{
  background:
    linear-gradient(90deg, rgba(4,4,4,.98) 0%, rgba(4,4,4,.9) 38%, rgba(4,4,4,.48) 68%, rgba(4,4,4,.72) 100%),
    linear-gradient(180deg, rgba(4,4,4,.08) 0%, rgba(4,4,4,.88) 100%),
    url("/images/hero-bg.jpg") center/cover no-repeat;
}

.hero-label{
  color:var(--gold);
  letter-spacing:.26em;
}

.hero-h1{
  font-size:clamp(3.4rem,5vw,5.8rem);
  line-height:1.08;
  letter-spacing:-.03em;
}

.hero-h1 span{
  display:block;
  font-style:normal;
  color:#fff;
}

.hero-h1 em{
  display:block;
  font-style:italic;
  color:rgba(255,255,255,.92);
  white-space:nowrap;
}

.hero-line{
  background:var(--gold);
}

.hero-sub{
  color:rgba(255,255,255,.55);
}

.hero-gold{
  background:var(--gold) !important;
  color:#080808 !important;
  border:1px solid var(--gold) !important;
}

.hero-outline{
  border:1px solid rgba(210,176,109,.5) !important;
  color:rgba(255,255,255,.82) !important;
  background:rgba(255,255,255,.02) !important;
}

.hero-service-panel{
  background:rgba(3,3,3,.74);
  border:1px solid var(--panel-border);
  border-radius:28px;
  backdrop-filter:blur(22px);
  box-shadow:
    0 30px 90px rgba(0,0,0,.55),
    inset 0 0 0 1px rgba(210,176,109,.08);
}

.hero-service-row{
  grid-template-columns:80px 1fr;
  padding:2.25rem 2.3rem;
  border-bottom:1px solid rgba(255,255,255,.08);
}

.hero-service-icon{
  width:58px;
  height:58px;
  border-radius:50%;
  border:1px solid rgba(210,176,109,.35);
  background:rgba(210,176,109,.06);
  color:var(--gold);
  font-size:1.65rem;
  font-weight:300;
}

.hero-service-row h3{
  font-family:var(--serif);
  font-size:1.35rem;
  font-weight:600;
  color:#fff;
}

.hero-service-row p{
  font-size:.95rem;
  line-height:1.55;
  color:rgba(255,255,255,.48);
}

.btn-whatsapp,
.wa-float{
  background:var(--gold) !important;
  color:#080808 !important;
}

.nav-btn{
  border-color:rgba(210,176,109,.55);
}

@media(max-width:768px){
  .hero-h1{
    font-size:3rem;
  }

  .hero-h1 em{
    white-space:normal;
  }

  .hero-service-panel{
    border-radius:24px;
  }
}
/* FINAL CINEMATIC HERO PATCH */

:root{
  --gold:#B98B55;
  --gold-soft:#C9A46D;
  --burnt:#8C5F35;
}

.hero{
  min-height:78vh;
  padding:105px 5vw 0;
  background:
    radial-gradient(circle at 88% 42%, rgba(185,139,85,.34), transparent 28%),
    linear-gradient(90deg, rgba(5,5,5,.97) 0%, rgba(8,8,8,.88) 38%, rgba(8,8,8,.42) 66%, rgba(8,8,8,.58) 100%),
    linear-gradient(180deg, rgba(5,5,5,.18) 0%, rgba(5,5,5,.78) 100%),
    url("/images/hero-bg.jpg") center/cover no-repeat;
}

.hero-content{
  min-height:calc(78vh - 105px);
  grid-template-columns:minmax(0, 1.05fr) 390px;
  gap:6vw;
  align-items:center;
}

.hero-label{
  color:#C29A66;
}

.hero-h1{
  font-size:clamp(3.1rem,4.55vw,5.25rem);
  line-height:1.02;
  letter-spacing:-.035em;
  max-width:720px;
}

.hero-h1 span{
  display:block;
  font-style:normal;
}

.hero-h1 em{
  display:block;
  font-style:italic;
  white-space:normal;
  color:rgba(255,255,255,.9);
}

.hero-line{
  background:#C29A66;
  width:46px;
}

.hero-sub{
  font-size:.95rem;
  color:rgba(255,255,255,.55);
}

.hero-gold{
  background:linear-gradient(180deg,#C49A60,#A8753F) !important;
  color:#fff !important;
  border:1px solid rgba(201,164,109,.65) !important;
}

.hero-outline{
  border-color:rgba(201,164,109,.58) !important;
}

.hero-service-panel{
  width:390px;
  border-radius:18px;
  background:rgba(10,10,10,.34);
  backdrop-filter:blur(8px);
  border:1px solid rgba(201,164,109,.26);
  box-shadow:0 25px 70px rgba(0,0,0,.35);
}

.hero-service-row{
  grid-template-columns:58px 1fr;
  padding:1.55rem 1.7rem;
}

.hero-service-icon{
  width:46px;
  height:46px;
  color:#C29A66;
  border-color:rgba(194,154,102,.36);
  background:rgba(194,154,102,.06);
  font-size:1.25rem;
}

.hero-service-row h3{
  font-size:1.04rem;
}

.hero-service-row p{
  font-size:.78rem;
  color:rgba(255,255,255,.52);
}

.hero-trust{
  color:#B98B55;
}

.trust-strip{
  background:rgba(18,18,18,.96);
  padding:2.25rem 5vw;
  border-top:1px solid rgba(201,164,109,.11);
  border-bottom:1px solid rgba(201,164,109,.11);
}

.trust-strip-inner{
  max-width:1050px;
  margin:auto;
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:0;
}

.trust-feature{
  display:grid;
  grid-template-columns:52px 1fr;
  gap:1.3rem;
  align-items:flex-start;
  padding:0 2.6rem;
  border-right:1px solid rgba(255,255,255,.08);
}

.trust-feature:last-child{
  border-right:none;
}

.trust-icon{
  color:#B98B55;
  opacity:.95;
}

.trust-feature h4{
  font-size:.72rem;
  color:rgba(255,255,255,.9);
  letter-spacing:.14em;
  text-transform:uppercase;
  margin-bottom:.55rem;
}

.trust-feature p{
  font-size:.82rem;
  line-height:1.65;
  color:rgba(255,255,255,.42);
}

.wa-float{
  background:#128C7E !important;
  color:#fff !important;
}

@media(max-width:1024px){
  .hero{
    min-height:auto;
    padding-bottom:3rem;
  }

  .hero-content{
    grid-template-columns:1fr;
  }

  .hero-service-panel{
    width:100%;
    max-width:520px;
  }

  .trust-strip-inner{
    grid-template-columns:1fr;
    gap:2rem;
  }

  .trust-feature{
    border-right:none;
    padding:0;
  }
}
/* HERO TITLE FINAL - TWO LINE PREMIUM */

.hero-h1{
  font-family:var(--serif);
  font-size:clamp(3.35rem,4.75vw,5.45rem);
  line-height:1.03;
  letter-spacing:-0.035em;
  max-width:760px;
  margin-bottom:1.7rem;
}

.hero-h1 span{
  display:block;
  font-style:normal;
  font-weight:400;
  color:#fff;
}

.hero-h1 em{
  display:block;
  font-style:italic;
  font-weight:400;
  font-size:.98em;
  color:rgba(255,255,255,.92);
  margin-top:.12em;
  white-space:nowrap;
}

@media(max-width:768px){
  .hero-h1{
    font-size:3rem;
    line-height:1.06;
  }

  .hero-h1 em{
    white-space:normal;
  }
}
/* ===== ULTRA MATCH HERO PATCH ===== */

/* BACKGROUND – daha koyu + sunset glow */
.hero{
  background:
    radial-gradient(circle at 85% 38%, rgba(255,170,90,.28), transparent 32%),
    linear-gradient(90deg, rgba(3,3,3,.98) 0%, rgba(5,5,5,.92) 35%, rgba(5,5,5,.45) 65%, rgba(5,5,5,.75) 100%),
    linear-gradient(180deg, rgba(5,5,5,.05) 0%, rgba(5,5,5,.88) 100%),
    url("/images/hero-bg.jpg") center/cover no-repeat;
}

/* HERO LAYOUT tighten */
.hero-content{
  grid-template-columns:minmax(0,1.1fr) 340px;
  gap:5vw;
}

/* TITLE – doğru weight / spacing */
.hero-h1{
  font-family:var(--serif);
  font-size:clamp(3.6rem,4.9vw,5.8rem);
  line-height:1.02;
  letter-spacing:-.045em;
  max-width:760px;
}

.hero-h1 span{
  display:block;
  font-style:normal;
  font-weight:500;
  color:#fff;
}

.hero-h1 em{
  display:block;
  font-style:italic;
  font-weight:400;
  font-size:1.02em;
  color:rgba(255,255,255,.92);
  margin-top:.05em;
}

/* ALT çizgi daha kısa */
.hero-line{
  width:38px;
  height:2px;
  margin:18px 0 22px;
  background:#C79A63;
}

/* SUBTEXT daha soft */
.hero-sub{
  font-size:.92rem;
  line-height:1.6;
  color:rgba(255,255,255,.5);
  max-width:480px;
}

/* BUTTON refine */
.hero-gold{
  background:linear-gradient(180deg,#D2A76F,#A5743E) !important;
  border:1px solid rgba(210,176,109,.7) !important;
}

.hero-outline{
  background:transparent !important;
  border:1px solid rgba(210,176,109,.55) !important;
}

/* SERVICE PANEL – daha dar + daha şeffaf */
.hero-service-panel{
  width:340px;
  border-radius:18px;
  background:rgba(10,10,10,.28);
  backdrop-filter:blur(10px);
  border:1px solid rgba(210,176,109,.22);
  box-shadow:0 30px 80px rgba(0,0,0,.45);
}

/* satırlar daha sıkı */
.hero-service-row{
  grid-template-columns:62px 1fr;
  padding:1.6rem 1.6rem;
}

/* ICONLAR – daha büyük + daha belirgin */
.hero-service-icon{
  width:54px;
  height:54px;
  border-radius:50%;
  border:1px solid rgba(210,176,109,.45);
  background:rgba(210,176,109,.08);
  color:#D2A76F;
  font-size:1.4rem;
}

/* TEXT küçült */
.hero-service-row h3{
  font-size:1.05rem;
  margin-bottom:.4rem;
}

.hero-service-row p{
  font-size:.8rem;
  color:rgba(255,255,255,.5);
}

/* TRUST STRIP – mat siyah */
.trust-strip{
  background:rgba(20,20,20,.92);
  border-top:1px solid rgba(210,176,109,.12);
  border-bottom:1px solid rgba(210,176,109,.12);
}

/* TRUST item spacing */
.trust-feature{
  padding:0 2rem;
}

/* ICON renk fix */
.trust-icon{
  color:#C79A63;
}

/* MOBILE */
@media(max-width:768px){

  .hero-content{
    grid-template-columns:1fr;
  }

  .hero-service-panel{
    width:100%;
    max-width:480px;
  }

  .hero-h1{
    font-size:3.1rem;
  }
}
/* ===== PERFECT MATCH HERO FINAL ===== */

.hero{
  background:
    radial-gradient(circle at 85% 40%, rgba(255,160,80,.25), transparent 30%),
    linear-gradient(90deg, rgba(2,2,2,.98) 0%, rgba(4,4,4,.93) 35%, rgba(4,4,4,.5) 65%, rgba(4,4,4,.78) 100%),
    linear-gradient(180deg, rgba(2,2,2,.05) 0%, rgba(2,2,2,.9) 100%),
    url("/images/hero-bg.jpg") center/cover no-repeat;
}

.hero-content{
  grid-template-columns:minmax(0,1.1fr) 320px;
  gap:4.5vw;
}

.hero-h1{
  font-family:var(--serif);
  font-size:clamp(3.8rem,5vw,6rem);
  line-height:1.01;
  letter-spacing:-.05em;
  max-width:780px;
}

.hero-h1 span{
  display:block;
  font-style:normal;
  font-weight:500;
  color:#fff;
}

.hero-h1 em{
  display:block;
  font-style:italic;
  font-weight:400;
  font-size:1.04em;
  color:rgba(255,255,255,.92);
  margin-top:.02em;
}

.hero-line{
  width:34px;
  height:2px;
  margin:20px 0 24px;
  background:#C79A63;
}

.hero-sub{
  font-size:.9rem;
  line-height:1.6;
  color:rgba(255,255,255,.48);
  max-width:460px;
}

.hero-gold{
  background:linear-gradient(180deg,#D4A96F,#A8753F) !important;
  border:1px solid rgba(212,169,111,.75) !important;
  color:#fff !important;
}

.hero-outline{
  background:transparent !important;
  border:1px solid rgba(212,169,111,.55) !important;
  color:#fff !important;
}

.hero-service-panel{
  width:320px;
  border-radius:20px;
  background:rgba(8,8,8,.28);
  backdrop-filter:blur(12px);
  border:1px solid rgba(212,169,111,.22);
  box-shadow:0 30px 90px rgba(0,0,0,.5);
}

.hero-service-row{
  grid-template-columns:64px 1fr;
  padding:1.6rem 1.6rem;
}

.hero-service-icon{
  width:56px;
  height:56px;
  border-radius:50%;
  border:1px solid rgba(212,169,111,.45);
  background:rgba(212,169,111,.08);
  color:#D4A96F;
  font-size:1.5rem;
}

.hero-service-row h3{
  font-size:1.05rem;
  margin-bottom:.4rem;
}

.hero-service-row p{
  font-size:.78rem;
  color:rgba(255,255,255,.48);
}

.trust-strip{
  background:rgba(18,18,18,.9);
  border-top:1px solid rgba(212,169,111,.1);
  border-bottom:1px solid rgba(212,169,111,.1);
}

.trust-strip-inner{
  grid-template-columns:repeat(3,1fr);
}

.trust-feature{
  padding:0 2.2rem;
}

.trust-icon{
  color:#C79A63;
}

@media(max-width:768px){

  .hero-content{
    grid-template-columns:1fr;
  }

  .hero-service-panel{
    width:100%;
    max-width:480px;
  }

  .hero-h1{
    font-size:3.2rem;
  }
}
.hero-top{
  display:block;
  font-family:var(--serif);
  font-weight:600;
  font-size:.85em;
  letter-spacing:-.02em;
  color:#fff;
}

.hero-bottom{
  display:block;
  font-family:var(--serif);
  font-style:italic;
  font-weight:400;
  font-size:1.2em;
  letter-spacing:-.04em;
  color:rgba(255,255,255,.92);
  margin-top:-6px;
}
/* HERO TITLE EXACT FIX */

.hero-h1{
  font-family:var(--serif) !important;
  line-height:.95 !important;
  letter-spacing:-.055em !important;
  margin-bottom:1.8rem !important;
  max-width:720px !important;
}

.hero-h1 .hero-top{
  display:block !important;
  font-style:normal !important;
  font-weight:600 !important;
  font-size:clamp(3.6rem,5vw,5.8rem) !important;
  color:#fff !important;
}

.hero-h1 .hero-bottom{
  display:block !important;
  font-style:italic !important;
  font-weight:400 !important;
  font-size:clamp(3.45rem,4.8vw,5.55rem) !important;
  color:rgba(255,255,255,.92) !important;
  margin-top:.05rem !important;
  white-space:nowrap !important;
}

@media(max-width:768px){
  .hero-h1 .hero-top,
  .hero-h1 .hero-bottom{
    font-size:3rem !important;
    white-space:normal !important;
  }
}
.hero-service-icon{
  width:78px !important;
  height:78px !important;
  min-width:78px !important;

  border-radius:50%;
  border:1.5px solid rgba(210,176,109,.55);

  display:flex;
  align-items:center;
  justify-content:center;

  background:rgba(210,176,109,.05);
}

/* ICON SIZE + STYLE */
.hero-service-icon svg{
  width:38px !important;
  height:38px !important;
  color:#D2B06D;
}

/* ROW spacing */
.hero-service-row{
  grid-template-columns:96px 1fr !important;
  padding:1.9rem 1.8rem !important;
}

/* PANEL */
.hero-service-panel{
  width:360px !important;
  background:rgba(10,10,10,.30) !important;
  backdrop-filter:blur(14px);
  border:1px solid rgba(210,176,109,.25);
}
.hero-service-icon{
  width:72px !important;
  height:72px !important;
  min-width:72px !important;
  border-radius:999px !important;
  border:1.4px solid rgba(210,176,109,.48) !important;
  background:rgba(210,176,109,.055) !important;
  color:#D2B06D !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
}

.hero-service-icon svg{
  width:38px !important;
  height:38px !important;
  display:block !important;
}

.hero-service-row{
  grid-template-columns:92px 1fr !important;
}
.hero-service-icon{
  width:68px !important;
  height:68px !important;
  border-radius:50% !important;
  border:1.4px solid rgba(210,176,109,.45) !important;
  background:rgba(210,176,109,.055) !important;
  color:#D2B06D !important;
  display:flex !important;
  align-items:center !important;
  justify-content:center !important;
  flex-shrink:0 !important;
}

.lux-icon{
  width:38px;
  height:38px;
  fill:none;
  stroke:currentColor;
  stroke-width:3.2;
  stroke-linecap:round;
  stroke-linejoin:round;
}

.hero-service-row{
  grid-template-columns:92px 1fr !important;
  gap:1.25rem !important;
  padding:2.05rem 2.15rem !important;
}

.hero-service-row h3{
  font-size:1.34rem !important;
}

.hero-service-row p{
  font-size:.92rem !important;
}

.hero-trust{
  display:flex !important;
  align-items:center !important;
  gap:2.2rem !important;
}

.hero-trust-item{
  display:flex !important;
  align-items:center !important;
  gap:.55rem !important;
  font-size:.68rem !important;
  letter-spacing:.13em !important;
  text-transform:uppercase !important;
  color:rgba(255,255,255,.56) !important;
}

.trust-small-icon{
  width:19px;
  height:19px;
  fill:none;
  stroke:#B98B55;
  stroke-width:1.7;
  stroke-linecap:round;
  stroke-linejoin:round;
  flex-shrink:0;
}
/* FINAL SUNSET CINEMATIC HERO PATCH */

.hero{
  min-height:78vh;
  padding:105px 5vw 0;
  background:
    radial-gradient(circle at 88% 38%, rgba(255,185,95,.42) 0%, rgba(210,125,45,.25) 18%, transparent 43%),
    radial-gradient(circle at 70% 18%, rgba(255,210,135,.18) 0%, transparent 34%),
    linear-gradient(90deg, rgba(3,3,3,.86) 0%, rgba(5,5,5,.74) 33%, rgba(5,5,5,.36) 58%, rgba(5,5,5,.22) 100%),
    linear-gradient(180deg, rgba(4,4,4,.08) 0%, rgba(4,4,4,.64) 100%),
    url("/images/hero-bg.jpg") center/cover no-repeat;
}

.hero::after{
  height:150px;
  background:linear-gradient(to bottom, transparent, rgba(8,8,8,.88));
}

.hero-content{
  min-height:calc(78vh - 105px);
  grid-template-columns:minmax(0, 1fr) 370px;
  gap:6.2vw;
  align-items:center;
}

.hero-left{
  padding-bottom:3vh;
}

.hero-h1{
  font-size:clamp(3rem,4.25vw,4.85rem);
  line-height:1.05;
  letter-spacing:-.028em;
  max-width:760px;
}

.hero-h1 span{
  display:block;
  font-style:normal;
  font-weight:600;
  color:#fff;
}

.hero-h1 em{
  display:block;
  font-style:italic;
  font-weight:400;
  font-size:.96em;
  color:rgba(255,255,255,.92);
  white-space:nowrap;
  margin-top:.03em;
}

.hero-label{
  color:#D0A064;
}

.hero-line{
  width:48px;
  background:#D0A064;
}

.hero-sub{
  max-width:520px;
  font-size:.95rem;
  color:rgba(255,255,255,.62);
}

.hero-service-panel{
  width:370px;
  border-radius:18px;
  background:rgba(12,9,7,.36);
  border:1px solid rgba(208,160,100,.34);
  backdrop-filter:blur(10px);
  box-shadow:
    0 26px 75px rgba(0,0,0,.38),
    inset 0 0 42px rgba(208,135,65,.08);
}

.hero-service-row{
  grid-template-columns:68px 1fr;
  padding:1.65rem 1.75rem;
  border-bottom:1px solid rgba(255,255,255,.13);
}

.hero-service-icon{
  width:52px;
  height:52px;
  border-radius:50%;
  border:1px solid rgba(208,160,100,.52);
  background:rgba(208,160,100,.08);
  color:#D0A064;
  font-size:1.42rem;
}

.hero-service-row h3{
  font-size:1.08rem;
}

.hero-service-row p{
  font-size:.8rem;
  color:rgba(255,255,255,.58);
}

.hero-gold{
  background:linear-gradient(180deg,#D2A66B,#A8733E) !important;
  color:#fff !important;
  border:1px solid rgba(225,180,115,.72) !important;
}

.hero-outline{
  border-color:rgba(210,166,107,.62) !important;
}

.trust-strip{
  background:rgba(28,28,27,.96);
  padding:2.35rem 5vw;
  border-top:1px solid rgba(208,160,100,.16);
}

.trust-feature h4{
  color:rgba(255,255,255,.9);
}

.trust-feature p{
  color:rgba(255,255,255,.46);
}

.trust-icon{
  color:#C9955A;
}

@media(max-width:1024px){
  .hero{
    min-height:auto;
    padding-bottom:3rem;
  }

  .hero-content{
    grid-template-columns:1fr;
  }

  .hero-service-panel{
    width:100%;
    max-width:520px;
  }
}

@media(max-width:768px){
  .hero-h1{
    font-size:3rem;
  }

  .hero-h1 em{
    white-space:normal;
  }
}
/* FINAL PROFESSIONAL POSITION + GLASS PATCH */

.hero-content{
  max-width:1320px;
  grid-template-columns:minmax(0, 1fr) 350px;
  gap:5.5vw;
}

.hero-left{
  transform:translateX(-28px);
}

.hero-service-panel{
  width:350px;
  transform:translateY(-18px);
  background:
    radial-gradient(circle at 88% 18%, rgba(226,168,95,.22), transparent 34%),
    linear-gradient(135deg, rgba(42,39,36,.62), rgba(13,13,13,.46));
  border:1px solid rgba(210,166,107,.32);
  backdrop-filter:blur(14px) saturate(115%);
  -webkit-backdrop-filter:blur(14px) saturate(115%);
  box-shadow:
    0 28px 80px rgba(0,0,0,.42),
    inset 0 0 38px rgba(230,160,90,.08),
    inset 0 1px 0 rgba(255,255,255,.06);
}

.hero-service-panel::before{
  content:"";
  position:absolute;
  inset:0;
  border-radius:inherit;
  background:
    radial-gradient(circle at 92% 8%, rgba(255,190,115,.18), transparent 38%),
    linear-gradient(90deg, transparent 0%, rgba(255,190,115,.08) 78%, rgba(255,190,115,.16) 100%);
  pointer-events:none;
}

.hero-service-row{
  grid-template-columns:60px 1fr;
  padding:1.55rem 1.55rem;
  gap:.95rem;
}

.hero-service-icon{
  width:50px;
  height:50px;
}

.hero-service-row h3,
.hero-service-row p{
  transform:translateX(-4px);
}

.hero-trust{
  margin-top:3.35rem;
}

.trust-strip{
  background:
    linear-gradient(180deg, #242424 0%, #202020 100%);
  border-top:1px solid rgba(255,255,255,.08);
  border-bottom:1px solid rgba(0,0,0,.45);
}

.trust-feature{
  padding-top:.15rem;
}

@media(max-width:1024px){
  .hero-left{
    transform:none;
  }

  .hero-service-panel{
    width:100%;
    transform:none;
  }

  .hero-trust{
    margin-top:2.4rem;
  }
}
/* RIGHT PANEL FINAL TIGHT + ALIGN PATCH */

.hero-service-panel{
  background:
    radial-gradient(circle at 88% 18%, rgba(226,168,95,.18), transparent 34%),
    linear-gradient(135deg, rgba(28,28,28,.82), rgba(8,8,8,.72));
}

.hero-service-row{
  grid-template-columns:48px 1fr;
  padding:1.2rem 1.4rem;
  gap:.7rem;
}

.hero-service-icon{
  width:44px;
  height:44px;
  margin-left:-4px; /* SOLA YAPIŞTIR */
}

.hero-service-row h3{
  font-size:.95rem;
  font-weight:600; /* DAHA KALIN */
  letter-spacing:.01em;
  margin-bottom:.35rem;
  transform:translateX(-6px);
}

.hero-service-row p{
  font-size:.72rem;
  font-weight:500; /* DAHA TOK */
  line-height:1.45;
  color:rgba(255,255,255,.55);
  transform:translateX(-6px);
}

/* satırlar arası boşluk azalt */
.hero-service-row + .hero-service-row{
  margin-top:-6px;
}

/* divider daha ince ve premium */
.hero-service-row{
  border-bottom:1px solid rgba(255,255,255,.06);
}
/* ===== RIGHT PANEL FIXED (ICONS + ALIGNMENT + DARK GLASS) ===== */

.hero-service-panel{
  background:
    radial-gradient(circle at 85% 15%, rgba(255,180,100,.12), transparent 40%),
    linear-gradient(135deg, rgba(32,32,32,.85), rgba(12,12,12,.78));
  border:1px solid rgba(200,160,100,.25);
  backdrop-filter:blur(16px) saturate(120%);
  -webkit-backdrop-filter:blur(16px) saturate(120%);
}

/* ROW STRUCTURE */
.hero-service-row{
  display:grid;
  grid-template-columns:52px 1fr;
  align-items:flex-start;
  padding:1.25rem 1.4rem;
  gap:.75rem;
}

/* ICONS → TAM SOL */
.hero-service-icon{
  width:46px;
  height:46px;
  margin-left:-8px;   /* SOLA YAPIŞTIR */
  display:flex;
  align-items:center;
  justify-content:center;
  color:#C9A46D;
}

/* TEXT BLOĞU SOLA */
.hero-service-row > div{
  transform:translateX(-6px);
}

/* TITLE */
.hero-service-row h3{
  font-size:.95rem;
  font-weight:600;
  letter-spacing:.02em;
  margin-bottom:.35rem;
}

/* DESCRIPTION */
.hero-service-row p{
  font-size:.72rem;
  font-weight:500;
  line-height:1.45;
  color:rgba(255,255,255,.55);
}

/* DIVIDER DAHA SOFT */
.hero-service-row{
  border-bottom:1px solid rgba(255,255,255,.06);
}
/* ===== HERO POSITION + PANEL TIGHTEN ===== */

/* SOL BLOK → DAHA SOLA */
.hero-content{
  max-width:1360px;
  grid-template-columns:minmax(0,1fr) 340px; /* sağ panel biraz dar */
  gap:4.5vw;
}
.hero-left{
  transform:translateX(-48px); /* sola kaydır */
}

/* SAĞ PANEL → DAHA DARK + DAHA KOMPAKT */
.hero-service-panel{
  width:340px;
  transform:translateY(-12px); /* hafif yukarı */
  background:
    radial-gradient(circle at 85% 15%, rgba(255,180,100,.10), transparent 40%),
    linear-gradient(135deg, rgba(24,24,24,.90), rgba(8,8,8,.86)); /* daha dark grey */
  border:1px solid rgba(200,160,100,.22);
  backdrop-filter:blur(14px) saturate(110%);
  -webkit-backdrop-filter:blur(14px) saturate(110%);
  box-shadow:
    0 24px 70px rgba(0,0,0,.45),
    inset 0 0 28px rgba(230,160,90,.06);
}

/* ROW → YÜKSEKLİK VE ARALIK KISALT */
.hero-service-row{
  grid-template-columns:44px 1fr;
  padding:1rem 1.2rem;      /* daha kısa */
  gap:.6rem;                 /* daha sıkı */
  border-bottom:1px solid rgba(255,255,255,.06);
}
.hero-service-row:last-child{
  border-bottom:none;
}

/* ICON → SOLA YAPIŞIK */
.hero-service-icon{
  width:40px;
  height:40px;
  margin-left:-10px;         /* sola çek */
}

/* YAZILAR → DAHA KOMPAKT VE SOLA */
.hero-service-row > div{
  transform:translateX(-6px);
}
.hero-service-row h3{
  font-size:.92rem;
  font-weight:600;
  margin-bottom:.25rem;
}
.hero-service-row p{
  font-size:.70rem;
  line-height:1.4;
  color:rgba(255,255,255,.55);
}

/* RESPONSIVE */
@media(max-width:1024px){
  .hero-left{ transform:none; }
  .hero-service-panel{ width:100%; transform:none; }
}
@media (max-width: 768px) {

  body {
    overflow-x: hidden;
  }

  .trust-strip {
    width: 100%;
    overflow: hidden;
  }

  .trust-strip-inner {
    display: flex !important;
    flex-direction: column !important;
    gap: 1.5rem;
    width: 100%;
  }

  .trust-feature {
    display: flex !important;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    padding: 0;
    border: none !important;
  }

  .trust-icon {
    flex-shrink: 0;
  }
}
.address-field{
  position:relative;
}

.address-input{
  padding-right:42px !important;
}

.clear-address-btn{
  position:absolute;
  right:12px;
  top:34px;
  width:24px;
  height:24px;
  border:0;
  border-radius:50%;
  background:rgba(0,0,0,.08);
  color:#777;
  font-size:18px;
  line-height:24px;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
}

.clear-address-btn:hover{
  background:rgba(0,0,0,.14);
  color:#111;
}
/* BOOKING FORM PREMIUM UPGRADE */

.booking-panel-form{
  background:#fff;
  padding:32px;
  border-radius:18px;
  box-shadow:0 20px 60px rgba(0,0,0,.08);
  border:1px solid #eee;
}

/* INPUTS */
.fi{
  background:#fafafa;
  border:1px solid #e6e6e6;
  border-radius:10px;
  padding:14px 16px;
  font-size:14px;
}

.fi:focus{
  background:#fff;
  border-color:#B98B55;
}

/* LABEL */
.fl{
  font-size:11px;
  text-transform:uppercase;
  letter-spacing:.12em;
  color:#999;
}

/* BUTTON */
.btn-whatsapp{
  border-radius:12px;
  padding:16px;
  font-size:14px;
  background:linear-gradient(180deg,#D2A76F,#A8753F);
}

/* FARE BOX */
.fare-estimate{
  border-radius:14px;
}
.premium-btn{
  width:100%;
  padding:16px;
  border-radius:14px;
  border:1px solid rgba(212,169,111,.7);
  background:linear-gradient(180deg,#D4A96F,#A8753F);
  color:#fff;
  font-size:14px;
  font-weight:600;
  letter-spacing:.04em;
  transition:all .25s ease;
}

.premium-btn:hover{
  transform:translateY(-2px);
  box-shadow:0 10px 30px rgba(168,117,63,.35);
}

.premium-btn:active{
  transform:scale(0.98);
}

.wa-trust-line{
  text-align:center;
  font-size:12px;
  color:#888;
  margin-top:10px;
  letter-spacing:.03em;
}
`;

export default function Home() {
  const wa = buildWhatsAppLink({ from: "", to: "", fare: null });

  return <>
    <style dangerouslySetInnerHTML={{ __html: CSS }}/>
    <Nav/>
    <Hero/>
    <TrustStrip/>
    <InlineBooking/>

    

    <Fleet/>

    <Services/>
    <CorporateSection/>  {/* ✅ BURAYA EKLENDİ */}
    <Why/>
    <Areas/>

    <Moments/>
    <Process/>

    <Testimonials/>
    <Closer/>
    <Footer/>

    <a href={wa} target="_blank" rel="noopener noreferrer" className="wa-float">
      <WAIcon s={17}/>
      <span>Reserve</span>
    </a>
  </>;
}
