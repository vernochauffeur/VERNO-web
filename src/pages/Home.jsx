import { useState, useEffect, useRef } from "react";
/* image constants */
const MOMENTS_MAIN = "/images/moments-main.jpg";
const MOMENTS_ACCENT = "/images/moments-accent.jpg";
const FLEET_IMG = "/images/fleet.jpg";
/* ─────────────────────────────────────────────────────────────
VERNO PRICING ENGINE v4
Priority: airport-fixed -> route-table (airport only) -> anchor-based suburb
Always returns a number. Non-airport fares use anchor-relative logic.
─────────────────────────────────────────────────────────────── */
const PRICING = {
  MIN_FARE: 75,
  BASE_FEE: 15,
  PER_MIN: 0.60,
  RATE_0_25: 3.20,
  RATE_25_50: 2.80,
  RATE_50UP: 2.30,
  LATE_SURCHARGE: 0.15,
  LATE_START: 0,
  LATE_END: 5,
  BUFFER: 5,
  ROUND_TO: 5,
};
// Airport-to-suburb fixed fares (suburb end only -- airport keyword triggers these).
// Also used as anchor values for suburb-to-suburb pricing.
const AIRPORT_FIXED = {
  // Inner core
  "cbd": 105, "melbourne cbd": 105,
  "city": 105, "docklands": 105,
  "southbank": 110, "south melbourne": 110,
  "carlton": 108, "fitzroy": 110,
  "collingwood": 110, "richmond": 115,

  // Inner south / east
  "south yarra": 120, "prahran": 120,
  "chapel street": 120, "hawthorn": 120,
  "toorak": 125, "malvern": 125,
  "camberwell": 130, "st kilda": 130,
  "elwood": 132,

  // Bayside
  "brighton": 145, "bayside": 145,
  "hampton": 148, "sandringham": 150,
  "mentone": 155, "cheltenham": 155,

  // South-east outer
  "moorabbin": 155, "oakleigh": 158,
  "chadstone": 158, "glen waverley": 165,
  "knox": 168, "dandenong": 175,

  // Peninsula
  "frankston": 245, "mornington": 275,
  "mount eliza": 260, "mount martha": 285,
  "dromana": 300, "rosebud": 315,
  "rye": 330, "sorrento": 350,
  "portsea": 375, "peninsula": 310,

  // North / West
  "essendon": 115, "brunswick": 108,
  "coburg": 110, "northcote": 110,
  "footscray": 108, "williamstown": 115,
  "werribee": 165, "hoppers crossing": 165,

  // Geelong / Surf Coast
  "geelong": 175, "torquay": 185,
  "barwon heads": 190, "surf coast": 195,

  // Yarra Valley / Hills
  "lilydale": 175, "healesville": 195,
  "yarra valley": 195, "yarra glen": 195,
  "warburton": 215,
};

// Airport-only route table -- used only when one side is an airport/terminal.
// Suburb-to-suburb routes are handled by anchor-based logic below.
const ROUTE_TABLE = [
  { keys: [["airport","cbd"],["airport","melbourne city"],["airport","southern cross"],["airport","flinders"],["tullamarine","cbd"]], km: 23, min: 25 },
  { keys: [["airport","southbank"],["airport","crown"],["airport","docklands"],["tullamarine","southbank"]], km: 25, min: 27 },
  { keys: [["airport","st kilda"],["airport","south yarra"],["airport","prahran"],["airport","chapel street"],["tullamarine","st kilda"]], km: 30, min: 33 },
  { keys: [["airport","richmond"],["airport","hawthorn"],["airport","camberwell"],["tullamarine","richmond"]], km: 28, min: 30 },
  { keys: [["airport","brighton"],["airport","bayside"],["airport","sandringham"],["tullamarine","brighton"]], km: 37, min: 40 },
  { keys: [["airport","toorak"],["airport","malvern"],["tullamarine","toorak"]], km: 31, min: 34 },
  { keys: [["airport","geelong"],["airport","torquay"],["tullamarine","geelong"]], km: 90, min: 65 },
  { keys: [["airport","mornington"],["airport","portsea"],["airport","sorrento"],["airport","peninsula"],["tullamarine","mornington"]], km: 95, min: 70 },
  { keys: [["airport","yarra valley"],["airport","healesville"],["airport","lilydale"],["tullamarine","yarra valley"]], km: 80, min: 60 },
  { keys: [["airport","avalon"],["tullamarine","avalon"]], km: 50, min: 42 },
  { keys: [["avalon","cbd"],["avalon","city"],["avalon","southern cross"]], km: 56, min: 47 },
  { keys: [["avalon","southbank"],["avalon","docklands"]], km: 58, min: 49 },
  { keys: [["avalon","geelong"]], km: 20, min: 20 },
  { keys: [["park hyatt","airport"],["langham","airport"],["sofitel","airport"],["crown","airport"]], km: 24, min: 26 },
];

const NEARBY_GROUPS = [
  ["mornington", "mount eliza", "mount martha"],
  ["brighton", "hampton", "sandringham"],
  ["south yarra", "prahran", "windsor"],
  ["richmond", "hawthorn"],
  ["st kilda", "elwood", "balaclava"],
  ["cbd", "southbank", "docklands", "carlton"],
  ["toorak", "malvern"],
];

const ZONE_GROUPS = [
  ["mornington", "mount eliza", "mount martha", "frankston"],
  ["dromana", "rosebud", "rye", "sorrento", "portsea"],
  ["brighton", "hampton", "sandringham", "cheltenham", "mentone", "st kilda", "elwood", "balaclava"],
  ["south yarra", "prahran", "richmond", "windsor", "toorak", "hawthorn", "malvern", "camberwell"],
  ["cbd", "southbank", "docklands", "carlton", "fitzroy", "collingwood"],
];
// ── Helpers ─────────────────────────────────────────────────
function isAirport(text) {
const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, " ");
return (
t.includes("airport") || t.includes("tullamarine") ||
t.includes(" mel ") || t.includes("(mel)") ||
t.includes("terminal") || t.includes("avalon") || t.includes("avv")
);
}
function isLateNight() {
const h = new Date().getHours();
return h >= PRICING.LATE_START && h < PRICING.LATE_END;
}
function distanceCost(km) {
if (km <= 25) return km * PRICING.RATE_0_25;
if (km <= 50) return 25 * PRICING.RATE_0_25 + (km - 25) * PRICING.RATE_25_50;
return 25 * PRICING.RATE_0_25 + 25 * PRICING.RATE_25_50 + (km - 50) * PRICING.RATE_50UP;
}
function roundFare(n) {
return Math.round(n / PRICING.ROUND_TO) * PRICING.ROUND_TO;
}
function applyLateAndRound(fare) {
if (isLateNight()) fare = Math.round(fare * (1 + PRICING.LATE_SURCHARGE));
return roundFare(fare);
}
// ── Address normalisation ─────────────────────────────────────
// Strips postcodes, state abbreviations, punctuation, and extra whitespace
// so "Mornington VIC 3931" and "Mornington" both reduce to "mornington".
function normalizeAddress(text) {
return text
.toLowerCase()
.replace(/\bvic\b|\bnsw\b|\bqld\b|\bsa\b|\bwa\b|\btas\b|\bact\b|\bnt\b/g, " ")
.replace(/\b3\d{3}\b/g, " ") // strip 4-digit Victorian postcodes
.replace(/[^a-z0-9 ]/g, " ") // strip punctuation (commas, hyphens, etc.)
.replace(/\s+/g, " ")
.trim();
}
// Extract the leading suburb token from a normalised address.
// "mornington terminal drive tullamarine" -> "mornington"
// Used for same-suburb detection only.
function suburbToken(normalized) {
// Return up to the first comma equivalent (already stripped) or first 2 words
const words = normalized.split(" ");
// Prefer a 2-word suburb if it matches a known anchor key, else use first word
if (words.length >= 2) {
const two = words[0] + " " + words[1];
const keys = Object.keys(AIRPORT_FIXED);
if (keys.includes(two)) return two;
}
return words[0] || normalized;
}
// Lookup airport anchor for a given address string.
// Normalises first, then matches longest key to avoid "city" inside "melbourne city".
function getAnchor(text) {
const n = normalizeAddress(text);
const sorted = Object.entries(AIRPORT_FIXED).sort((a, b) => b[0].length - a[0].length);
for (const [key, val] of sorted) {
// Require whole-word match: key must be preceded/followed by space or string boundary
const re = new RegExp("(?:^| )" + key.replace(/ /g, " ") + "(?= |$)");
if (re.test(n)) return val;
}
return null;
}
// Returns true if the normalised address contains the group keyword as a whole word.
// Prevents "hampton" matching inside "north hampton" or similar accidents.
function inGroup(normalised, group) {
return group.some(k => {
const re = new RegExp("(?:^| )" + k.replace(/ /g, " ") + "(?= |$)");
return re.test(normalised);
});
}
// Detect same suburb after normalisation.
// "South Yarra VIC 3141" and "south yarra" -> true.
function isSameSuburb(normA, normB) {
if (normA === normB) return true;
const ta = suburbToken(normA);
const tb = suburbToken(normB);
return ta.length > 2 && ta === tb;
}
// Airport fixed fare -- only fires when one address is an airport/terminal.
function airportFixedFare(from, to) {
if (!isAirport(from + " " + to)) return null;
const combined = normalizeAddress(from + " " + to);
const sorted = Object.entries(AIRPORT_FIXED).sort((a, b) => b[0].length - a[0].length);
for (const [zone, price] of sorted) {
const re = new RegExp("(?:^| )" + zone.replace(/ /g, " ") + "(?= |$)");
if (re.test(combined)) return price;
}
return null;
}
// Route table lookup -- only used for airport-involved routes.
function lookupRoute(from, to) {
const combined = (from + " " + to).toLowerCase();
for (const route of ROUTE_TABLE) {
for (const pair of route.keys) {
if (combined.includes(pair[0]) && combined.includes(pair[1])) {
return { km: route.km, min: route.min };
}
}
}
return null;
}
// Anchor-based suburb-to-suburb fare.
//
// Priority (strict low -> high):
// same suburb -> MIN_FARE
// nearby -> avg_anchor * 0.40
// same zone -> min_anchor * 0.50
// diff zone -> max_anchor * 0.65
//
// Hard cap: result never exceeds max(anchor_from, anchor_to).
// Floor: MIN_FARE. Buffer: +BUFFER applied after cap.
function anchorSuburbFare(from, to) {
const af = getAnchor(from);
const at = getAnchor(to);
const anchors = [af, at].filter(a => a !== null);
// No anchor known for either address -> safe default
if (anchors.length === 0) {
return applyLateAndRound(PRICING.MIN_FARE + PRICING.BUFFER + 15);
}
const nf = normalizeAddress(from);
const nt = normalizeAddress(to);
const cap = Math.max(...anchors); // non-airport fare never exceeds this
if (isSameSuburb(nf, nt)) return PRICING.MIN_FARE;
let base;
// 1. Nearby cluster: very short trip within the same local pocket
if (NEARBY_GROUPS.some(g => inGroup(nf, g) && inGroup(nt, g))) {
const avg = anchors.reduce((s, a) => s + a, 0) / anchors.length;
base = avg * 0.40;
// 2. Same zone: connected corridor, moderate distance
} else if (ZONE_GROUPS.some(g => inGroup(nf, g) && inGroup(nt, g))) {
base = Math.min(...anchors) * 0.50;
// 3. Different zone: longer cross-suburb trip
} else {
base = Math.max(...anchors) * 0.65;
}
const fare = Math.min(cap, Math.max(PRICING.MIN_FARE, base));
return applyLateAndRound(fare + PRICING.BUFFER);
}
// Master fare calculation -- ALWAYS returns a number
function calculateFare(from, to) {
const airportRoute = isAirport(from + " " + to);
// 1. Airport with known suburb -> fixed fare
const airFixed = airportFixedFare(from, to);
if (airFixed !== null) {
return applyLateAndRound(airFixed + PRICING.BUFFER);
}
// 2. Airport detected but suburb not in fixed table -> route table or safe default
if (airportRoute) {
const route = lookupRoute(from, to);
if (route) {
let fare = PRICING.BASE_FEE + distanceCost(route.km) + route.min * PRICING.PER_MIN;
fare = Math.max(fare, PRICING.MIN_FARE) + PRICING.BUFFER;
return applyLateAndRound(fare);
}
return applyLateAndRound(120 + PRICING.BUFFER);
}
// 3. Suburb-to-suburb: use anchor-based pricing
return anchorSuburbFare(from, to);
}
function estimateFare(from, to) {
if (from.trim().length < 4 || to.trim().length < 4) return null;
const fare = calculateFare(from, to);
const isAirportRoute = isAirport(from + " " + to);
const hasFixedAirport = airportFixedFare(from, to) !== null;
const hasRouteMatch = lookupRoute(from, to) !== null;
const isFixed = hasFixedAirport || hasRouteMatch;
const isFallback = !isFixed;
return {
fare,
isLate: isLateNight(),
hasAirport: isAirportRoute,
isFixed,
isFallback,
};
}
/* Address autocomplete:
- Set GOOGLE_PLACES_API_KEY to your key.
- The script tag is injected once on first field focus.
- Uses types: [] (all types) with location bias for Melbourne.
- Supports: street numbers, residential addresses, apartments,
suburbs, landmarks, airports -- any valid address in Victoria.
- Fallback: curated Melbourne suggestions shown when API is not
configured (demo mode).
--------------------------------------------------------------- */
// -- CONFIG -- Set your Google Places API key here:
const GOOGLE_PLACES_API_KEY = ""; // e.g. "AIzaSy..."
// Melbourne lat/lng for location bias
const MEL_CENTER = { lat: -37.8136, lng: 144.9631 };
const MEL_RADIUS = 100000; // 100km -- covers all of greater Melbourne + Mornington/Yarra Va
// -- Fallback suggestions shown when no API key is configured --
// Includes landmarks AND common Melbourne suburbs for demo mode
const DEMO_SUGGESTIONS = [
// Airports
{ main: "Melbourne Airport (Tullamarine)", sub: "Terminal Drive, Tullamarine VIC 3045" },
{ main: "Avalon Airport", sub: "80 Beach Rd, Lara VIC 3212" },
// CBD & inner city
{ main: "Melbourne CBD", sub: "Melbourne VIC 3000" },
{ main: "Southern Cross Station", sub: "Spencer St, Docklands VIC 3008" },
{ main: "Flinders Street Station", sub: "Flinders St, Melbourne VIC 3000" },
{ main: "Docklands", sub: "VIC 3008" },
{ main: "Southbank", sub: "VIC 3006" },
// Hotels
{ main: "Crown Melbourne", sub: "8 Whiteman St, Southbank VIC 3006" },
{ main: "Park Hyatt Melbourne", sub: "1 Parliament Pl, Melbourne VIC 3002" },
{ main: "Langham Hotel Melbourne", sub: "1 Southgate Ave, Southbank VIC 3006" },
{ main: "Sofitel Melbourne On Collins", sub: "25 Collins St, Melbourne VIC 3000" },
// Inner south & east
{ main: "St Kilda", sub: "VIC 3182" },
{ main: "South Yarra", sub: "VIC 3141" },
{ main: "Prahran", sub: "VIC 3181" },
{ main: "Toorak", sub: "VIC 3142" },
{ main: "Richmond", sub: "VIC 3121" },
{ main: "Hawthorn", sub: "VIC 3122" },
{ main: "Camberwell", sub: "VIC 3124" },
{ main: "Malvern", sub: "VIC 3144" },
// Bayside
{ main: "Brighton", sub: "VIC 3186" },
{ main: "Brighton Beach", sub: "Brighton VIC 3186" },
{ main: "Sandringham", sub: "VIC 3191" },
{ main: "Bayside", sub: "VIC 3186" },
// North & west
{ main: "Fitzroy", sub: "VIC 3065" },
{ main: "Collingwood", sub: "VIC 3066" },
{ main: "Carlton", sub: "VIC 3053" },
{ main: "Brunswick", sub: "VIC 3056" },
// Regional
{ main: "Mornington Peninsula", sub: "Mornington VIC 3931" },
{ main: "Sorrento", sub: "VIC 3943" },
{ main: "Portsea", sub: "VIC 3944" },
{ main: "Yarra Valley", sub: "Yarra Glen VIC 3775" },
{ main: "Healesville", sub: "VIC 3777" },
{ main: "Geelong CBD", sub: "Geelong VIC 3220" },
{ main: "Torquay", sub: "VIC 3228" },
{ main: "Barwon Heads", sub: "VIC 3227" },
];
// -- Google Places script loader --
let _googleScriptLoading = false;
let _googleScriptReady = false;
const _googleReadyCbs = [];
function loadGooglePlaces(cb) {
if (_googleScriptReady) { cb(); return; }
_googleReadyCbs.push(cb);
if (_googleScriptLoading) return;
_googleScriptLoading = true;
window.__vernoGoogleReady = () => {
_googleScriptReady = true;
_googleReadyCbs.forEach(fn => fn());
_googleReadyCbs.length = 0;
};
const s = document.createElement("script");
s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=pla
s.async = true;
s.defer = true;
s.onerror = () => { _googleScriptLoading = false; };
document.head.appendChild(s);
}
// -- AddressField component --
function AddressField({ label, placeholder, value, onChange, id, inputRef }) {
const internalRef = useRef(null);
const fieldRef = inputRef || internalRef;
const wrapRef = useRef(null);
const acRef = useRef(null); // Google Autocomplete instance
const [suggestions, setSuggestions] = useState([]);
const [open, setOpen] = useState(false);
const [useGoogle, setUseGoogle] = useState(false);
const debounceRef = useRef(null);
// -- Bootstrap: try Google Places; fall back to local list --
useEffect(() => {
if (!GOOGLE_PLACES_API_KEY) return; // demo mode -- skip
loadGooglePlaces(() => {
if (!fieldRef.current || acRef.current) return;
const ac = new window.google.maps.places.Autocomplete(fieldRef.current, {
// No type restriction -- returns addresses, establishments, regions, anything
types: [],
componentRestrictions: { country: "au" },
// Bias towards Melbourne metro
bounds: new window.google.maps.LatLngBounds(
new window.google.maps.LatLng(MEL_CENTER.lat - 0.8, MEL_CENTER.lng - 0.8),
new window.google.maps.LatLng(MEL_CENTER.lat + 0.8, MEL_CENTER.lng + 0.8)
),
});
strictBounds: false, // allow Victoria-wide results
fields: ["formatted_address", "geometry", "name", "place_id"],
ac.addListener("place_changed", () => {
const place = ac.getPlace();
const addr = place.formatted_address || place.name || "";
onChange(addr);
setSuggestions([]);
setOpen(false);
});
acRef.current = ac;
setUseGoogle(true);
});
}, []);
// -- Close dropdown on outside click --
useEffect(() => {
const fn = e => {
if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
};
document.addEventListener("mousedown", fn);
return () => document.removeEventListener("mousedown", fn);
}, []);
// -- Fallback: local suggestion filter (demo / no API key) --
useEffect(() => {
if (useGoogle) return; // Google is handling it
clearTimeout(debounceRef.current);
if (value.length < 2) { setSuggestions([]); setOpen(false); return; }
debounceRef.current = setTimeout(() => {
const q = value.toLowerCase();
const res = DEMO_SUGGESTIONS.filter(s =>
s.main.toLowerCase().includes(q) || s.sub.toLowerCase().includes(q)
).slice(0, 7);
setSuggestions(res);
setOpen(res.length > 0);
}, 120);
return () => clearTimeout(debounceRef.current);
}, [value, useGoogle]);
const selectFallback = item => {
onChange(item.main + ", " + item.sub);
setSuggestions([]);
setOpen(false);
};
return (
<div className="fg ac-wrap" ref={wrapRef}>
<label className="fl" htmlFor={id}>{label}</label>
<input
ref={fieldRef}
id={id}
className="fi"
placeholder={placeholder}
value={value}
onChange={e => onChange(e.target.value)}
onFocus={() => !useGoogle && suggestions.length > 0 && setOpen(true)}
autoComplete="off"
spellCheck={false}
/>
{/* Fallback dropdown -- only shown when Google Places is not active */}
{!useGoogle && open && suggestions.length > 0 && (
<div className="ac-list" role="listbox">
{suggestions.map((item, i) => (
<button
key={i}
className="ac-item"
role="option"
onMouseDown={e => { e.preventDefault(); selectFallback(item); }}
>
<span className="ac-item-main">{item.main}</span>
<span className="ac-item-sub">{item.sub}</span>
</button>
))}
</div>
)}
</div>
);
}
/* ================================================
CONSTANTS & WA
================================================ */
const WA_NUMBER = "610421238894";
const VERNO_EMAIL = "book@vernochauffeur.com.au";
function buildWhatsAppLink({ from, to, date, time, pax, bags, fare }) {
const fareStr = fare ? `;{fare}` : null;
const msg = [
"Hello, I'd like to book a transfer:",
"",
`Pickup: ${from || "--"}`,
`Drop-off: ${to || "--"}`,
...(fareStr ? [`Estimated fare: ${fareStr}`] : []),
"",
"Please confirm availability.",
].join("\n");
return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}
/* ================================================
ICONS
================================================ */
function WAIcon({ s = 20 }) {
return (
<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197
<path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.534 5.845L0 24l6.335-1.518A11.9
</svg>
);
}
function MsgIcon({ s = 14 }) {
return (
<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWid
<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
<polyline points="22,6 12,13 2,6"/>
</svg>
);
}
/* ================================================
UTILITIES
================================================ */
function useReveal(ref) {
useEffect(() => {
const root = ref && ref.current;
if (!root) return;
const obs = new IntersectionObserver(
(entries) => entries.forEach(e => {
if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
}),
{ threshold: 0.06 }
);
root.querySelectorAll(".rv").forEach(el => obs.observe(el));
return () => obs.disconnect();
});
}
function VernoMark({ dark = false, h = 44 }) {
const ink = dark ? "#111111" : "#FFFFFF";
const sub = dark ? "rgba(17,17,17,.4)" : "rgba(255,255,255,.38)";
const gold = "#9E8A6A";
return (
<svg width={h * 4.6} height={h} viewBox="0 0 230 44" fill="none" style={{display:"block"}
<rect x="0" y="19" width="3" height="3" rx="1.5" fill={gold}/>
<text x="10" y="32" fontFamily="'Playfair Display',Georgia,serif" fontSize="22" fontWei
<text x="10" y="42" fontFamily="'Inter',Helvetica Neue,Helvetica,sans-serif" fontSize="
</svg>
);
}
/* ================================================
FARE ESTIMATE DISPLAY
================================================ */
function FareEstimate({ from, to }) {
const [state, setState] = useState("idle");
const [result, setResult] = useState(null);
const timerRef = useRef(null);
useEffect(() => {
const fromOk = from.trim().length > 4;
const toOk = to.trim().length > 4;
if (fromOk && toOk) {
setState("calculating");
clearTimeout(timerRef.current);
timerRef.current = setTimeout(() => {
const r = estimateFare(from, to);
setResult(r);
setState(r ? "shown" : "idle");
}, 500);
} else {
clearTimeout(timerRef.current);
setState("idle");
setResult(null);
}
return () => clearTimeout(timerRef.current);
}, [from, to]);
if (state === "idle") return null;
if (state === "calculating") return (
<div className="fare-estimate">
<div className="fare-calculating">
<div className="fare-dot"/><div className="fare-dot"/><div className="fare-dot"/>
<span style={{marginLeft:".5rem",fontSize:".75rem",color:"rgba(255,255,255,.35)",font
</div>
</div>
);
if (state === "shown" && result) {
const labelText = result.isFallback ? "Estimated Fare" : (result.isFixed ? "Fixed Price"
return (
<div className="fare-estimate">
<div style={{width:"100%"}}>
<div className="fare-label">{labelText}{result.isLate ? " - Late-night rate" <div className="fare-price">${result.fare}</div>
<div className="fare-guarantee">
{result.isFallback
? "Estimate - final price confirmed on booking"
: "Fixed price confirmed instantly via WhatsApp"}
</div>
<div className="fare-trust">
<span className="fare-trust-item">No hidden costs</span>
<span className="fare-trust-item">No surge pricing</span>
<span className="fare-trust-item">No platform fees</span>
</div>
</div>
</div>
: ""}<
);
}
return null;
}
/* ================================================
NAV
================================================ */
function Nav() {
const [solid, setSolid] = useState(false);
const [menu, setMenu] = useState(false);
useEffect(() => {
const fn = () => setSolid(window.scrollY > 60);
window.addEventListener("scroll", fn, { passive: true });
return () => window.removeEventListener("scroll", fn);
}, []);
useEffect(() => {
document.body.style.overflow = menu ? "hidden" : "";
return () => { document.body.style.overflow = ""; };
}, [menu]);
const close = () => setMenu(false);
const waLink = buildWhatsAppLink({ from:"", to:"", date:"", time:"", pax:"1", bags:"1", fa
return (
<>
<nav className={`nav${solid ? " solid" : ""}`}>
<a href="#" className="nav-logo-wrap" onClick={close}><VernoMark dark={solid} h={34}/
<ul className="nav-links">
{[["#services","Services"],["#fleet","Fleet"],["#areas","Coverage"],["#about","Abou
<li key={l}><a href={h}>{l}</a></li>
))}
</ul>
<div className="nav-right">
<a href="#book" className="nav-btn">Reserve a Transfer</a>
<button
className={`hamburger${menu ? " open" : ""}`}
onClick={() => setMenu(v => !v)}
aria-label={menu ? "Close menu" : "Open menu"}
aria-expanded={menu}
>
<span/><span/><span/>
</button>
</div>
</nav>
<div className={`mob-drawer${menu ? " open" : ""}`} aria-hidden={!menu}>
<ul className="mob-links">
{[["#book","Reserve"],["#services","Services"],["#fleet","Fleet"],["#areas","Covera
<li key={l}><a href={h} onClick={close}>{l}</a></li>
))}
</ul>
<div className="mob-contact">
<a href={`mailto:${VERNO_EMAIL}`} onClick={close}>{VERNO_EMAIL}</a>
</div>
<a href={waLink} target="_blank" rel="noopener noreferrer" className="mob-cta" <WAIcon s={16}/>&nbsp; Reserve via WhatsApp
</a>
</div>
onClic
</>
);
}
/* ================================================
HERO
================================================ */
function Hero() {
const waLink = buildWhatsAppLink({ from:"", to:"", date:"", time:"", pax:"1", bags:"1", far
return (
<section className="hero">
<p className="hero-label">Melbourne Private Chauffeur</p>
<h1 className="hero-h1">
Private chauffeur service<br/>in Melbourne.
</h1>
<p className="hero-sub">Fixed fares. Direct booking. No apps. Airport &amp; corporate t
<div className="hero-actions">
<a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-wa">
<WAIcon s={17}/><span>Reserve via WhatsApp</span>
</a>
<a href="#book" className="btn-outline">Get Instant Fare</a>
</div>
<div className="hero-trust">
{["Fixed pricing","No surge","Direct contact","Premium vehicle"].map(t => (
<div key={t} className="hero-trust-item">{t}</div>
))}
</div>
</section>
);
}
/* ================================================
TRUST STRIP
================================================ */
function TrustStrip() {
return (
<div className="trust-strip">
<div className="trust-strip-inner">
{["Professional chauffeur","Melbourne based","Private service","No platform fees"].ma
<div key={i} className="trust-item">
<div className="trust-item-dot"/>
<span>{t}</span>
</div>
))}
</div>
</div>
);
}
/* ================================================
INLINE BOOKING PANEL
================================================ */
function InlineBooking() {
const [from, setFrom] = useState("");
const [to, setTo] = useState("");
const [date, setDate] = useState("");
const [time, setTime] = useState("");
const [pax, setPax] = useState("1");
const [bags, setBags] = useState("1");
const pickupRef = useRef(null);
const fareResult = estimateFare(from, to);
const fare = fareResult ? fareResult.fare : null;
useEffect(() => {
const t = setTimeout(() => { if (pickupRef.current) pickupRef.current.focus(); }, 800);
return () => clearTimeout(t);
}, []);
const handleWA = () => {
const link = buildWhatsAppLink({ from, to, date, time, pax, bags, fare });
window.open(link, "_blank", "noopener");
};
const fillAirport = () => {
setTo("Melbourne Airport (Tullamarine), Terminal Drive, Tullamarine VIC 3045");
if (pickupRef.current) pickupRef.current.focus();
};
return (
<div className="booking-panel" id="book">
<div className="booking-panel-inner">
<div>
<h2 className="booking-panel-headline">
Your fare,<br/><em>instantly.</em>
</h2>
<p className="booking-panel-sub">
Enter your journey details to see your fare. Then reserve directly via WhatsApp.
</p>
</div>
<div className="booking-panel-form">
<button className="quick-chip" onClick={fillAirport}>
<span className="quick-chip-dot"/>
Airport transfer? Set Melbourne Airport as destination
</button>
<AddressField
id="bp-from"
label="Pickup"
placeholder="Enter pickup address, suburb or hotel"
value={from}
onChange={setFrom}
inputRef={pickupRef}
/>
<AddressField
id="bp-to"
label="Destination"
placeholder="Enter destination address or airport"
value={to}
onChange={setTo}
/>
<div className="f2">
<div className="fg">
<label className="fl" htmlFor="bp-date">Date</label>
<input id="bp-date" className="fi" type="date" value={date} onChange={e => setD
</div>
<div className="fg">
<label className="fl" htmlFor="bp-time">Time</label>
<input id="bp-time" className="fi" type="time" value={time} onChange={e => setT
</div>
</div>
<div className="f2">
<div className="fg">
<label className="fl" htmlFor="bp-pax">Passengers</label>
<select className="fi" id="bp-pax" value={pax} onChange={e => setPax(e.target.v
{[1,2,3,4].map(n => <option key={n}>{n}</option>)}
</select>
</div>
<div className="fg">
<label className="fl" htmlFor="bp-bags">Luggage</label>
<select className="fi" id="bp-bags" value={bags} onChange={e => setBags(e.targe
{[0,1,2,3,4].map(n => <option key={n}>{n}</option>)}
</select>
</div>
</div>
<FareEstimate from={from} to={to}/>
<button className="btn-whatsapp" onClick={handleWA}>
<WAIcon s={18}/> Confirm Booking via WhatsApp
</button>
<p className="btn-wa-note">We usually confirm within 2-5 minutes.</p>
<a href={`mailto:${VERNO_EMAIL}?subject=Booking Request`} className="btn-email-seco
Prefer email? {VERNO_EMAIL}
</a>
</div>
</div>
</div>
);
}
/* ================================================
SERVICES
================================================ */
const SVC = [
{ id:"airport", label:"Airport Transfers",
h:"Airport Transfers",
desc:"Seamless arrivals and departures from Tullamarine and Avalon. Flight monitored. Dri
feats:["Real-time flight monitoring","Meet and greet on arrival","All terminals - domesti
note:"Fixed fare from Melbourne CBD - no meter, no surge." },
{ id:"corporate", label:"Corporate",
h:"Corporate Travel",
desc:"Reliable ground transport for executives and business guests. Consistent, discreet,
feats:["Dedicated account management","Consolidated invoicing available","Priority alloca
note:"Corporate accounts with consolidated billing available on request." },
{ id:"private", label:"Private Hire",
h:"Private Hire",
desc:"A dedicated BMW i5 at your disposal. Yarra Valley, Mornington Peninsula, Great Ocea
feats:["From 3-hour engagement","Full day and multi-day available","Wine country and peni
note:"Hourly rate from a 3-hour minimum - all-inclusive quote provided." },
{ id:"events", label:"Events",
h:"Events & Occasions",
desc:"Premium transport for weddings, corporate functions, and private occasions.",
feats:["Weddings and formal events","Corporate and black-tie functions","MCG, Rod Laver A
note:"Custom event quotes - multi-vehicle coordination on request." },
];
function Services() {
const [active, setActive] = useState(0);
const ref = useRef(null); useReveal(ref);
const s = SVC[active];
const waLink = buildWhatsAppLink({ from:s.label, to:"", date:"", time:"", pax:"1", bags:"1"
return (
<section className="sec" id="services" ref={ref}>
<div className="wrap">
<div className="rv"><div className="s-label">Services</div></div>
<h2 className="s-h rv d1">Every journey,<br/><em>handled.</em></h2>
<div className="svc-layout rv d2">
<nav className="svc-nav">
{SVC.map((sv, i) => (
<button
key={sv.id}
className={`svc-nav-item${active === i ? " active" : ""}`}
onClick={() => setActive(i)}
>
{sv.label}
<svg className="svc-nav-arr" width="10" height="10" viewBox="0 0 24 24" fill=
</button>
))}
</nav>
<div className="svc-content">
<h3 className="svc-content-h">{s.h}</h3>
<p className="svc-desc">{s.desc}</p>
<ul className="svc-feat-list">
{s.feats.map(f => (
<li key={f} className="svc-feat-row">
<span className="svc-feat-check">-</span>
<span>{f}</span>
</li>
))}
</ul>
<div className="svc-cta-row">
<a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-wa"
onClick={e => { e.preventDefault(); window.open(buildWhatsAppLink({ from:s.la
<WAIcon s={15}/><span>Reserve via WhatsApp</span>
</a>
<a href={`mailto:${VERNO_EMAIL}?subject=Enquiry - ${s.label}`} className="btn-o
<MsgIcon s={13}/><span>Email Enquiry</span>
</a>
</div>
<p className="svc-note-clean">{s.note}</p>
</div>
</div>
</div>
</section>
);
}
/* ================================================
WHY VERNO
================================================ */
function Why() {
const ref = useRef(null); useReveal(ref);
return (
<section className="sec dark" id="about" ref={ref}>
<div className="wrap">
<div className="why-layout">
<div>
<div className="rv"><div className="s-label inv">Why V&#201;RNO</div></div>
<h2 className="s-h inv rv d1">A boutique<br/><em>standard.</em></h2>
<p className="s-body rv d2" style={{marginTop:"1.2rem",maxWidth:260,color:"rgba(1
Small fleet. Consistent quality. Every detail considered.
</p>
<a href={`mailto:${VERNO_EMAIL}`} className="rv d3" style={{display:"flex",alignI
<MsgIcon s={12}/>{VERNO_EMAIL}
</a>
</div>
<div className="why-grid rv d1">
{[
of cli
car an
{n:"01",t:"Fully electric",d:"BMW i5 - zero emissions, whisper-quiet, and preci
{n:"02",t:"Discreet by design",d:"Your journey is private. No discussion {n:"03",t:"Small, intentional fleet",d:"We keep our fleet small so every {n:"04",t:"Direct booking",d:"No hold music, no chase. Submit your details via
].map(w => (
<div key={w.n} className="why-cell">
<span className="why-n">{w.n}</span>
<div className="why-t">{w.t}</div>
<p className="why-d">{w.d}</p>
</div>
))}
</div>
</div>
</div>
</section>
);
}
/* ================================================
AREAS
================================================ */
function Areas() {
const ref = useRef(null); useReveal(ref);
const areas = [
{name:"Melbourne CBD", time:"~30 min airport", desc:"Collins Street, Southbank, Doc
{name:"St Kilda & South Yarra", time:"~40 min airport", desc:"Chapel Street, Toorak Road,
{name:"Mornington Peninsula", time:"~80 min airport", desc:"Portsea, Sorrento, Rye, Droma
{name:"Yarra Valley", time:"~70 min airport", desc:"Healesville, Yering, Yarra Gle
{name:"Melbourne Airport", time:"Tullamarine (MEL)", desc:"All terminals. T1 Internatio
{name:"Avalon Airport", time:"Avalon (AVV)", desc:"Direct transfers. Jetstar and
{name:"Geelong & Surf Coast",time:"~70 min airport", desc:"Geelong CBD, Torquay, Barwon H
{name:"Greater Melbourne", time:"All suburbs", desc:"Essendon, Brighton, Hawthorn,
];
return (
<section className="sec" id="areas" ref={ref}>
<div className="wrap">
<div className="rv"><div className="s-label">Coverage</div></div>
<h2 className="s-h rv d1">Across Melbourne<br/><em>and beyond.</em></h2>
<div className="areas-list rv d2">
{areas.map(a => (
<div key={a.name} className="area-item" onClick={() => document.getElementById("b
<div className="area-name">{a.name}</div>
<div className="area-time">{a.time}</div>
<p className="area-desc">{a.desc}</p>
</div>
))}
</div>
</div>
</section>
);
}
/* ================================================
FLEET
================================================ */
function Fleet() {
const ref = useRef(null); useReveal(ref);
const waLink = buildWhatsAppLink({ from:"", to:"", date:"", time:"", pax:"1", bags:"1", far
return (
<section className="sec fleet-section" id="fleet" ref={ref}>
<div className="wrap">
<div className="rv"><div className="s-label inv">The Fleet</div></div>
<div className="fleet-layout">
<div className="rv d1">
<div className="fleet-img-wrap">
<img src={FLEET_IMG} alt="VERNO BMW i5 fleet" className="fleet-img" loading="la
</div>
</div>
<div className="fleet-text rv d2">
<p className="fleet-text-eyebrow">All-Electric Fleet</p>
<h2 className="fleet-text-title">BMW i5<br/><em>eDrive40</em></h2>
<p className="fleet-text-sub">Zero emissions. Executive comfort. Built for Melbou
<p className="fleet-text-body">V&#201;RNO operates a dedicated fleet of premium e
<div className="fleet-text-specs">
{[
"BMW i5 eDrive40 - whisper-quiet electric drive",
"Executive rear cabin with heated leather seating",
"Full privacy glass and wireless device charging",
"Zero emissions - fully charged for every journey",
"Multiple vehicles for group and corporate bookings",
].map(s => (
<div key={s} className="fleet-spec-item">{s}</div>
))}
</div>
<div className="fleet-ev-badge">100% Electric - BMW i5</div>
<a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-p" styl
<WAIcon s={15}/><span>Reserve via WhatsApp</span>
</a>
</div>
</div>
</div>
</section>
);
}
/* ================================================
PROCESS
================================================ */
function Process() {
const ref = useRef(null); useReveal(ref);
return (
<section className="sec night2" ref={ref}>
<div className="wrap">
<div className="rv"><div className="s-label inv">How It Works</div></div>
<h2 className="s-h inv rv d1">Simple to arrange.<br/><em>Seamless to experience.</em>
<div className="proc-track">
{[
{r:"I", n:"Arrange your transfer", d:`Submit your journey details via {r:"II", n:"Receive confirmation", d:"We respond with your confirmed reser
{r:"III", n:"Arrive in comfort", d:"Your BMW i5 and chauffeur are the bo
in pos
].map(s => (
<div key={s.r} className="proc-step rv d1">
<span className="proc-roman">{s.r}</span>
<div className="proc-name">{s.n}</div>
<p className="proc-desc">{s.d}</p>
</div>
))}
</div>
</div>
</section>
);
}
/* ================================================
MOMENTS
================================================ */
function Moments() {
const ref = useRef(null); useReveal(ref);
const imgRef = useRef(null);
useEffect(() => {
const el = imgRef.current;
if (!el) return;
const obs = new IntersectionObserver(
([e]) => { if (e.isIntersecting) { el.classList.add("entered"); obs.disconnect(); } },
{ threshold: 0.1 }
);
obs.observe(el);
return () => obs.disconnect();
}, []);
return (
<section className="moments" ref={ref}>
<div className="moments-inner">
<div className="moments-img-col rv d1">
<div className="moments-img-wrap" ref={imgRef}>
<img src={MOMENTS_MAIN} alt="VERNO BMW i5 at Melbourne waterfront" className="mom
<span className="moments-geo">Melbourne - Private Transfers</span>
</div>
</div>
<div className="moments-text rv d2">
<p className="moments-eyebrow">Moments</p>
<h2 className="moments-title">
Refined.<br/>
Quiet.<br/>
<em>Consistent.</em>
</h2>
<div className="moments-rule"/>
<p className="moments-desc">
Every journey is designed to feel effortless - from the first message to final ar
</p>
</div>
</div>
</section>
);
}
/* ================================================
TESTIMONIALS
================================================ */
function Testimonials() {
const ref = useRef(null); useReveal(ref);
return (
<section className="sec" ref={ref}>
<div className="wrap">
<div className="rv"><div className="s-label">Client Words</div></div>
<h2 className="s-h rv d1">What clients<br/><em>say.</em></h2>
<div className="testi-row">
{[
{t:"Quiet, punctual, and completely professional. The BMW i5 is an exceptional ve
{t:"I requested by message in the morning and had a confirmed booking within the
{t:"How you arrive matters. This service understands that without needing to be t
].map((t, i) => (
<div key={i} className="testi rv d1">
<span className="testi-mark">"</span>
<p className="testi-txt">{t.t}</p>
<p className="testi-by">- {t.by}</p>
</div>
))}
</div>
</div>
</section>
);
}
/* ================================================
CLOSER
================================================ */
function Closer() {
const ref = useRef(null); useReveal(ref);
const waLink = buildWhatsAppLink({ from:"", to:"", date:"", time:"", pax:"1", bags:"1", far
return (
<section className="closer" id="contact" ref={ref}>
<div className="closer-inner">
<p className="s-label inv rv" style={{marginBottom:"2rem"}}>Melbourne, Victoria</p>
<h2 className="closer-h rv d1">Ready when<br/><em>you are.</em></h2>
<p className="closer-sub rv d2">Reserve your transfer directly. Instant confirmation,
<div className="closer-btns rv d2">
<a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-wa">
<WAIcon s={16}/><span>Reserve via WhatsApp</span>
</a>
<a href={`mailto:${VERNO_EMAIL}?subject=Booking Request`} className="btn-outline">
<span>Send an Email</span>
</a>
</div>
<p className="rv d3" style={{marginTop:"1.5rem",fontSize:".73rem",fontWeight:300,colo
</div>
</section>
);
}
/* ================================================
FOOTER
================================================ */
function Footer() {
const waLink = buildWhatsAppLink({ from:"", to:"", date:"", time:"", pax:"1", bags:"1", far
return (
<footer>
<div className="ft-grid">
<div>
<a href="#" className="ft-logo-wrap"><VernoMark dark={false} h={32}/></a>
<p className="ft-tagline">Private electric chauffeur for Melbourne.</p>
<a href={`mailto:${VERNO_EMAIL}`} className="ft-msg-link"><MsgIcon s={12}/>{VERNO_E
</div>
<div>
<p className="ft-col-h">Services</p>
<ul className="ft-links">
{["Airport Transfers","Corporate Travel","Private Hire","Events","Point-to-Point"
<li key={l}><a href="#services">{l}</a></li>
))}
</ul>
</div>
<div>
<p className="ft-col-h">Coverage</p>
<ul className="ft-links">
{["Melbourne CBD","Melbourne Airport","Avalon Airport","Mornington Peninsula","Ya
<li key={l}><a href="#areas">{l}</a></li>
))}
</ul>
</div>
<div>
<p className="ft-col-h">Reservations</p>
<ul className="ft-links">
<li><a href={waLink} target="_blank" rel="noopener noreferrer">Reserve via <li><a href={`mailto:${VERNO_EMAIL}`}>{VERNO_EMAIL}</a></li>
<li><a href="#book">Fare Estimate</a></li>
</ul>
</div>
</div>
<div className="ft-bottom">
<p>&#169; 2025 V&#201;RNO Private Chauffeur - Melbourne</p>
<p>Melbourne - Airport - Corporate</p>
</div>
</footer>
WhatsA
);
}
/* ================================================
CSS
================================================ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;font-size:16px}
:root{
--black:#111111;--white:#FFFFFF;--gold:#9E8A6A;--gold2:#B8A48A;
--grey1:#F5F5F5;--grey2:#EBEBEB;--grey3:#999999;--grey4:#666666;
--wa:#128C7E;
--serif:'Playfair Display',Georgia,serif;
--sans:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif;
--ease:cubic-bezier(.4,0,.2,1);--spring:cubic-bezier(.16,1,.3,1);
}
body{font-family:var(--sans);font-weight:400;background:var(--white);color:var(--black);-webk
::selection{background:var(--black);color:var(--white)}
::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:var(--grey2)}
a{color:inherit;text-decoration:none}
button{font-family:var(--sans);cursor:pointer;border:none;background:none;color:inherit}
input,select,textarea{font-family:var(--sans)}
/* NAV */
.nav{position:fixed;top:0;left:0;right:0;z-index:800;display:flex;align-items:center;justify-
.nav.solid{background:rgba(255,255,255,.98);backdrop-filter:blur(16px);border-color:var(--gre
.nav-logo-wrap{display:block;line-height:0;transition:opacity .25s}.nav-logo-wrap:hover{opaci
.nav-links{display:flex;gap:2.5rem;list-style:none}
.nav-links a{font-size:.8rem;font-weight:400;letter-spacing:.04em;text-transform:uppercase;co
.nav.solid .nav-links a{color:var(--grey4)}.nav-links a:hover{color:rgba(255,255,255,.95)}.na
.nav-right{display:flex;align-items:center;gap:1.2rem}
.nav-btn{font-size:.72rem;font-weight:400;letter-spacing:.1em;text-transform:uppercase;paddin
.nav.solid .nav-btn{color:var(--grey4);border-color:var(--grey2)}.nav-btn:hover{border-color:
.hamburger{display:none;flex-direction:column;gap:5px;padding:6px}
.hamburger span{display:block;width:22px;height:1.5px;background:rgba(255,255,255,.75);transi
.nav.solid .hamburger span{background:var(--black)}
.hamburger.open span:nth-child(1){transform:translateY(6.5px) rotate(45deg)}.hamburger.open s
.mob-drawer{position:fixed;inset:0;z-index:750;background:var(--black);display:flex;flex-dire
.mob-drawer.open{opacity:1;pointer-events:all}
.mob-links{list-style:none;display:flex;flex-direction:column;gap:.5rem;margin-bottom:3rem}
.mob-links a{font-family:var(--serif);font-size:clamp(2rem,6vw,3rem);font-weight:400;color:rg
.mob-links a:hover{color:var(--white)}
.mob-contact{margin-bottom:2rem}.mob-contact a{font-size:.85rem;font-weight:400;color:rgba(25
.mob-cta{display:inline-flex;align-items:center;gap:.6rem;font-size:.8rem;font-weight:600;let
/* HERO */
.hero{min-height:100svh;background:var(--black);display:flex;flex-direction:column;justify-co
.hero-label{font-size:.68rem;font-weight:400;letter-spacing:.18em;text-transform:uppercase;co
.hero-h1{font-family:var(--serif);font-size:clamp(2.8rem,6.5vw,6rem);font-weight:400;line-hei
.hero-sub{font-size:.95rem;font-weight:300;color:rgba(255,255,255,.45);margin-bottom:3.5rem;m
.hero-actions{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;animation:fadeUp .6s .5
.hero-trust{display:flex;align-items:center;gap:2.5rem;margin-top:6rem;flex-wrap:wrap;animati
.hero-trust-item{font-size:.7rem;font-weight:300;letter-spacing:.1em;text-transform:uppercase
@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
/* BUTTONS */
.btn-wa{display:inline-flex;align-items:center;gap:.65rem;font-size:.82rem;font-weight:500;le
.btn-wa:hover{background:#0e7a6d}.btn-wa svg{flex-shrink:0}
.btn-outline{display:inline-flex;align-items:center;gap:.65rem;font-size:.82rem;font-weight:4
.btn-outline:hover{border-color:rgba(255,255,255,.5);color:#fff}
.btn-p{display:inline-flex;align-items:center;gap:.65rem;font-size:.82rem;font-weight:500;let
.btn-p:hover{background:var(--gold2)}
.btn-o{display:inline-flex;align-items:center;gap:.65rem;font-size:.8rem;font-weight:400;lett
.btn-o:hover{border-color:var(--black);color:var(--black)}
/* TRUST STRIP */
.trust-strip{background:var(--black);padding:.85rem 5vw;border-top:1px solid rgba(255,255,255
.trust-strip-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:2.5rem;
.trust-item{display:flex;align-items:center;gap:.5rem;font-size:.7rem;font-weight:400;letter-
.trust-item-dot{width:3px;height:3px;border-radius:50%;background:var(--gold);flex-shrink:0}
/* BOOKING PANEL */
.booking-panel{background:var(--white);padding:7rem 5vw}
.booking-panel-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1.
.booking-panel-headline{font-family:var(--serif);font-size:clamp(1.8rem,2.5vw,2.4rem);font-we
.booking-panel-headline em{font-style:normal;color:var(--gold)}
.booking-panel-sub{font-size:.88rem;font-weight:300;line-height:1.75;color:var(--grey4)}
.booking-panel-form{display:flex;flex-direction:column}
.fg{margin-bottom:1.4rem;position:relative}
.fl{display:block;font-size:.7rem;font-weight:500;letter-spacing:.08em;text-transform:upperca
.fi{width:100%;padding:.85rem .95rem;background:var(--grey1);border:1px solid transparent;fon
.fi:focus{border-color:var(--gold);background:var(--white)}.fi::placeholder{color:#c0bdb8}.fi
.f2{display:grid;grid-template-columns:1fr 1fr;gap:1rem}
.ac-wrap{position:relative}
.ac-list{position:absolute;top:100%;left:0;right:0;z-index:200;background:var(--white);border
.ac-item{display:block;width:100%;text-align:left;padding:.8rem 1rem;font-size:.85rem;font-we
.ac-item:last-child{border-bottom:none}.ac-item:hover,.ac-item:focus{background:var(--grey1);
.ac-item-main{display:block;font-size:.88rem;font-weight:500;color:var(--black);margin-bottom
.quick-chip{display:inline-flex;align-items:center;gap:.5rem;font-size:.7rem;font-weight:400;
.quick-chip:hover{background:var(--gold);color:var(--white)}.quick-chip-dot{width:5px;height:
.fare-estimate{margin-top:1.8rem;padding:2rem 2.2rem;background:var(--black);margin-bottom:0}
.fare-label{font-size:.65rem;font-weight:300;letter-spacing:.18em;text-transform:uppercase;co
.fare-price{font-family:var(--serif);font-size:4rem;font-weight:400;color:var(--white);line-h
.fare-guarantee{font-size:.72rem;font-weight:300;color:rgba(255,255,255,.3);line-height:1.5}
.fare-trust{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;margin-top:1rem;padding-top:1rem;bor
.fare-trust-item{font-size:.68rem;font-weight:300;color:rgba(255,255,255,.35);letter-spacing:
.fare-calculating{display:flex;align-items:center;gap:.5rem;padding:1rem 0}
.fare-dot{width:4px;height:4px;border-radius:50%;background:var(--gold);opacity:.6;animation:
.fare-dot:nth-child(2){animation-delay:.15s}.fare-dot:nth-child(3){animation-delay:.3s}
@keyframes dotPulse{0%,100%{opacity:.2}50%{opacity:.9}}
.btn-whatsapp{width:100%;margin-top:1.6rem;padding:1.12rem;background:var(--wa);color:var(--w
.btn-whatsapp:hover{background:#0e7a6d}
.btn-wa-note{font-size:.72rem;font-weight:300;color:var(--grey3);text-align:center;margin-top
.btn-email-secondary{display:flex;align-items:center;justify-content:center;margin-top:.9rem;
.btn-email-secondary:hover{color:var(--black)}
/* SECTIONS */
.sec{padding:9rem 5vw}.sec.pale{background:var(--grey1)}.sec.dark{background:var(--black)}.se
.wrap{max-width:1200px;margin:0 auto}
.s-label{font-size:.68rem;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color
.s-label.inv{color:var(--gold)}
.s-h{font-family:var(--serif);font-size:clamp(2.2rem,4vw,3.4rem);font-weight:400;line-height:
.s-h em{font-style:normal;color:var(--gold)}.s-h.inv{color:var(--white)}.s-h.inv em{color:var
.s-body{font-size:.92rem;font-weight:300;line-height:1.75;color:var(--grey4)}
.rv{opacity:0;transform:translateY(16px);transition:opacity .5s ease,transform .5s ease}
.rv.in{opacity:1;transform:none}.d1{transition-delay:.06s}.d2{transition-delay:.12s}.d3{trans
/* SERVICES */
.svc-layout{display:grid;grid-template-columns:200px 1fr;gap:5rem;margin-top:4.5rem}
.svc-nav{display:flex;flex-direction:column;gap:0}
.svc-nav-item{display:flex;align-items:center;justify-content:space-between;padding:1.1rem 0;
.svc-nav-item.active,.svc-nav-item:hover{color:var(--black)}.svc-nav-item.active{font-weight:
.svc-nav-arr{opacity:0;transition:opacity .2s;color:var(--gold);flex-shrink:0}
.svc-nav-item.active .svc-nav-arr,.svc-nav-item:hover .svc-nav-arr{opacity:1}
.svc-content-h{font-family:var(--serif);font-size:clamp(1.8rem,3vw,2.6rem);font-weight:400;li
.svc-desc{font-size:.88rem;font-weight:300;line-height:1.88;color:var(--grey4);max-width:480p
.svc-feat-list{list-style:none;display:flex;flex-direction:column;gap:.7rem;margin-bottom:2.5
.svc-feat-row{display:flex;align-items:baseline;gap:.75rem;font-size:.85rem;font-weight:300;c
.svc-feat-check{color:var(--gold);font-size:.75rem;flex-shrink:0}
.svc-cta-row{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem}
.svc-note-clean{font-size:.77rem;font-weight:300;color:var(--grey3);line-height:1.65;padding-
/* WHY */
.why-layout{display:grid;grid-template-columns:320px 1fr;gap:6rem;align-items:start}
.why-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(255,255,255,.1
.why-cell{padding:2rem 2rem 2rem 0;border-bottom:1px solid rgba(255,255,255,.1);border-right:
.why-cell:nth-child(even){padding-left:2rem;padding-right:0;border-right:none}
.why-n{font-size:.65rem;font-weight:300;letter-spacing:.12em;text-transform:uppercase;color:v
.why-t{font-family:var(--serif);font-size:1.05rem;font-weight:400;color:var(--white);margin-b
.why-d{font-size:.83rem;font-weight:300;line-height:1.75;color:rgba(255,255,255,.38)}
/* AREAS */
.areas-list{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid var(-
.area-item{padding:2.2rem 1.5rem 2.2rem 0;border-right:1px solid var(--grey2);border-bottom:1
.area-item:hover{background:var(--grey1)}.area-item:nth-child(4n){border-right:none;padding-r
.area-name{font-family:var(--serif);font-size:1rem;font-weight:400;color:var(--black);margin-
.area-time{font-size:.68rem;font-weight:400;letter-spacing:.08em;text-transform:uppercase;col
.area-desc{font-size:.78rem;font-weight:300;line-height:1.65;color:var(--grey4)}
/* FLEET */
.fleet-section{background:var(--black)}
.fleet-layout{display:grid;grid-template-columns:1.1fr 1fr;gap:6rem;align-items:center;margin
.fleet-img-wrap{position:relative;overflow:hidden}.fleet-img{display:block;width:100%;object-
.fleet-img-wrap:hover .fleet-img{transform:scale(1.03)}
.fleet-text{display:flex;flex-direction:column}
.fleet-text-eyebrow{font-size:.68rem;font-weight:300;letter-spacing:.12em;text-transform:uppe
.fleet-text-title{font-family:var(--serif);font-size:clamp(2rem,2.8vw,2.6rem);font-weight:400
.fleet-text-title em{font-style:normal;color:var(--gold)}
.fleet-text-sub{font-size:.95rem;font-weight:300;color:rgba(255,255,255,.45);line-height:1.65
.fleet-text-body{font-size:.88rem;font-weight:300;line-height:1.75;color:rgba(255,255,255,.4)
.fleet-text-specs{display:flex;flex-direction:column;gap:.6rem;padding-top:1.8rem;border-top:
.fleet-spec-item{display:flex;align-items:center;gap:.7rem;font-size:.82rem;font-weight:300;c
.fleet-spec-item::before{content:"--";color:var(--gold);font-size:.68rem;flex-shrink:0}
.fleet-ev-badge{display:inline-flex;font-size:.63rem;font-weight:300;letter-spacing:.14em;tex
/* PROCESS */
.proc-track{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(255,25
.proc-step{padding:2.5rem 2.5rem 2.5rem 0;border-right:1px solid rgba(255,255,255,.08)}.proc-
.proc-roman{font-size:2.5rem;font-weight:600;color:var(--gold);opacity:.25;line-height:1;disp
.proc-name{font-family:var(--serif);font-size:1.15rem;font-weight:400;color:var(--white);marg
.proc-desc{font-size:.85rem;font-weight:300;line-height:1.75;color:rgba(255,255,255,.38)}
/* MOMENTS */
.moments{background:var(--black);padding:8rem 5vw}
.moments-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1.35fr 1fr;g
.moments-img-col{position:relative;overflow:hidden}
.moments-img-wrap{position:relative;overflow:hidden}
.moments-img{display:block;width:100%;object-fit:cover;aspect-ratio:16/9;filter:brightness(.8
.moments-img-wrap.entered .moments-img{transform:scale(1.04)}
.moments-geo{position:absolute;bottom:1.2rem;left:1.4rem;z-index:2;font-size:.68rem;font-weig
.moments-text{display:flex;flex-direction:column}
.moments-eyebrow{font-size:.68rem;font-weight:300;letter-spacing:.14em;text-transform:upperca
.moments-title{font-family:var(--serif);font-size:clamp(2rem,3.2vw,3rem);font-weight:400;line
.moments-title em{display:block;font-style:italic;color:rgba(255,255,255,.4)}
.moments-rule{width:2.5rem;height:2px;background:var(--gold);margin-bottom:1.5rem}
.moments-desc{font-size:.9rem;font-weight:300;line-height:1.75;color:rgba(255,255,255,.4);max
/* TESTIMONIALS */
.testi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--grey2);m
.testi{background:var(--white);padding:2.8rem 2.4rem 3.2rem;transition:background .2s}.testi:
.testi-mark{font-family:var(--serif);font-size:2rem;font-weight:400;color:var(--gold);opacity
.testi-txt{font-family:var(--serif);font-size:.92rem;font-weight:400;font-style:italic;color:
.testi-by{font-size:.68rem;font-weight:400;letter-spacing:.08em;text-transform:uppercase;colo
/* CLOSER */
.closer{background:var(--black);padding:10rem 5vw;text-align:center}
.closer-inner{max-width:640px;margin:0 auto}
.closer-h{font-family:var(--serif);font-size:clamp(2.8rem,5vw,4.5rem);font-weight:400;line-he
.closer-h em{font-style:italic;color:var(--gold)}
.closer-sub{font-size:.88rem;font-weight:300;color:rgba(255,255,255,.32);margin-bottom:3.5rem
.closer-btns{display:flex;align-items:center;justify-content:center;gap:1.2rem;flex-wrap:wrap
/* FOOTER */
footer{background:#080808;padding:5rem 5vw 2.5rem;border-top:1px solid rgba(255,255,255,.05)}
.ft-grid{display:grid;grid-template-columns:1.8fr 1fr 1fr 1fr;gap:4rem;max-width:1200px;margi
.ft-logo-wrap{display:block;margin-bottom:1.2rem;opacity:.85;transition:opacity .2s}.ft-logo-
.ft-tagline{font-size:.82rem;font-weight:300;color:rgba(255,255,255,.3);line-height:1.7;margi
.ft-msg-link{display:flex;align-items:center;gap:.5rem;font-size:.78rem;font-weight:300;color
.ft-col-h{font-size:.63rem;font-weight:300;letter-spacing:.14em;text-transform:uppercase;colo
.ft-links{list-style:none;display:flex;flex-direction:column;gap:.55rem}
.ft-links a{font-size:.8rem;font-weight:300;color:rgba(255,255,255,.32);transition:color .2s;
.ft-bottom{max-width:1200px;margin:0 auto;border-top:1px solid rgba(255,255,255,.05);padding-
.ft-copy{font-size:.7rem;font-weight:300;color:rgba(255,255,255,.18)}
/* FLOAT WA */
.wa-float{position:fixed;bottom:2rem;right:2rem;z-index:950;display:flex;align-items:center;g
.wa-float:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.34)}
/* RESPONSIVE */
@media(max-width:1024px){
.booking-panel-inner{grid-template-columns:1fr;gap:4rem}
.svc-layout{grid-template-columns:1fr}
.svc-nav{border-bottom:1px solid var(--grey2);display:flex;overflow-x:auto}
.svc-nav-item{white-space:nowrap;border-bottom:none;border-right:1px solid var(--grey2);min
.why-layout{grid-template-columns:1fr;gap:3.5rem}
.fleet-layout{grid-template-columns:1fr;gap:3.5rem}
.areas-list{grid-template-columns:repeat(2,1fr)}
.moments-inner{grid-template-columns:1fr;gap:3.5rem}
.ft-grid{grid-template-columns:1fr 1fr;gap:3rem}
}
@media(max-width:768px){
.nav-links,.nav-btn{display:none}.hamburger{display:flex}
.hero{padding:90px 5vw 60px;min-height:auto}.hero-h1{font-size:2.8rem}
.hero-trust{gap:1.2rem;margin-top:3rem}
.sec{padding:6rem 5vw}
.proc-track{grid-template-columns:1fr}
.proc-step{border-right:none;border-bottom:1px solid rgba(255,255,255,.08);padding:2rem 0!i
.testi-row{grid-template-columns:1fr}
.f2{grid-template-columns:1fr}
.why-grid{grid-template-columns:1fr}
.why-cell{border-right:none!important;padding:1.8rem 0!important}
.areas-list{grid-template-columns:1fr}
.area-item{border-right:none!important;padding-left:0!important;padding-right:0!important}
.closer{padding:7rem 5vw}.closer-btns{flex-direction:column;align-items:center}
.ft-grid{grid-template-columns:1fr}.ft-bottom{flex-direction:column}
.booking-panel{padding:5rem 5vw}.booking-panel-inner{gap:3rem}
}
@media(max-width:480px){
.hero-h1{font-size:2.2rem}.hero-actions{flex-direction:column;align-items:flex-start}
.wa-float{bottom:1rem;right:1rem}
}
`;
/* ================================================
ROOT
================================================ */
export default function App() {
const waLink = buildWhatsAppLink({ from:"", to:"", date:"", time:"", pax:"1", bags:"1", far
return (
<>
<style dangerouslySetInnerHTML={{ __html: CSS }}/>
<Nav/>
<Hero/>
<TrustStrip/>
<InlineBooking/>
<Services/>
<Why/>
<Areas/>
<Fleet/>
<Process/>
<Moments/>
<Testimonials/>
<Closer/>
<Footer/>
<a href={waLink} target="_blank" rel="noopener noreferrer" className="wa-float" aria-la
<WAIcon s={17}/><span>Reserve</span>
</a>
</>
);
}
