import { useState, useEffect, useRef } from “react”;

/* image constants */
const MOMENTS_MAIN = “/images/moments-main.jpg”;
const MOMENTS_ACCENT = “/images/moments-accent.jpg”;
const FLEET_IMG = “/images/fleet.jpg”;

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

const AIRPORT_FIXED = {
“cbd”: 105, “melbourne cbd”: 105,
“city”: 105, “docklands”: 105,
“southbank”: 110, “south melbourne”: 110,
“carlton”: 108, “fitzroy”: 110,
“collingwood”: 110, “richmond”: 115,
“south yarra”: 120, “prahran”: 120,
“chapel street”: 120, “hawthorn”: 120,
“toorak”: 125, “malvern”: 125,
“camberwell”: 130, “st kilda”: 130,
“elwood”: 132,
“brighton”: 145, “bayside”: 145,
“hampton”: 148, “sandringham”: 150,
“mentone”: 155, “cheltenham”: 155,
“moorabbin”: 155, “oakleigh”: 158,
“chadstone”: 158, “glen waverley”: 165,
“knox”: 168, “dandenong”: 175,
“frankston”: 245, “mornington”: 275,
“mount eliza”: 260, “mount martha”: 285,
“dromana”: 300, “rosebud”: 315,
“rye”: 330, “sorrento”: 350,
“portsea”: 375, “peninsula”: 310,
“essendon”: 115, “brunswick”: 108,
“coburg”: 110, “northcote”: 110,
“footscray”: 108, “williamstown”: 115,
“werribee”: 165, “hoppers crossing”: 165,
“geelong”: 175, “torquay”: 185,
“barwon heads”: 190, “surf coast”: 195,
“lilydale”: 175, “healesville”: 195,
“yarra valley”: 195, “yarra glen”: 195,
“warburton”: 215,
};

const ROUTE_TABLE = [
{ keys: [[“airport”,“cbd”],[“airport”,“melbourne city”],[“airport”,“southern cross”],[“airport”,“flinders”],[“tullamarine”,“cbd”]], km: 23, min: 25 },
{ keys: [[“airport”,“southbank”],[“airport”,“crown”],[“airport”,“docklands”],[“tullamarine”,“southbank”]], km: 25, min: 27 },
{ keys: [[“airport”,“st kilda”],[“airport”,“south yarra”],[“airport”,“prahran”],[“airport”,“chapel street”],[“tullamarine”,“st kilda”]], km: 30, min: 33 },
{ keys: [[“airport”,“richmond”],[“airport”,“hawthorn”],[“airport”,“camberwell”],[“tullamarine”,“richmond”]], km: 28, min: 30 },
{ keys: [[“airport”,“brighton”],[“airport”,“bayside”],[“airport”,“sandringham”],[“tullamarine”,“brighton”]], km: 37, min: 40 },
{ keys: [[“airport”,“toorak”],[“airport”,“malvern”],[“tullamarine”,“toorak”]], km: 31, min: 34 },
{ keys: [[“airport”,“geelong”],[“airport”,“torquay”],[“tullamarine”,“geelong”]], km: 90, min: 65 },
{ keys: [[“airport”,“mornington”],[“airport”,“portsea”],[“airport”,“sorrento”],[“airport”,“peninsula”],[“tullamarine”,“mornington”]], km: 95, min: 70 },
{ keys: [[“airport”,“yarra valley”],[“airport”,“healesville”],[“airport”,“lilydale”],[“tullamarine”,“yarra valley”]], km: 80, min: 60 },
{ keys: [[“airport”,“avalon”],[“tullamarine”,“avalon”]], km: 50, min: 42 },
{ keys: [[“avalon”,“cbd”],[“avalon”,“city”],[“avalon”,“southern cross”]], km: 56, min: 47 },
{ keys: [[“avalon”,“southbank”],[“avalon”,“docklands”]], km: 58, min: 49 },
{ keys: [[“avalon”,“geelong”]], km: 20, min: 20 },
{ keys: [[“park hyatt”,“airport”],[“langham”,“airport”],[“sofitel”,“airport”],[“crown”,“airport”]], km: 24, min: 26 },
];

const NEARBY_GROUPS = [
[“mornington”, “mount eliza”, “mount martha”],
[“brighton”, “hampton”, “sandringham”],
[“south yarra”, “prahran”, “windsor”],
[“richmond”, “hawthorn”],
[“st kilda”, “elwood”, “balaclava”],
[“cbd”, “southbank”, “docklands”, “carlton”],
[“toorak”, “malvern”],
];

const ZONE_GROUPS = [
[“mornington”, “mount eliza”, “mount martha”, “frankston”],
[“dromana”, “rosebud”, “rye”, “sorrento”, “portsea”],
[“brighton”, “hampton”, “sandringham”, “cheltenham”, “mentone”, “st kilda”, “elwood”, “balaclava”],
[“south yarra”, “prahran”, “richmond”, “windsor”, “toorak”, “hawthorn”, “malvern”, “camberwell”],
[“cbd”, “southbank”, “docklands”, “carlton”, “fitzroy”, “collingwood”],
];

function isAirport(text) {
const t = text.toLowerCase().replace(/[^a-z0-9 ]/g, “ “);
return (
t.includes(“airport”) || t.includes(“tullamarine”) ||
t.includes(” mel “) || t.includes(”(mel)”) ||
t.includes(“terminal”) || t.includes(“avalon”) || t.includes(“avv”)
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

function normalizeAddress(text) {
return text
.toLowerCase()
.replace(/\bvic\b|\bnsw\b|\bqld\b|\bsa\b|\bwa\b|\btas\b|\bact\b|\bnt\b/g, “ “)
.replace(/\b3\d{3}\b/g, “ “)
.replace(/[^a-z0-9 ]/g, “ “)
.replace(/\s+/g, “ “)
.trim();
}

function suburbToken(normalized) {
const words = normalized.split(” “);
if (words.length >= 2) {
const two = words[0] + “ “ + words[1];
const keys = Object.keys(AIRPORT_FIXED);
if (keys.includes(two)) return two;
}
return words[0] || normalized;
}

function getAnchor(text) {
const n = normalizeAddress(text);
const sorted = Object.entries(AIRPORT_FIXED).sort((a, b) => b[0].length - a[0].length);
for (const [key, val] of sorted) {
const re = new RegExp(”(?:^| )” + key.replace(/ /g, “ “) + “(?= |$)”);
if (re.test(n)) return val;
}
return null;
}

function inGroup(normalised, group) {
return group.some(k => {
const re = new RegExp(”(?:^| )” + k.replace(/ /g, “ “) + “(?= |$)”);
return re.test(normalised);
});
}

function isSameSuburb(normA, normB) {
if (normA === normB) return true;
const ta = suburbToken(normA);
const tb = suburbToken(normB);
return ta.length > 2 && ta === tb;
}

function airportFixedFare(from, to) {
if (!isAirport(from + “ “ + to)) return null;
const combined = normalizeAddress(from + “ “ + to);
const sorted = Object.entries(AIRPORT_FIXED).sort((a, b) => b[0].length - a[0].length);
for (const [zone, price] of sorted) {
const re = new RegExp(”(?:^| )” + zone.replace(/ /g, “ “) + “(?= |$)”);
if (re.test(combined)) return price;
}
return null;
}

function lookupRoute(from, to) {
const combined = (from + “ “ + to).toLowerCase();
for (const route of ROUTE_TABLE) {
for (const pair of route.keys) {
if (combined.includes(pair[0]) && combined.includes(pair[1])) {
return { km: route.km, min: route.min };
}
}
}
return null;
}

function anchorSuburbFare(from, to) {
const af = getAnchor(from);
const at = getAnchor(to);
const anchors = [af, at].filter(a => a !== null);

if (anchors.length === 0) {
return applyLateAndRound(PRICING.MIN_FARE + PRICING.BUFFER + 15);
}

const nf = normalizeAddress(from);
const nt = normalizeAddress(to);
const cap = Math.max(…anchors);

if (isSameSuburb(nf, nt)) return PRICING.MIN_FARE;

let base;
if (NEARBY_GROUPS.some(g => inGroup(nf, g) && inGroup(nt, g))) {
const avg = anchors.reduce((s, a) => s + a, 0) / anchors.length;
base = avg * 0.40;
} else if (ZONE_GROUPS.some(g => inGroup(nf, g) && inGroup(nt, g))) {
base = Math.min(…anchors) * 0.50;
} else {
base = Math.max(…anchors) * 0.65;
}

const fare = Math.min(cap, Math.max(PRICING.MIN_FARE, base));
return applyLateAndRound(fare + PRICING.BUFFER);
}

function calculateFare(from, to) {
const airportRoute = isAirport(from + “ “ + to);
const airFixed = airportFixedFare(from, to);
if (airFixed !== null) {
return applyLateAndRound(airFixed + PRICING.BUFFER);
}
if (airportRoute) {
const route = lookupRoute(from, to);
if (route) {
let fare = PRICING.BASE_FEE + distanceCost(route.km) + route.min * PRICING.PER_MIN;
fare = Math.max(fare, PRICING.MIN_FARE) + PRICING.BUFFER;
return applyLateAndRound(fare);
}
return applyLateAndRound(120 + PRICING.BUFFER);
}
return anchorSuburbFare(from, to);
}

function estimateFare(from, to) {
if (from.trim().length < 4 || to.trim().length < 4) return null;
const fare = calculateFare(from, to);
const isAirportRoute = isAirport(from + “ “ + to);
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

const GOOGLE_PLACES_API_KEY = “”;

const MEL_CENTER = { lat: -37.8136, lng: 144.9631 };
const MEL_RADIUS = 100000;

const DEMO_SUGGESTIONS = [
{ main: “Melbourne Airport (Tullamarine)”, sub: “Terminal Drive, Tullamarine VIC 3045” },
{ main: “Avalon Airport”, sub: “80 Beach Rd, Lara VIC 3212” },
{ main: “Melbourne CBD”, sub: “Melbourne VIC 3000” },
{ main: “Southern Cross Station”, sub: “Spencer St, Docklands VIC 3008” },
{ main: “Flinders Street Station”, sub: “Flinders St, Melbourne VIC 3000” },
{ main: “Docklands”, sub: “VIC 3008” },
{ main: “Southbank”, sub: “VIC 3006” },
{ main: “Crown Melbourne”, sub: “8 Whiteman St, Southbank VIC 3006” },
{ main: “Park Hyatt Melbourne”, sub: “1 Parliament Pl, Melbourne VIC 3002” },
{ main: “Langham Hotel Melbourne”, sub: “1 Southgate Ave, Southbank VIC 3006” },
{ main: “Sofitel Melbourne On Collins”, sub: “25 Collins St, Melbourne VIC 3000” },
{ main: “St Kilda”, sub: “VIC 3182” },
{ main: “South Yarra”, sub: “VIC 3141” },
{ main: “Prahran”, sub: “VIC 3181” },
{ main: “Toorak”, sub: “VIC 3142” },
{ main: “Richmond”, sub: “VIC 3121” },
{ main: “Hawthorn”, sub: “VIC 3122” },
{ main: “Camberwell”, sub: “VIC 3124” },
{ main: “Malvern”, sub: “VIC 3144” },
{ main: “Brighton”, sub: “VIC 3186” },
{ main: “Brighton Beach”, sub: “Brighton VIC 3186” },
{ main: “Sandringham”, sub: “VIC 3191” },
{ main: “Bayside”, sub: “VIC 3186” },
{ main: “Fitzroy”, sub: “VIC 3065” },
{ main: “Collingwood”, sub: “VIC 3066” },
{ main: “Carlton”, sub: “VIC 3053” },
{ main: “Brunswick”, sub: “VIC 3056” },
{ main: “Mornington Peninsula”, sub: “Mornington VIC 3931” },
{ main: “Sorrento”, sub: “VIC 3943” },
{ main: “Portsea”, sub: “VIC 3944” },
{ main: “Yarra Valley”, sub: “Yarra Glen VIC 3775” },
{ main: “Healesville”, sub: “VIC 3777” },
{ main: “Geelong CBD”, sub: “Geelong VIC 3220” },
{ main: “Torquay”, sub: “VIC 3228” },
{ main: “Barwon Heads”, sub: “VIC 3227” },
];

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
const s = document.createElement(“script”);
s.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&callback=__vernoGoogleReady`;
s.async = true;
s.defer = true;
s.onerror = () => { _googleScriptLoading = false; };
document.head.appendChild(s);
}

function AddressField({ label, placeholder, value, onChange, id, inputRef }) {
const internalRef = useRef(null);
const fieldRef = inputRef || internalRef;
const wrapRef = useRef(null);
const acRef = useRef(null);
const [suggestions, setSuggestions] = useState([]);
const [open, setOpen] = useState(false);
const [useGoogle, setUseGoogle] = useState(false);
const debounceRef = useRef(null);

useEffect(() => {
if (!GOOGLE_PLACES_API_KEY) return;
loadGooglePlaces(() => {
if (!fieldRef.current || acRef.current) return;
const ac = new window.google.maps.places.Autocomplete(fieldRef.current, {
types: [],
componentRestrictions: { country: “au” },
bounds: new window.google.maps.LatLngBounds(
new window.google.maps.LatLng(MEL_CENTER.lat - 0.8, MEL_CENTER.lng - 0.8),
new window.google.maps.LatLng(MEL_CENTER.lat + 0.8, MEL_CENTER.lng + 0.8)
),
strictBounds: false,
fields: [“formatted_address”, “geometry”, “name”, “place_id”],
});
ac.addListener(“place_changed”, () => {
const place = ac.getPlace();
const addr = place.formatted_address || place.name || “”;
onChange(addr);
setSuggestions([]);
setOpen(false);
});
acRef.current = ac;
setUseGoogle(true);
});
}, []);

useEffect(() => {
const fn = e => {
if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
};
document.addEventListener(“mousedown”, fn);
return () => document.removeEventListener(“mousedown”, fn);
}, []);

useEffect(() => {
if (useGoogle) return;
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
onChange(item.main + “, “ + item.sub);
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

const WA_NUMBER = “610421238894”;
const VERNO_EMAIL = “book@vernochauffeur.com.au”;

function buildWhatsAppLink({ from, to, date, time, pax, bags, fare }) {
const fareStr = fare ? `$${fare}` : null;
const msg = [
“Hello, I’d like to book a transfer:”,
“”,
`Pickup: ${from || "--"}`,
`Drop-off: ${to || "--"}`,
…(fareStr ? [`Estimated fare: ${fareStr}`] : []),
“”,
“Please confirm availability.”,
].join(”\n”);
return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

function WAIcon({ s = 20 }) {
return (
<svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor">
<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
<path d="M12 0C5.373 0 0 5.373 0 12c0 2.124.558 4.118 1.534 5.845L0 24l6.335-1.518A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.002-1.366l-.359-.214-3.723.976.993-3.63-.234-.373A9.818 9.818 0 1112 21.818z"/>
</svg>
);
}

function MsgIcon({ s = 14 }) {
return (
<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
<polyline points="22,6 12,13 2,6"/>
</svg>
);
}

function useReveal(ref) {
useEffect(() => {
const root = ref && ref.current;
if (!root) return;
const obs = new IntersectionObserver(
(entries) => entries.forEach(e => {
if (e.isIntersecting) { e.target.classList.add(“in”); obs.unobserve(e.target); }
}),
{ threshold: 0.06 }
);
root.querySelectorAll(”.rv”).forEach(el => obs.observe(el));
return () => obs.disconnect();
});
}

function VernoMark({ dark = false, h = 44 }) {
const ink = dark ? “#111111” : “#FFFFFF”;
const sub = dark ? “rgba(17,17,17,.4)” : “rgba(255,255,255,.38)”;
const gold = “#9E8A6A”;
return (
<svg width={h * 4.6} height={h} viewBox=“0 0 230 44” fill=“none” style={{ display: “block” }}>
<rect x="0" y="19" width="3" height="3" rx="1.5" fill={gold}/>
<text x="10" y="32" fontFamily="'Playfair Display',Georgia,serif" fontSize="22" fontWeight="400" fill={ink}>VERNO</text>
<text x="10" y="42" fontFamily="'Inter',Helvetica Neue,Helvetica,sans-serif" fontSize="7" fontWeight="300" letterSpacing="3" fill={sub}>PREMIUM TRANSFERS</text>
</svg>
);
}

function FareEstimate({ from, to }) {
const [state, setState] = useState(“idle”);
const [result, setResult] = useState(null);
const timerRef = useRef(null);

useEffect(() => {
const fromOk = from.trim().length > 4;
const toOk = to.trim().length > 4;
if (fromOk && toOk) {
setState(“calculating”);
clearTimeout(timerRef.current);
timerRef.current = setTimeout(() => {
const r = estimateFare(from, to);
setResult(r);
setState(r ? “shown” : “idle”);
}, 500);
} else {
clearTimeout(timerRef.current);
setState(“idle”);
setResult(null);
}
return () => clearTimeout(timerRef.current);
}, [from, to]);

if (state === “idle”) return null;

if (state === “calculating”) return (

<div className="fare-estimate">
<div className="fare-calculating">
<div className="fare-dot"/><div className="fare-dot"/><div className="fare-dot"/>
<span style={{ marginLeft: ".5rem", fontSize: ".75rem", color: "rgba(255,255,255,.35)", fontWeight: 300 }}>Calculating fare...</span>
</div>
</div>
);

if (state === “shown” && result) {
const labelText = result.isFallback ? “Estimated Fare” : (result.isFixed ? “Fixed Price” : “Estimated Fare”);
return (

<div className="fare-estimate">
<div style={{ width: "100%" }}>
<div className="fare-label">{labelText}{result.isLate ? " - Late-night rate" : ""}</div>
<div className="fare-price">${result.fare}</div>
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
);
}

return null;
}

function Nav() {
const [solid, setSolid] = useState(false);
const [menu, setMenu] = useState(false);

useEffect(() => {
const fn = () => setSolid(window.scrollY > 60);
window.addEventListener(“scroll”, fn, { passive: true });
return () => window.removeEventListener(“scroll”, fn);
}, []);

useEffect(() => {
document.body.style.overflow = menu ? “hidden” : “”;
return () => { document.body.style.overflow = “”; };
}, [menu]);

const close = () => setMenu(false);
const waLink = buildWhatsAppLink({ from: “”, to: “”, date: “”, time: “”, pax: “1”, bags: “1”, fare: null });

return (
<>

<nav className={`nav${solid ? " solid" : ""}`}>
<a href="#" className="nav-logo-wrap" onClick={close}><VernoMark dark={solid} h={34}/></a>
<ul className="nav-links">
{[["#services","Services"],["#fleet","Fleet"],["#areas","Coverage"],["#about","About"]].map(([h, l]) => (
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
{[["#book","Reserve"],["#services","Services"],["#fleet","Fleet"],["#areas","Coverage"],["#about","About"]].map(([h, l]) => (
<li key={l}><a href={h} onClick={close}>{l}</a></li>
))}
</ul>
<div className="mob-contact">
<a href={`mailto:${VERNO_EMAIL}`} onClick={close}>{VERNO_EMAIL}</a>
</div>
<a href={waLink} target="_blank" rel="noopener noreferrer" className="mob-cta" onClick={close}>
<WAIcon s={16}/>&nbsp; Reserve via WhatsApp
</a>
</div>
</>
);
}

function Hero() {
const waLink = buildWhatsAppLink({ from: “”, to: “”, date: “”, time: “”, pax: “1”, bags: “1”, fare: null });
return (

<section className="hero">
<p className="hero-label">Melbourne Private Chauffeur</p>
<h1 className="hero-h1">
Private chauffeur service<br/>in Melbourne.
</h1>
<p className="hero-sub">Fixed fares. Direct booking. No apps. Airport &amp; corporate transfers.</p>
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

function TrustStrip() {
return (

<div className="trust-strip">
<div className="trust-strip-inner">
{["Professional chauffeur","Melbourne based","Private service","No platform fees"].map((t, i) => (
<div key={i} className="trust-item">
<div className="trust-item-dot"/>
<span>{t}</span>
</div>
))}
</div>
</div>
);
}

function InlineBooking() {
const [from, setFrom] = useState(””);
const [to, setTo] = useState(””);
const [date, setDate] = useState(””);
const [time, setTime] = useState(””);
const [pax, setPax] = useState(“1”);
const [bags, setBags] = useState(“1”);
const pickupRef = useRef(null);
const fareResult = estimateFare(from, to);
const fare = fareResult ? fareResult.fare : null;

useEffect(() => {
const t = setTimeout(() => { if (pickupRef.current) pickupRef.current.focus(); }, 800);
return () => clearTimeout(t);
}, []);

const handleWA = () => {
const link = buildWhatsAppLink({ from, to, date, time, pax, bags, fare });
window.open(link, “_blank”, “noopener”);
};

const fillAirport = () => {
setTo(“Melbourne Airport (Tullamarine), Terminal Drive, Tullamarine VIC 3045”);
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
<input id="bp-date" className="fi" type="date" value={date} onChange={e => setDate(e.target.value)}/>
</div>
<div className="fg">
<label className="fl" htmlFor="bp-time">Time</label>
<input id="bp-time" className="fi" type="time" value={time} onChange={e => setTime(e.target.value)}/>
</div>
</div>
<div className="f2">
<div className="fg">
<label className="fl" htmlFor="bp-pax">Passengers</label>
<select className="fi" id="bp-pax" value={pax} onChange={e => setPax(e.target.value)}>
{[1,2,3,4].map(n => <option key={n}>{n}</option>)}
</select>
</div>
<div className="fg">
<label className="fl" htmlFor="bp-bags">Luggage</label>
<select className="fi" id="bp-bags" value={bags} onChange={e => setBags(e.target.value)}>
{[0,1,2,3,4].map(n => <option key={n}>{n}</option>)}
</select>
</div>
</div>
<FareEstimate from={from} to={to}/>
<button className="btn-whatsapp" onClick={handleWA}>
<WAIcon s={18}/> Confirm Booking via WhatsApp
</button>
<p className="btn-wa-note">We usually confirm within 2-5 minutes.</p>
<a href={`mailto:${VERNO_EMAIL}?subject=Booking Request`} className="btn-email-secondary">
Prefer email? {VERNO_EMAIL}
</a>
</div>
</div>
</div>
);
}

const SVC = [
{
id: “airport”, label: “Airport Transfers”,
h: “Airport Transfers”,
desc: “Seamless arrivals and departures from Tullamarine and Avalon. Flight monitored. Driver on time.”,
feats: [“Real-time flight monitoring”,“Meet and greet on arrival”,“All terminals - domestic and international”,“Fixed fare, no meter running”],
note: “Fixed fare from Melbourne CBD - no meter, no surge.”
},
{
id: “corporate”, label: “Corporate”,
h: “Corporate Travel”,
desc: “Reliable ground transport for executives and business guests. Consistent, discreet, professional.”,
feats: [“Dedicated account management”,“Consolidated invoicing available”,“Priority allocation for regular clients”,“Confidential travel - no discussion of client details”],
note: “Corporate accounts with consolidated billing available on request.”
},
{
id: “private”, label: “Private Hire”,
h: “Private Hire”,
desc: “A dedicated BMW i5 at your disposal. Yarra Valley, Mornington Peninsula, Great Ocean Road and beyond.”,
feats: [“From 3-hour engagement”,“Full day and multi-day available”,“Wine country and peninsula specialists”,“Tailored itineraries on request”],
note: “Hourly rate from a 3-hour minimum - all-inclusive quote provided.”
},
{
id: “events”, label: “Events”,
h: “Events & Occasions”,
desc: “Premium transport for weddings, corporate functions, and private occasions.”,
feats: [“Weddings and formal events”,“Corporate and black-tie functions”,“MCG, Rod Laver Arena, MCEC transfers”,“Multi-vehicle coordination available”],
note: “Custom event quotes - multi-vehicle coordination on request.”
},
];

function Services() {
const [active, setActive] = useState(0);
const ref = useRef(null);
useReveal(ref);
const s = SVC[active];
const waLink = buildWhatsAppLink({ from: s.label, to: “”, date: “”, time: “”, pax: “1”, bags: “1”, fare: null });

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
<svg className="svc-nav-arr" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
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
<a
href={waLink}
target="_blank"
rel="noopener noreferrer"
className="btn-wa"
onClick={e => { e.preventDefault(); window.open(buildWhatsAppLink({ from: s.label, to: "", date: "", time: "", pax: "1", bags: "1", fare: null }), "_blank", "noopener"); }}
>
<WAIcon s={15}/><span>Reserve via WhatsApp</span>
</a>
<a href={`mailto:${VERNO_EMAIL}?subject=Enquiry - ${s.label}`} className="btn-o">
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

function Why() {
const ref = useRef(null);
useReveal(ref);
return (

<section className="sec dark" id="about" ref={ref}>
<div className="wrap">
<div className="why-layout">
<div>
<div className="rv"><div className="s-label inv">Why VERNO</div></div>
<h2 className="s-h inv rv d1">A boutique<br/><em>standard.</em></h2>
<p className="s-body rv d2" style={{ marginTop: "1.2rem", maxWidth: 260, color: "rgba(255,255,255,.38)" }}>
Small fleet. Consistent quality. Every detail considered.
</p>
<a href={`mailto:${VERNO_EMAIL}`} className="rv d3" style={{ display: "flex", alignItems: "center", gap: ".5rem", marginTop: "2rem", fontSize: ".78rem", fontWeight: 300, color: "rgba(255,255,255,.35)", transition: "color .2s" }}>
<MsgIcon s={12}/>{VERNO_EMAIL}
</a>
</div>
<div className="why-grid rv d1">
{[
{ n: "01", t: "Fully electric", d: "BMW i5 - zero emissions, whisper-quiet, and precisely maintained for every journey." },
{ n: "02", t: "Discreet by design", d: "Your journey is private. No discussion of client details, itineraries, or destinations." },
{ n: "03", t: "Small, intentional fleet", d: "We keep our fleet small so every car and every journey meets the same standard." },
{ n: "04", t: "Direct booking", d: "No hold music, no chase. Submit your details via the form and receive a prompt, personal confirmation." },
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

function Areas() {
const ref = useRef(null);
useReveal(ref);
const areas = [
{ name: “Melbourne CBD”, time: “~30 min airport”, desc: “Collins Street, Southbank, Docklands, and the full CBD precinct.” },
{ name: “St Kilda & South Yarra”, time: “~40 min airport”, desc: “Chapel Street, Toorak Road, and the inner south-east suburbs.” },
{ name: “Mornington Peninsula”, time: “~80 min airport”, desc: “Portsea, Sorrento, Rye, Dromana, Rosebud, Mount Martha, and Mount Eliza.” },
{ name: “Yarra Valley”, time: “~70 min airport”, desc: “Healesville, Yering, Yarra Glen, and the wine region.” },
{ name: “Melbourne Airport”, time: “Tullamarine (MEL)”, desc: “All terminals. T1 International, T2, T3, T4 domestic. Flight monitoring included.” },
{ name: “Avalon Airport”, time: “Avalon (AVV)”, desc: “Direct transfers. Jetstar and international services.” },
{ name: “Geelong & Surf Coast”, time: “~70 min airport”, desc: “Geelong CBD, Torquay, Barwon Heads, and the Surf Coast.” },
{ name: “Greater Melbourne”, time: “All suburbs”, desc: “Essendon, Brighton, Hawthorn, Richmond, Carlton, and all metropolitan suburbs.” },
];

return (

<section className="sec" id="areas" ref={ref}>
<div className="wrap">
<div className="rv"><div className="s-label">Coverage</div></div>
<h2 className="s-h rv d1">Across Melbourne<br/><em>and beyond.</em></h2>
<div className="areas-list rv d2">
{areas.map(a => (
<div key={a.name} className="area-item" onClick={() => document.getElementById("book") && document.getElementById("book").scrollIntoView({ behavior: "smooth" })}>
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

function Fleet() {
const ref = useRef(null);
useReveal(ref);
const waLink = buildWhatsAppLink({ from: “”, to: “”, date: “”, time: “”, pax: “1”, bags: “1”, fare: null });

return (

<section className="sec fleet-section" id="fleet" ref={ref}>
<div className="wrap">
<div className="rv"><div className="s-label inv">The Fleet</div></div>
<div className="fleet-layout">
<div className="rv d1">
<div className="fleet-img-wrap">
<img src={FLEET_IMG} alt="VERNO BMW i5 fleet" className="fleet-img" loading="lazy"/>
</div>
</div>
<div className="fleet-text rv d2">
<p className="fleet-text-eyebrow">All-Electric Fleet</p>
<h2 className="fleet-text-title">BMW i5<br/><em>eDrive40</em></h2>
<p className="fleet-text-sub">Zero emissions. Executive comfort. Built for Melbourne.</p>
<p className="fleet-text-body">VERNO operates a dedicated fleet of premium electric sedans. Each vehicle is maintained to the same exacting standard, so the quality of your transfer is consistent every time.</p>
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
<a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-p" style={{ marginTop: "2.5rem", alignSelf: "flex-start" }}>
<WAIcon s={15}/><span>Reserve via WhatsApp</span>
</a>
</div>
</div>
</div>
</section>
);
}

function Process() {
const ref = useRef(null);
useReveal(ref);
return (

<section className="sec night2" ref={ref}>
<div className="wrap">
<div className="rv"><div className="s-label inv">How It Works</div></div>
<h2 className="s-h inv rv d1">Simple to arrange.<br/><em>Seamless to experience.</em></h2>
<div className="proc-track">
{[
{ r: "I", n: "Arrange your transfer", d: "Submit your journey details via the booking form. Pickup, destination, date, and time." },
{ r: "II", n: "Receive confirmation", d: "We respond with your confirmed reservation, driver details, and fixed fare - usually within minutes." },
{ r: "III", n: "Arrive in comfort", d: "Your BMW i5 and chauffeur are in position, on time. From door to destination." },
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

function Moments() {
const ref = useRef(null);
useReveal(ref);
const imgRef = useRef(null);

useEffect(() => {
const el = imgRef.current;
if (!el) return;
const obs = new IntersectionObserver(
([e]) => { if (e.isIntersecting) { el.classList.add(“entered”); obs.disconnect(); } },
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
<img src={MOMENTS_MAIN} alt="VERNO BMW i5 at Melbourne waterfront" className="moments-img" loading="lazy"/>
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
Every journey is designed to feel effortless - from the first message to final arrival. A standard maintained quietly, without announcement.
</p>
</div>
</div>
</section>
);
}

function Testimonials() {
const ref = useRef(null);
useReveal(ref);
return (

<section className="sec" ref={ref}>
<div className="wrap">
<div className="rv"><div className="s-label">Client Words</div></div>
<h2 className="s-h rv d1">What clients<br/><em>say.</em></h2>
<div className="testi-row">
{[
{ t: "Quiet, punctual, and completely professional. The BMW i5 is an exceptional vehicle for this kind of transfer.", by: "Corporate client, Melbourne CBD" },
{ t: "I requested by message in the morning and had a confirmed booking within the hour. Straightforward and reliable.", by: "Airport transfer, Toorak" },
{ t: "How you arrive matters. This service understands that without needing to be told.", by: "Private hire, Mornington Peninsula" },
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

function Closer() {
const ref = useRef(null);
useReveal(ref);
const waLink = buildWhatsAppLink({ from: “”, to: “”, date: “”, time: “”, pax: “1”, bags: “1”, fare: null });
return (

<section className="closer" id="contact" ref={ref}>
<div className="closer-inner">
<p className="s-label inv rv" style={{ marginBottom: "2rem" }}>Melbourne, Victoria</p>
<h2 className="closer-h rv d1">Ready when<br/><em>you are.</em></h2>
<p className="closer-sub rv d2">Reserve your transfer directly. Instant confirmation, fixed price.</p>
<div className="closer-btns rv d2">
<a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-wa">
<WAIcon s={16}/><span>Reserve via WhatsApp</span>
</a>
<a href={`mailto:${VERNO_EMAIL}?subject=Booking Request`} className="btn-outline">
<span>Send an Email</span>
</a>
</div>
<p className="rv d3" style={{ marginTop: "1.5rem", fontSize: ".73rem", fontWeight: 300, color: "rgba(255,255,255,.2)", letterSpacing: ".04em" }}>{VERNO_EMAIL}</p>
</div>
</section>
);
}

function Footer() {
const waLink = buildWhatsAppLink({ from: “”, to: “”, date: “”, time: “”, pax: “1”, bags: “1”, fare: null });
return (

<footer>
<div className="ft-grid">
<div>
<a href="#" className="ft-logo-wrap"><VernoMark dark={false} h={32}/></a>
<p className="ft-tagline">Private electric chauffeur for Melbourne.</p>
<a href={`mailto:${VERNO_EMAIL}`} className="ft-msg-link"><MsgIcon s={12}/>{VERNO_EMAIL}</a>
</div>
<div>
<p className="ft-col-h">Services</p>
<ul className="ft-links">
{["Airport Transfers","Corporate Travel","Private Hire","Events","Point-to-Point"].map(l => (
<li key={l}><a href="#services">{l}</a></li>
))}
</ul>
</div>
<div>
<p className="ft-col-h">Coverage</p>
<ul className="ft-links">
{["Melbourne CBD","Melbourne Airport","Avalon Airport","Mornington Peninsula","Yarra Valley","Geelong"].map(l => (
<li key={l}><a href="#areas">{l}</a></li>
))}
</ul>
</div>
<div>
<p className="ft-col-h">Reservations</p>
<ul className="ft-links">
<li><a href={waLink} target="_blank" rel="noopener noreferrer">Reserve via WhatsApp</a></li>
<li><a href={`mailto:${VERNO_EMAIL}`}>{VERNO_EMAIL}</a></li>
<li><a href="#book">Fare Estimate</a></li>
</ul>
</div>
</div>
<div className="ft-bottom">
<p>&copy; 2025 VERNO Private Chauffeur - Melbourne</p>
<p>Melbourne - Airport - Corporate</p>
</div>
</footer>
);
}

const CSS = `@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400;1,600&family=Inter:wght@300;400;500&display=swap'); *,*::before,*::after{box-sizing:border-box;margin:0;padding:0} html{scroll-behavior:smooth;font-size:16px} :root{ --black:#111111;--white:#FFFFFF;--gold:#9E8A6A;--gold2:#B8A48A; --grey1:#F5F5F5;--grey2:#EBEBEB;--grey3:#999999;--grey4:#666666; --wa:#128C7E; --serif:'Playfair Display',Georgia,serif; --sans:'Inter','Helvetica Neue',Helvetica,Arial,sans-serif; --ease:cubic-bezier(.4,0,.2,1);--spring:cubic-bezier(.16,1,.3,1); } body{font-family:var(--sans);font-weight:400;background:var(--white);color:var(--black);-webkit-font-smoothing:antialiased} ::selection{background:var(--black);color:var(--white)} ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:var(--grey2)} a{color:inherit;text-decoration:none} button{font-family:var(--sans);cursor:pointer;border:none;background:none;color:inherit} input,select,textarea{font-family:var(--sans)} .nav{position:fixed;top:0;left:0;right:0;z-index:800;display:flex;align-items:center;justify-content:space-between;padding:1.4rem 5vw;transition:background .3s,border-color .3s;border-bottom:1px solid transparent} .nav.solid{background:rgba(255,255,255,.98);backdrop-filter:blur(16px);border-color:var(--grey2)} .nav-logo-wrap{display:block;line-height:0;transition:opacity .25s}.nav-logo-wrap:hover{opacity:.7} .nav-links{display:flex;gap:2.5rem;list-style:none} .nav-links a{font-size:.8rem;font-weight:400;letter-spacing:.04em;text-transform:uppercase;color:rgba(255,255,255,.6);transition:color .2s} .nav.solid .nav-links a{color:var(--grey4)}.nav-links a:hover{color:rgba(255,255,255,.95)}.nav.solid .nav-links a:hover{color:var(--black)} .nav-right{display:flex;align-items:center;gap:1.2rem} .nav-btn{font-size:.72rem;font-weight:400;letter-spacing:.1em;text-transform:uppercase;padding:.6rem 1.2rem;border:1px solid rgba(255,255,255,.25);color:rgba(255,255,255,.7);transition:border-color .2s,color .2s} .nav.solid .nav-btn{color:var(--grey4);border-color:var(--grey2)}.nav-btn:hover{border-color:rgba(255,255,255,.6);color:#fff} .hamburger{display:none;flex-direction:column;gap:5px;padding:6px} .hamburger span{display:block;width:22px;height:1.5px;background:rgba(255,255,255,.75);transition:transform .3s,opacity .3s} .nav.solid .hamburger span{background:var(--black)} .hamburger.open span:nth-child(1){transform:translateY(6.5px) rotate(45deg)}.hamburger.open span:nth-child(2){opacity:0}.hamburger.open span:nth-child(3){transform:translateY(-6.5px) rotate(-45deg)} .mob-drawer{position:fixed;inset:0;z-index:750;background:var(--black);display:flex;flex-direction:column;justify-content:flex-end;padding:5vw 5vw 4rem;opacity:0;pointer-events:none;transition:opacity .3s} .mob-drawer.open{opacity:1;pointer-events:all} .mob-links{list-style:none;display:flex;flex-direction:column;gap:.5rem;margin-bottom:3rem} .mob-links a{font-family:var(--serif);font-size:clamp(2rem,6vw,3rem);font-weight:400;color:rgba(255,255,255,.55);transition:color .2s;display:block;padding:.3rem 0} .mob-links a:hover{color:var(--white)} .mob-contact{margin-bottom:2rem}.mob-contact a{font-size:.85rem;font-weight:400;color:rgba(255,255,255,.35);letter-spacing:.04em} .mob-cta{display:inline-flex;align-items:center;gap:.6rem;font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;background:var(--wa);color:#fff;padding:.9rem 1.6rem} .hero{min-height:100svh;background:var(--black);display:flex;flex-direction:column;justify-content:flex-end;padding:0 5vw 8rem} .hero-label{font-size:.68rem;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:1.6rem;animation:fadeUp .5s .1s both} .hero-h1{font-family:var(--serif);font-size:clamp(2.8rem,6.5vw,6rem);font-weight:400;line-height:1.08;color:var(--white);margin-bottom:1.6rem;animation:fadeUp .5s .2s both} .hero-sub{font-size:.95rem;font-weight:300;color:rgba(255,255,255,.45);margin-bottom:3.5rem;max-width:480px;animation:fadeUp .5s .3s both} .hero-actions{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;animation:fadeUp .6s .5s both} .hero-trust{display:flex;align-items:center;gap:2.5rem;margin-top:6rem;flex-wrap:wrap;animation:fadeUp .5s .7s both} .hero-trust-item{font-size:.7rem;font-weight:300;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.25)} @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}} .btn-wa{display:inline-flex;align-items:center;gap:.65rem;font-size:.82rem;font-weight:500;letter-spacing:.04em;background:var(--wa);color:#fff;padding:.85rem 1.6rem;transition:background .2s} .btn-wa:hover{background:#0e7a6d}.btn-wa svg{flex-shrink:0} .btn-outline{display:inline-flex;align-items:center;gap:.65rem;font-size:.82rem;font-weight:400;letter-spacing:.04em;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.6);padding:.85rem 1.6rem;transition:border-color .2s,color .2s} .btn-outline:hover{border-color:rgba(255,255,255,.5);color:#fff} .btn-p{display:inline-flex;align-items:center;gap:.65rem;font-size:.82rem;font-weight:500;letter-spacing:.04em;background:var(--gold);color:#fff;padding:.85rem 1.6rem;transition:background .2s} .btn-p:hover{background:var(--gold2)} .btn-o{display:inline-flex;align-items:center;gap:.65rem;font-size:.8rem;font-weight:400;letter-spacing:.04em;border:1px solid var(--grey2);color:var(--grey4);padding:.82rem 1.5rem;transition:border-color .2s,color .2s} .btn-o:hover{border-color:var(--black);color:var(--black)} .trust-strip{background:var(--black);padding:.85rem 5vw;border-top:1px solid rgba(255,255,255,.06)} .trust-strip-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;gap:2.5rem;flex-wrap:wrap} .trust-item{display:flex;align-items:center;gap:.5rem;font-size:.7rem;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:rgba(255,255,255,.3)} .trust-item-dot{width:3px;height:3px;border-radius:50%;background:var(--gold);flex-shrink:0} .booking-panel{background:var(--white);padding:7rem 5vw} .booking-panel-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1.5fr;gap:7rem;align-items:start} .booking-panel-headline{font-family:var(--serif);font-size:clamp(1.8rem,2.5vw,2.4rem);font-weight:400;line-height:1.15;margin-bottom:1.2rem} .booking-panel-headline em{font-style:normal;color:var(--gold)} .booking-panel-sub{font-size:.88rem;font-weight:300;line-height:1.75;color:var(--grey4)} .booking-panel-form{display:flex;flex-direction:column} .fg{margin-bottom:1.4rem;position:relative} .fl{display:block;font-size:.7rem;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--grey4);margin-bottom:.5rem} .fi{width:100%;padding:.85rem .95rem;background:var(--grey1);border:1px solid transparent;font-size:.88rem;font-weight:400;color:var(--black);transition:border-color .2s,background .2s;outline:none;appearance:none} .fi:focus{border-color:var(--gold);background:var(--white)}.fi::placeholder{color:#c0bdb8}.fi option{background:var(--white)} .f2{display:grid;grid-template-columns:1fr 1fr;gap:1rem} .ac-wrap{position:relative} .ac-list{position:absolute;top:100%;left:0;right:0;z-index:200;background:var(--white);border:1px solid var(--grey2);border-top:none;max-height:280px;overflow-y:auto} .ac-item{display:block;width:100%;text-align:left;padding:.8rem 1rem;font-size:.85rem;font-weight:400;border-bottom:1px solid var(--grey1);transition:background .15s} .ac-item:last-child{border-bottom:none}.ac-item:hover,.ac-item:focus{background:var(--grey1);outline:none} .ac-item-main{display:block;font-size:.88rem;font-weight:500;color:var(--black);margin-bottom:.15rem} .ac-item-sub{display:block;font-size:.75rem;font-weight:300;color:var(--grey3)} .quick-chip{display:inline-flex;align-items:center;gap:.5rem;font-size:.7rem;font-weight:400;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--grey2);color:var(--grey4);padding:.55rem 1rem;margin-bottom:1.4rem;transition:background .2s,color .2s} .quick-chip:hover{background:var(--gold);color:var(--white)}.quick-chip-dot{width:5px;height:5px;border-radius:50%;background:var(--wa);flex-shrink:0} .fare-estimate{margin-top:1.8rem;padding:2rem 2.2rem;background:var(--black);margin-bottom:0} .fare-label{font-size:.65rem;font-weight:300;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:.6rem} .fare-price{font-family:var(--serif);font-size:4rem;font-weight:400;color:var(--white);line-height:1;margin-bottom:.5rem} .fare-guarantee{font-size:.72rem;font-weight:300;color:rgba(255,255,255,.3);line-height:1.5} .fare-trust{display:flex;flex-wrap:wrap;gap:.5rem 1.5rem;margin-top:1rem;padding-top:1rem;border-top:1px solid rgba(255,255,255,.07)} .fare-trust-item{font-size:.68rem;font-weight:300;color:rgba(255,255,255,.35);letter-spacing:.06em;text-transform:uppercase} .fare-calculating{display:flex;align-items:center;gap:.5rem;padding:1rem 0} .fare-dot{width:4px;height:4px;border-radius:50%;background:var(--gold);opacity:.6;animation:dotPulse 1s infinite} .fare-dot:nth-child(2){animation-delay:.15s}.fare-dot:nth-child(3){animation-delay:.3s} @keyframes dotPulse{0%,100%{opacity:.2}50%{opacity:.9}} .btn-whatsapp{width:100%;margin-top:1.6rem;padding:1.12rem;background:var(--wa);color:var(--white);font-size:.88rem;font-weight:500;letter-spacing:.04em;display:flex;align-items:center;justify-content:center;gap:.65rem;transition:background .2s} .btn-whatsapp:hover{background:#0e7a6d} .btn-wa-note{font-size:.72rem;font-weight:300;color:var(--grey3);text-align:center;margin-top:.85rem} .btn-email-secondary{display:flex;align-items:center;justify-content:center;margin-top:.9rem;font-size:.78rem;font-weight:300;color:var(--grey3);transition:color .2s;letter-spacing:.02em} .btn-email-secondary:hover{color:var(--black)} .sec{padding:9rem 5vw}.sec.pale{background:var(--grey1)}.sec.dark{background:var(--black)}.sec.night2{background:#0a0a0a} .wrap{max-width:1200px;margin:0 auto} .s-label{font-size:.68rem;font-weight:400;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:1.2rem} .s-label.inv{color:var(--gold)} .s-h{font-family:var(--serif);font-size:clamp(2.2rem,4vw,3.4rem);font-weight:400;line-height:1.1;margin-bottom:3.5rem} .s-h em{font-style:normal;color:var(--gold)}.s-h.inv{color:var(--white)}.s-h.inv em{color:var(--gold)} .s-body{font-size:.92rem;font-weight:300;line-height:1.75;color:var(--grey4)} .rv{opacity:0;transform:translateY(16px);transition:opacity .5s ease,transform .5s ease} .rv.in{opacity:1;transform:none}.d1{transition-delay:.06s}.d2{transition-delay:.12s}.d3{transition-delay:.18s} .svc-layout{display:grid;grid-template-columns:200px 1fr;gap:5rem;margin-top:4.5rem} .svc-nav{display:flex;flex-direction:column;gap:0} .svc-nav-item{display:flex;align-items:center;justify-content:space-between;padding:1.1rem 0;font-size:.82rem;font-weight:400;letter-spacing:.02em;color:var(--grey3);border-bottom:1px solid var(--grey2);transition:color .2s} .svc-nav-item.active,.svc-nav-item:hover{color:var(--black)}.svc-nav-item.active{font-weight:500} .svc-nav-arr{opacity:0;transition:opacity .2s;color:var(--gold);flex-shrink:0} .svc-nav-item.active .svc-nav-arr,.svc-nav-item:hover .svc-nav-arr{opacity:1} .svc-content-h{font-family:var(--serif);font-size:clamp(1.8rem,3vw,2.6rem);font-weight:400;line-height:1.15;margin-bottom:1.2rem} .svc-desc{font-size:.88rem;font-weight:300;line-height:1.88;color:var(--grey4);max-width:480px;margin-bottom:2rem} .svc-feat-list{list-style:none;display:flex;flex-direction:column;gap:.7rem;margin-bottom:2.5rem} .svc-feat-row{display:flex;align-items:baseline;gap:.75rem;font-size:.85rem;font-weight:300;color:var(--grey4)} .svc-feat-check{color:var(--gold);font-size:.75rem;flex-shrink:0} .svc-cta-row{display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem} .svc-note-clean{font-size:.77rem;font-weight:300;color:var(--grey3);line-height:1.65;padding-top:1.2rem;border-top:1px solid var(--grey2)} .why-layout{display:grid;grid-template-columns:320px 1fr;gap:6rem;align-items:start} .why-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(255,255,255,.1)} .why-cell{padding:2rem 2rem 2rem 0;border-bottom:1px solid rgba(255,255,255,.1);border-right:1px solid rgba(255,255,255,.1)} .why-cell:nth-child(even){padding-left:2rem;padding-right:0;border-right:none} .why-n{font-size:.65rem;font-weight:300;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:.8rem} .why-t{font-family:var(--serif);font-size:1.05rem;font-weight:400;color:var(--white);margin-bottom:.6rem} .why-d{font-size:.83rem;font-weight:300;line-height:1.75;color:rgba(255,255,255,.38)} .areas-list{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-top:1px solid var(--grey2);margin-top:3rem} .area-item{padding:2.2rem 1.5rem 2.2rem 0;border-right:1px solid var(--grey2);border-bottom:1px solid var(--grey2);cursor:pointer;transition:background .2s} .area-item:hover{background:var(--grey1)}.area-item:nth-child(4n){border-right:none;padding-right:0;padding-left:1.5rem} .area-name{font-family:var(--serif);font-size:1rem;font-weight:400;color:var(--black);margin-bottom:.4rem} .area-time{font-size:.68rem;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--gold);margin-bottom:.7rem} .area-desc{font-size:.78rem;font-weight:300;line-height:1.65;color:var(--grey4)} .fleet-section{background:var(--black)} .fleet-layout{display:grid;grid-template-columns:1.1fr 1fr;gap:6rem;align-items:center;margin-top:3.5rem} .fleet-img-wrap{position:relative;overflow:hidden;transition:transform .6s var(--spring)}.fleet-img{display:block;width:100%;object-fit:cover;transition:transform .6s var(--spring)} .fleet-img-wrap:hover .fleet-img{transform:scale(1.03)} .fleet-text{display:flex;flex-direction:column} .fleet-text-eyebrow{font-size:.68rem;font-weight:300;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.35);margin-bottom:.9rem} .fleet-text-title{font-family:var(--serif);font-size:clamp(2rem,2.8vw,2.6rem);font-weight:400;line-height:1.12;color:var(--white);margin-bottom:1.2rem} .fleet-text-title em{font-style:normal;color:var(--gold)} .fleet-text-sub{font-size:.95rem;font-weight:300;color:rgba(255,255,255,.45);line-height:1.65;margin-bottom:1rem} .fleet-text-body{font-size:.88rem;font-weight:300;line-height:1.75;color:rgba(255,255,255,.4);margin-bottom:1.5rem} .fleet-text-specs{display:flex;flex-direction:column;gap:.6rem;padding-top:1.8rem;border-top:1px solid rgba(255,255,255,.08);margin-bottom:1.8rem} .fleet-spec-item{display:flex;align-items:center;gap:.7rem;font-size:.82rem;font-weight:300;color:rgba(255,255,255,.45)} .fleet-spec-item::before{content:"--";color:var(--gold);font-size:.68rem;flex-shrink:0} .fleet-ev-badge{display:inline-flex;font-size:.63rem;font-weight:300;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);border:1px solid rgba(158,138,106,.3);padding:.4rem .8rem;align-self:flex-start} .proc-track{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(255,255,255,.08);margin-top:4rem} .proc-step{padding:2.5rem 2.5rem 2.5rem 0;border-right:1px solid rgba(255,255,255,.08)}.proc-step:last-child{border-right:none;padding-left:2.5rem;padding-right:0} .proc-roman{font-size:2.5rem;font-weight:600;color:var(--gold);opacity:.25;line-height:1;display:block;margin-bottom:1.2rem} .proc-name{font-family:var(--serif);font-size:1.15rem;font-weight:400;color:var(--white);margin-bottom:.7rem} .proc-desc{font-size:.85rem;font-weight:300;line-height:1.75;color:rgba(255,255,255,.38)} .moments{background:var(--black);padding:8rem 5vw} .moments-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1.35fr 1fr;gap:7rem;align-items:center} .moments-img-col{position:relative;overflow:hidden} .moments-img-wrap{position:relative;overflow:hidden} .moments-img{display:block;width:100%;object-fit:cover;aspect-ratio:16/9;filter:brightness(.85);transition:transform .8s var(--spring)} .moments-img-wrap.entered .moments-img{transform:scale(1.04)} .moments-geo{position:absolute;bottom:1.2rem;left:1.4rem;z-index:2;font-size:.68rem;font-weight:300;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.45);background:rgba(0,0,0,.4);padding:.35rem .7rem} .moments-text{display:flex;flex-direction:column} .moments-eyebrow{font-size:.68rem;font-weight:300;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:1.2rem} .moments-title{font-family:var(--serif);font-size:clamp(2rem,3.2vw,3rem);font-weight:400;line-height:1.2;color:var(--white);margin-bottom:1.8rem} .moments-title em{display:block;font-style:italic;color:rgba(255,255,255,.4)} .moments-rule{width:2.5rem;height:2px;background:var(--gold);margin-bottom:1.5rem} .moments-desc{font-size:.9rem;font-weight:300;line-height:1.75;color:rgba(255,255,255,.4);max-width:320px} .testi-row{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--grey2);margin-top:3.5rem} .testi{background:var(--white);padding:2.8rem 2.4rem 3.2rem;transition:background .2s}.testi:hover{background:var(--grey1)} .testi-mark{font-family:var(--serif);font-size:2rem;font-weight:400;color:var(--gold);opacity:.5;display:block;margin-bottom:.8rem;line-height:1} .testi-txt{font-family:var(--serif);font-size:.92rem;font-weight:400;font-style:italic;color:var(--black);line-height:1.75;margin-bottom:1.5rem} .testi-by{font-size:.68rem;font-weight:400;letter-spacing:.08em;text-transform:uppercase;color:var(--grey3)} .closer{background:var(--black);padding:10rem 5vw;text-align:center} .closer-inner{max-width:640px;margin:0 auto} .closer-h{font-family:var(--serif);font-size:clamp(2.8rem,5vw,4.5rem);font-weight:400;line-height:1.08;color:var(--white);margin-bottom:1.5rem} .closer-h em{font-style:italic;color:var(--gold)} .closer-sub{font-size:.88rem;font-weight:300;color:rgba(255,255,255,.32);margin-bottom:3.5rem;line-height:1.75} .closer-btns{display:flex;align-items:center;justify-content:center;gap:1.2rem;flex-wrap:wrap} footer{background:#080808;padding:5rem 5vw 2.5rem;border-top:1px solid rgba(255,255,255,.05)} .ft-grid{display:grid;grid-template-columns:1.8fr 1fr 1fr 1fr;gap:4rem;max-width:1200px;margin:0 auto 4rem} .ft-logo-wrap{display:block;margin-bottom:1.2rem;opacity:.85;transition:opacity .2s}.ft-logo-wrap:hover{opacity:1} .ft-tagline{font-size:.82rem;font-weight:300;color:rgba(255,255,255,.3);line-height:1.7;margin-bottom:1.2rem} .ft-msg-link{display:flex;align-items:center;gap:.5rem;font-size:.78rem;font-weight:300;color:rgba(255,255,255,.3);transition:color .2s}.ft-msg-link:hover{color:rgba(255,255,255,.6)} .ft-col-h{font-size:.63rem;font-weight:300;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.25);margin-bottom:1.2rem} .ft-links{list-style:none;display:flex;flex-direction:column;gap:.55rem} .ft-links a{font-size:.8rem;font-weight:300;color:rgba(255,255,255,.32);transition:color .2s;line-height:1.5}.ft-links a:hover{color:rgba(255,255,255,.7)} .ft-bottom{max-width:1200px;margin:0 auto;border-top:1px solid rgba(255,255,255,.05);padding-top:2rem;display:flex;justify-content:space-between;flex-wrap:wrap;gap:1rem} .ft-bottom p{font-size:.7rem;font-weight:300;color:rgba(255,255,255,.18)} .wa-float{position:fixed;bottom:2rem;right:2rem;z-index:950;display:flex;align-items:center;gap:.6rem;font-size:.78rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;background:var(--wa);color:#fff;padding:.75rem 1.3rem;box-shadow:0 4px 18px rgba(0,0,0,.25);transition:transform .2s,box-shadow .2s} .wa-float:hover{transform:translateY(-2px);box-shadow:0 8px 28px rgba(0,0,0,.34)} @media(max-width:1024px){ .booking-panel-inner{grid-template-columns:1fr;gap:4rem} .svc-layout{grid-template-columns:1fr} .svc-nav{border-bottom:1px solid var(--grey2);display:flex;overflow-x:auto} .svc-nav-item{white-space:nowrap;border-bottom:none;border-right:1px solid var(--grey2);min-width:120px;justify-content:center} .why-layout{grid-template-columns:1fr;gap:3.5rem} .fleet-layout{grid-template-columns:1fr;gap:3.5rem} .areas-list{grid-template-columns:repeat(2,1fr)} .moments-inner{grid-template-columns:1fr;gap:3.5rem} .ft-grid{grid-template-columns:1fr 1fr;gap:3rem} } @media(max-width:768px){ .nav-links,.nav-btn{display:none}.hamburger{display:flex} .hero{padding:90px 5vw 60px;min-height:auto}.hero-h1{font-size:2.8rem} .hero-trust{gap:1.2rem;margin-top:3rem} .sec{padding:6rem 5vw} .proc-track{grid-template-columns:1fr} .proc-step{border-right:none;border-bottom:1px solid rgba(255,255,255,.08);padding:2rem 0!important} .testi-row{grid-template-columns:1fr} .f2{grid-template-columns:1fr} .why-grid{grid-template-columns:1fr} .why-cell{border-right:none!important;padding:1.8rem 0!important} .areas-list{grid-template-columns:1fr} .area-item{border-right:none!important;padding-left:0!important;padding-right:0!important} .closer{padding:7rem 5vw}.closer-btns{flex-direction:column;align-items:center} .ft-grid{grid-template-columns:1fr}.ft-bottom{flex-direction:column} .booking-panel{padding:5rem 5vw}.booking-panel-inner{gap:3rem} } @media(max-width:480px){ .hero-h1{font-size:2.2rem}.hero-actions{flex-direction:column;align-items:flex-start} .wa-float{bottom:1rem;right:1rem} }`;

export default function App() {
const waLink = buildWhatsAppLink({ from: “”, to: “”, date: “”, time: “”, pax: “1”, bags: “1”, fare: null });
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
<a href={waLink} target="_blank" rel="noopener noreferrer" className="wa-float" aria-label="Reserve via WhatsApp">
<WAIcon s={17}/><span>Reserve</span>
</a>
</>
);
}
