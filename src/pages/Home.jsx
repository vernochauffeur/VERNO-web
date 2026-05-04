import { useState, useEffect, useRef } from "react";

const MOMENTS_MAIN = "/images/moments-main.jpg";
const FLEET_IMG = "/images/fleet.jpg";
const WA_NUMBER = "610421238894";
const VERNO_EMAIL = "book@vernochauffeur.com.au";

const PRICING = { MIN_FARE: 75, BASE_FEE: 15, PER_MIN: 0.6, RATE_0_25: 3.2, RATE_25_50: 2.8, RATE_50UP: 2.3, LATE_SURCHARGE: 0.15, LATE_START: 0, LATE_END: 5, BUFFER: 5, ROUND_TO: 5 };
const AIRPORT_FIXED = {
  "cbd": 100, "melbourne cbd": 100, "city": 100, "docklands": 100, "southbank": 110,
  "south melbourne": 105, "east melbourne": 110, "west melbourne": 105, "north melbourne": 105,
  "carlton": 105, "fitzroy": 110, "collingwood": 110, "richmond": 120,
  "park hyatt": 110, "grand hyatt": 105, "crown": 110, "sofitel": 110, "langham": 110,
  "w melbourne": 100, "ritz carlton": 110, "marriott": 105,
  "south yarra": 120, "prahran": 120, "windsor": 120, "toorak": 125, "malvern": 125,
  "armadale": 125, "hawksburn": 125, "camberwell": 130, "hawthorn": 130, "kew": 135,
  "footscray": 105, "yarraville": 110, "seddon": 110, "brunswick": 110, "coburg": 115,
  "northcote": 120, "preston": 120, "essendon": 115,
  "st kilda": 125, "elwood": 130, "balaclava": 130, "brighton": 140, "hampton": 145,
  "sandringham": 150, "mentone": 155, "cheltenham": 155,
  "chadstone": 140, "oakleigh": 145, "glen waverley": 155, "knox": 160, "dandenong": 170,
  "frankston": 220, "mount eliza": 240, "mornington": 260, "mount martha": 280,
  "dromana": 300, "rosebud": 320, "rye": 340, "sorrento": 360, "portsea": 380,
  "werribee": 150, "hoppers crossing": 155, "geelong": 180, "torquay": 190, "barwon heads": 195,
  "lilydale": 170, "healesville": 190, "yarra valley": 190, "yarra glen": 185
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
  ["cbd", "southbank", "docklands", "carlton"], ["toorak", "malvern"],
];
const ZONE_GROUPS = [
  ["mornington", "mount eliza", "mount martha", "frankston"], ["dromana", "rosebud", "rye", "sorrento", "portsea"],
  ["brighton", "hampton", "sandringham", "cheltenham", "mentone", "st kilda", "elwood", "balaclava"],
  ["south yarra", "prahran", "richmond", "windsor", "toorak", "hawthorn", "malvern", "camberwell"],
  ["cbd", "southbank", "docklands", "carlton", "fitzroy", "collingwood"]
];

function normalizeAddress(text) { return text.toLowerCase().replace(/\bvic\b|\bnsw\b|\bqld\b|\bsa\b|\bwa\b|\btas\b|\bact\b|\bnt\b/g, " ").replace(/\b3\d{3}\b/g, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
function isAirport(text) { const t = normalizeAddress(text); return t.includes("airport") || t.includes("tullamarine") || t.includes("terminal") || t.includes("avalon") || t.includes("avv") || t.includes(" mel "); }
function isLateNight(bookingTime) {
  let h;
  if (bookingTime) {
    h = parseInt(bookingTime.split(":")[0], 10);
  } else {
    h = new Date().getHours();
  }
  return h >= PRICING.LATE_START && h < PRICING.LATE_END;
}
function distanceCost(km) { if (km <= 25) return km * PRICING.RATE_0_25; if (km <= 50) return 25 * PRICING.RATE_0_25 + (km - 25) * PRICING.RATE_25_50; return 25 * PRICING.RATE_0_25 + 25 * PRICING.RATE_25_50 + (km - 50) * PRICING.RATE_50UP; }
function roundFare(n) { return Math.round(n / PRICING.ROUND_TO) * PRICING.ROUND_TO; }
function applyLateAndRound(fare, bookingTime) { return roundFare(isLateNight(bookingTime) ? Math.round(fare * (1 + PRICING.LATE_SURCHARGE)) : fare); }
function suburbToken(n) { const words = n.split(" "); const two = words.length >= 2 ? words[0] + " " + words[1] : ""; return Object.keys(AIRPORT_FIXED).includes(two) ? two : (words[0] || n); }
function getAnchor(text) { const n = normalizeAddress(text); const sorted = Object.entries(AIRPORT_FIXED).sort((a, b) => b[0].length - a[0].length); for (const [key, val] of sorted) { if (new RegExp("(?:^| )" + key.replace(/ /g, " ") + "(?= |$)").test(n)) return val; } return null; }
function inGroup(n, group) { return group.some((k) => new RegExp("(?:^| )" + k.replace(/ /g, " ") + "(?= |$)").test(n)); }
function isSameSuburb(a, b) { if (a === b) return true; const ta = suburbToken(a); const tb = suburbToken(b); return ta.length > 2 && ta === tb; }
function airportFixedFare(from, to) {
  const combined = normalizeAddress(from + " " + to);
  if (!isAirport(from + " " + to)) return null;
  if (combined.includes("cbd") || combined.includes("city") || combined.includes("3000")) return 100;
  if (combined.includes("park hyatt")) return 110;
  if (combined.includes("sofitel")) return 110;
  if (combined.includes("ritz")) return 110;
  if (combined.includes("w melbourne") || combined.includes("flinders")) return 100;
  if (combined.includes("grand hyatt")) return 100;
  if (combined.includes("crown")) return 105;
  if (combined.includes("langham")) return 105;
  const sorted = Object.entries(AIRPORT_FIXED).sort((a, b) => b[0].length - a[0].length);
  for (const [zone, price] of sorted) { if (combined.includes(zone)) return price; }
  return null;
}
function lookupRoute(from, to) { const combined = (from + " " + to).toLowerCase(); for (const route of ROUTE_TABLE) { for (const pair of route.keys) { if (combined.includes(pair[0]) && combined.includes(pair[1])) return { km: route.km, min: route.min }; } } return null; }
function anchorSuburbFare(from, to, bookingTime) { const af = getAnchor(from); const at = getAnchor(to); const anchors = [af, at].filter((a) => a !== null); if (anchors.length === 0) return applyLateAndRound(PRICING.MIN_FARE + PRICING.BUFFER + 15, bookingTime); const nf = normalizeAddress(from); const nt = normalizeAddress(to); const cap = Math.max(...anchors); if (isSameSuburb(nf, nt)) return PRICING.MIN_FARE; let base; if (NEARBY_GROUPS.some((g) => inGroup(nf, g) && inGroup(nt, g))) { base = anchors.reduce((s, a) => s + a, 0) / anchors.length * 0.40; } else if (ZONE_GROUPS.some((g) => inGroup(nf, g) && inGroup(nt, g))) { base = Math.min(...anchors) * 0.50; } else { base = Math.max(...anchors) * 0.65; } return applyLateAndRound(Math.min(cap, Math.max(PRICING.MIN_FARE, base)) + PRICING.BUFFER, bookingTime); }
function calculateFare(from, to, bookingTime) {
  const fixed = airportFixedFare(from, to);
  if (fixed !== null) return roundFare(fixed + PRICING.BUFFER);
  if (isAirport(from + " " + to)) {
    const route = lookupRoute(from, to);
    if (route) return applyLateAndRound(Math.max(PRICING.BASE_FEE + distanceCost(route.km) + route.min * PRICING.PER_MIN, PRICING.MIN_FARE) + PRICING.BUFFER, bookingTime);
    return applyLateAndRound(120 + PRICING.BUFFER, bookingTime);
  }
  return anchorSuburbFare(from, to, bookingTime);
}
function estimateFare(from, to, bookingTime) { if (from.trim().length < 4 || to.trim().length < 4) return null; const fixed = airportFixedFare(from, to) !== null || lookupRoute(from, to) !== null; return { fare: calculateFare(from, to, bookingTime), isLate: isLateNight(bookingTime), hasAirport: isAirport(from + " " + to), isFixed: fixed, isFallback: !fixed }; }

function AddressField({ label, placeholder, value, onChange, onSelect, id }) {
  const inputRef = useRef(null);
  useEffect(() => {
    let timer;
    const initAutocomplete = () => {
      if (!window.google?.maps?.places || !inputRef.current) { timer = setTimeout(initAutocomplete, 300); return; }
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: "au" }, fields: ["formatted_address", "name"] });
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        const selected = place.formatted_address || place.name || "";
        const lower = selected.toLowerCase();
        if (lower.includes(" vic") || lower.includes(" victoria")) {
          onChange(selected);
          if (onSelect) onSelect(selected);
        } else { alert("Please select a location within Victoria."); }
      });
    };
    initAutocomplete();
    return () => clearTimeout(timer);
  }, [onChange, onSelect]);
  return (
    <div className="fg address-field">
      <label className="fl" htmlFor={id}>{label}</label>
      <input
        id={id} ref={inputRef} className="fi address-input"
        placeholder={placeholder} value={value}
        onChange={(e) => { onChange(e.target.value); if (onSelect) onSelect(null); }}
        autoComplete="off"
      />
      {value && (
        <button type="button" className="clear-address-btn"
          onClick={() => { onChange(""); if (onSelect) onSelect(null); }}
          aria-label={`Clear ${label}`}
        >×</button>
      )}
    </div>
  );
}

function buildWhatsAppLink({ from, to, date, time, pax, bags, fare, flightNumber }) {
  const lines = [
    "VÉRNO — Transfer Request",
    "",
    `PICKUP     : ${from || ""}`,
    `DROP-OFF   : ${to || ""}`,
    `DATE       : ${date || ""}`,
    `TIME       : ${time || ""}`,
    `PASSENGERS : ${pax || ""}`,
    `LUGGAGE    : ${bags || ""}`,
    ...(flightNumber ? [`FLIGHT     : ${flightNumber}`] : []),
    "",
    ...(fare ? [`Fare estimate: $${fare}`] : []),
    "",
    "Please confirm availability.",
  ];
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function WAIcon({ s = 20 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 2.12.56 4.12 1.53 5.85L0 24l6.34-1.52A11.95 11.95 0 0012 24c6.63 0 12-5.37 12-12S18.63 0 12 0zm0 22a9.96 9.96 0 01-5.19-1.37l-.37-.22-3.84.92.98-3.73-.24-.38A9.96 9.96 0 012 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/></svg>; }
function MsgIcon({ s = 14 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function IconPlaneHero() {
  return (
    <svg viewBox="0 0 64 64" className="lux-icon" aria-hidden="true" fill="currentColor">
      <path d="M54 10c-1.5-1.5-3.8-1.8-5.6-.7L36 16.8l-20-6.8L10 16l16 10-8 8-8-2-4 4 10 6 6 10 4-4-2-8 8-8 10 16 6-6-6.8-20L53 9.6c.2.1.4.2.6.4.3.3.5.6.6 1l.7-.7c-.2-.8-.5-1.5-1-2.3Z"/>
    </svg>
  );
}

function IconBriefcaseHero() {
  return (
    <svg viewBox="0 0 64 64" className="lux-icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="22" width="48" height="34" rx="4"/>
      <path d="M22 22v-4a10 10 0 0 1 20 0v4"/>
      <path d="M8 38h48"/>
      <path d="M26 38v6h12v-6"/>
    </svg>
  );
}

function IconCarHero() {
  return (
    <svg viewBox="0 0 64 64" className="lux-icon" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 38h44v10H10z" rx="2"/>
      <path d="M14 38l6-14h24l6 14"/>
      <circle cx="20" cy="48" r="4"/>
      <circle cx="44" cy="48" r="4"/>
      <path d="M10 44h4M50 44h4"/>
      <path d="M20 28h24"/>
    </svg>
  );
}
function IconPrice() { return <svg viewBox="0 0 24 24" className="trust-small-icon"><path d="M20.5 13.5l-7 7a2.2 2.2 0 0 1-3.1 0l-7-7V4h9.5l7.6 7.6a1.4 1.4 0 0 1 0 1.9Z"/><circle cx="8" cy="8" r="1.4"/></svg>; }
function IconShield() { return <svg viewBox="0 0 24 24" className="trust-small-icon"><path d="M12 21s7-3.8 7-10V5.5L12 3 5 5.5V11c0 6.2 7 10 7 10Z"/><path d="M9 12l2 2 4-5"/></svg>; }
function IconChatSmall() { return <svg viewBox="0 0 24 24" className="trust-small-icon"><path d="M4 5h16v11H8l-4 4V5Z"/></svg>; }
function IconDiamond() { return <svg viewBox="0 0 24 24" className="trust-small-icon"><path d="M6 4h12l4 7-10 10L2 11l4-7Z"/><path d="M2 11h20"/><path d="M8 4l4 17 4-17"/></svg>; }
function IconClock() { return <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>; }
function IconPerson() { return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35"><circle cx="12" cy="7" r="4"/><path d="M4 21c1.7-4 4.2-6 8-6s6.3 2 8 6"/></svg>; }
function IconStar() { return <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.7 1.1 6.5L12 17.5l-5.8 3.1 1.1-6.5-4.8-4.7 6.6-.9L12 2.5z"/></svg>; }

function VernoMark() {
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

function Nav() {
  const [solid, setSolid] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const fn = () => setSolid(window.scrollY > 60);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Menü açıkken scroll'u kilitle
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  const navLinks = [
    { href: "#services",  label: "Services",  id: "services" },
    { href: "#fleet",     label: "Fleet",     id: "fleet" },
    { href: "#areas",     label: "Coverage",  id: "areas" },
    { href: "#about",     label: "About",     id: "about" },
    { href: "#corporate", label: "Corporate", id: "corporate" },
  ];

  const scrollTo = (id) => {
    close();
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, 350);
  };

  return (
    <>
      <nav className={`nav${solid ? " solid" : ""}`}>
        <a href="#" className="nav-logo-wrap"><VernoMark /></a>

        {/* Masaüstü linkler */}
        <ul className="nav-links">
          {navLinks.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={(e) => { e.preventDefault(); scrollTo(l.id); }}>{l.label}</a>
            </li>
          ))}
        </ul>

        <div className="nav-right">
          <a href="#book" className="nav-btn" onClick={(e) => { e.preventDefault(); document.getElementById("book")?.scrollIntoView({ behavior:"smooth" }); }}>Reserve a Transfer</a>
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="hamburger-btn"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              alignItems: "center",
              gap: "5px",
              width: "42px",
              height: "42px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,.25)",
              cursor: "pointer",
              padding: 0,
              marginLeft: "1rem",
            }}
          >
            <span style={{ display:"block", width:20, height:1.5, background:"rgba(255,255,255,.85)" }} />
            <span style={{ display:"block", width:20, height:1.5, background:"rgba(255,255,255,.85)" }} />
            <span style={{ display:"block", width:20, height:1.5, background:"rgba(255,255,255,.85)" }} />
          </button>
        </div>
      </nav>

      {/* Koyu overlay */}
      <div
        onClick={close}
        style={{
          display: menuOpen ? "block" : "none",
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,.6)",
          zIndex: 998,
        }}
      />

      {/* Slide-in panel */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0,
        width: "min(360px, 88vw)",
        background: "#0c0c0c",
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        borderLeft: "1px solid rgba(194,154,102,.2)",
        transform: menuOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform .38s cubic-bezier(.22,.61,.36,1)",
        overflowY: "auto",
      }}>
        {/* Üst — logo + kapat */}
        <div style={{
          display:"flex", alignItems:"center", justifyContent:"space-between",
          padding: "2rem 2.2rem 1.5rem",
          borderBottom: "1px solid rgba(255,255,255,.07)",
          flexShrink: 0,
        }}>
          <VernoMark />
          <button
            onClick={close}
            aria-label="Close menu"
            style={{
              width:38, height:38,
              background:"rgba(255,255,255,.07)",
              border:"1px solid rgba(255,255,255,.12)",
              color:"rgba(255,255,255,.8)",
              fontSize:22, cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}
          >×</button>
        </div>

        {/* Linkler + Butonlar — scroll edilebilir */}
        <div style={{ overflowY:"auto", flex:1, padding:"1.5rem 2.2rem 2rem" }}>

          {/* Linkler */}
          <nav style={{ display:"flex", flexDirection:"column", marginBottom:"2rem" }}>
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={(e) => { e.preventDefault(); scrollTo(l.id); }}
                style={{
                  fontFamily:"'Playfair Display', Georgia, serif",
                  fontSize:"1.7rem",
                  fontWeight:400,
                  color:"rgba(255,255,255,.78)",
                  padding:".75rem 0 .75rem .4rem",
                  borderBottom:"1px solid rgba(255,255,255,.06)",
                  letterSpacing:"-.01em",
                  textDecoration:"none",
                  display:"block",
                  transition:"color .2s, padding-left .2s",
                }}
                onMouseEnter={e => { e.currentTarget.style.color="#C29A66"; e.currentTarget.style.paddingLeft=".9rem"; }}
                onMouseLeave={e => { e.currentTarget.style.color="rgba(255,255,255,.78)"; e.currentTarget.style.paddingLeft=".4rem"; }}
              >{l.label}</a>
            ))}
          </nav>

          {/* Alt butonlar */}
          <div style={{ display:"flex", flexDirection:"column", gap:".8rem" }}>

            <a
              href="#book"
              onClick={(e) => { e.preventDefault(); scrollTo("book"); }}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center",
                padding:"1rem",
                background:"linear-gradient(180deg,#C49A60,#A8753F)",
                color:"#fff",
                fontSize:".82rem", fontWeight:600,
                letterSpacing:".06em", textTransform:"uppercase",
                border:"1px solid rgba(201,164,109,.5)",
                textDecoration:"none",
              }}
            >Get Instant Fare</a>

            <a
              href={buildWhatsAppLink({ from: "", to: "", fare: null })}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              style={{
                display:"flex", alignItems:"center", justifyContent:"center", gap:".6rem",
                padding:"1rem",
                background:"#128C7E",
                color:"#fff",
                fontSize:".82rem", fontWeight:600,
                letterSpacing:".06em", textTransform:"uppercase",
                textDecoration:"none",
              }}
            ><WAIcon s={18} /> Reserve via WhatsApp</a>

            <a
              href={`mailto:${VERNO_EMAIL}`}
              onClick={close}
              style={{
                display:"block",
                textAlign:"center",
                fontSize:".72rem",
                color:"rgba(255,255,255,.38)",
                textDecoration:"none",
                paddingTop:".8rem",
                borderTop:"1px solid rgba(255,255,255,.07)",
              }}
            >{VERNO_EMAIL}</a>

          </div>
        </div>
      </div>
    </>
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
            <span className="hero-top">Melbourne's finest</span>
            <span className="hero-bottom">private chauffeur.</span>
          </h1>
          <div className="hero-line" />
          <p className="hero-tagline">Airport. Boardroom. Beyond.</p>
          <p className="hero-sub">As Melbourne as it gets.</p>
          <div className="hero-actions">
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn-wa hero-gold"><WAIcon s={18} /> Get Instant Quote</a>
            <a href="#book" className="btn-outline hero-outline" onClick={(e) => { e.preventDefault(); document.getElementById("book")?.scrollIntoView({ behavior:"smooth" }); }}>Get Instant Fare</a>
            <a href="#corporate" className="btn-outline hero-outline" onClick={(e) => { e.preventDefault(); document.getElementById("corporate")?.scrollIntoView({ behavior:"smooth" }); }}>Corporate Enquiries</a>
            <p className="btn-wa-note">Response within minutes</p>
          </div>
          <div className="hero-trust">
            <div className="hero-trust-item"><IconPrice /><span>Fixed pricing</span></div>
            <div className="hero-trust-item"><IconShield /><span>No surge</span></div>
            <div className="hero-trust-item"><IconChatSmall /><span>Direct contact</span></div>
            <div className="hero-trust-item"><IconDiamond /><span>Premium BMW i5</span></div>
          </div>
        </div>
        <div className="hero-service-panel">
          <div className="hero-service-row">
            <div className="hero-service-icon"><IconPlaneHero /></div>
            <div><h3>Airport Transfers</h3><p>Tullamarine &amp; Avalon</p><p>Flight tracked. Driver ready.</p></div>
          </div>
          <div className="hero-service-row">
            <div className="hero-service-icon"><IconBriefcaseHero /></div>
            <div><h3>Corporate Travel</h3><p>Executives &amp; business guests</p><p>Discreet, punctual, consistent.</p></div>
          </div>
          <div className="hero-service-row">
            <div className="hero-service-icon"><IconCarHero /></div>
            <div><h3>Private Hire</h3><p>Great Ocean Road &amp; Yarra Valley</p><p>Day trips across Victoria.</p></div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <div className="trust-strip">
      <div className="trust-strip-inner">
        <div className="trust-feature"><div className="trust-icon"><IconClock /></div><div><h4>On Time, Every Time</h4><p>Punctual, professional and always reliable.</p></div></div>
        <div className="trust-feature"><div className="trust-icon"><IconPerson /></div><div><h4>Discreet &amp; Professional</h4><p>Your privacy is respected. Always.</p></div></div>
        <div className="trust-feature"><div className="trust-icon"><IconStar /></div><div><h4>Premium Experience</h4><p>Luxury electric comfort from start to finish.</p></div></div>
      </div>
    </div>
  );
}

function FareEstimate({ from, to, time, fromSelected, toSelected, returnTrip, returnDate, returnTime }) {
  const result = estimateFare(from, to, time);
  if (!result) return null;

  // İkisi de Autocomplete'den seçilmemişse uyarı göster
  if (!fromSelected || !toSelected) {
    return (
      <div style={{
        marginTop:"1.2rem", padding:"1rem 1.2rem",
        background:"#f7f3ed", borderRadius:12,
        border:"1px solid rgba(185,139,85,.2)",
        fontSize:".82rem", color:"#B98B55",
        display:"flex", alignItems:"center", gap:".6rem",
      }}>
        <span>⚠</span>
        <span>Please select addresses from the suggestions to see your fare.</span>
      </div>
    );
  }

  // Fiyat tipi
  let label, guarantee, labelColor;
  if (result.hasAirport) {
    label = "Fixed Price";
    guarantee = "Confirmed at booking via WhatsApp — no surprises.";
    labelColor = "#2a7a2a";
  } else if (result.isFallback) {
    label = "Indicative Price";
    guarantee = "Estimate only — final price confirmed on booking.";
    labelColor = "#B98B55";
  } else {
    label = "Estimated Fare";
    guarantee = "Final price confirmed on booking via WhatsApp.";
    labelColor = "rgba(255,255,255,.5)";
  }

  return (
    <div className="fare-estimate">
      {result.isLate && (
        <div style={{
          background:"rgba(255,180,0,.12)",
          border:"1px solid rgba(255,180,0,.35)",
          borderRadius:8, padding:".65rem 1rem",
          marginBottom:"1rem",
          display:"flex", alignItems:"center", gap:".5rem",
          fontSize:".78rem", color:"#b8860b",
        }}>
          <span>🌙</span>
          <span>Late-night surcharge applied (00:00–05:00)</span>
        </div>
      )}
      <div className="fare-label" style={{ color: labelColor, fontWeight: 600 }}>
        {label}{returnTrip && returnDate && returnTime ? " — Outbound only" : ""}
      </div>
      <div className="fare-price">${result.fare}</div>
      <div className="fare-guarantee">{guarantee}</div>
      {returnTrip && returnDate && returnTime && (
        <div style={{
          marginTop:".8rem",
          padding:".65rem .9rem",
          background:"rgba(255,255,255,.07)",
          borderRadius:8,
          fontSize:".75rem",
          color:"rgba(255,255,255,.55)",
          display:"flex", alignItems:"center", gap:".5rem",
          borderTop:"1px solid rgba(255,255,255,.08)",
        }}>
          <span>↩</span>
          <span>Return fare not included — final price confirmed via WhatsApp.</span>
        </div>
      )}
      <div className="fare-trust">
        <span>No hidden costs</span>
        <span>No surge pricing</span>
        <span>No platform fees</span>
      </div>
    </div>
  );
}

function getTodayLocal() { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`; }

function buildWhatsAppLinkReturn({ from, to, date, time, pax, bags, fare, flightNumber, returnDate, returnTime }) {
  const lines = [
    "VÉRNO — Transfer Request",
    "",
    "OUTBOUND",
    `PICKUP     : ${from || ""}`,
    `DROP-OFF   : ${to || ""}`,
    `DATE       : ${date || ""}`,
    `TIME       : ${time || ""}`,
    `PASSENGERS : ${pax || ""}`,
    `LUGGAGE    : ${bags || ""}`,
    ...(flightNumber ? [`FLIGHT     : ${flightNumber}`] : []),
    "",
    ...(fare ? [`Fare estimate: $${fare}`] : []),
    "",
    "RETURN",
    `PICKUP     : ${to || ""}`,
    `DROP-OFF   : ${from || ""}`,
    `DATE       : ${returnDate || ""}`,
    `TIME       : ${returnTime || ""}`,
    "",
    "Please confirm availability.",
  ];
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}

function InlineBooking() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromSelected, setFromSelected] = useState(false);
  const [toSelected, setToSelected] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pax, setPax] = useState("1");
  const [bags, setBags] = useState("1");
  const [flightNumber, setFlightNumber] = useState("");
  const [returnTrip, setReturnTrip] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [errors, setErrors] = useState({});

  const fareResult = estimateFare(from, to, time);
  const fare = fareResult ? fareResult.fare : null;

  // Sadece FROM'da airport varsa uçuş numarası sor
  const isAirportPickup = isAirport(from);

  const validate = () => {
    const e = {};
    if (from.trim().length < 4)  e.from = "Please enter a pickup location.";
    if (to.trim().length < 4)    e.to   = "Please enter a destination.";
    if (!date)                   e.date = "Please select a date.";
    if (!time)                   e.time = "Please select a time.";
    if (returnTrip) {
      if (!returnDate) e.returnDate = "Please select a return date.";
      if (!returnTime) e.returnTime = "Please select a return time.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleWA = () => {
    if (!validate()) return;
    const link = returnTrip
      ? buildWhatsAppLinkReturn({ from, to, date, time, pax, bags, fare, flightNumber, returnDate, returnTime })
      : buildWhatsAppLink({ from, to, date, time, pax, bags, fare, flightNumber });
    window.open(link, "_blank", "noopener");
  };

  const handleDateChange = (e) => {
    const s = e.target.value;
    const t = getTodayLocal();
    if (s < t) { alert("Please select a valid date."); setDate(t); setTime(""); return; }
    setDate(s); setTime("");
    setErrors((prev) => ({ ...prev, date: null, time: null }));
  };

  const getSlots = (forDate) => {
    if (!forDate) return [];
    const minBooking = new Date(Date.now() + 3 * 60 * 60 * 1000);
    const slots = [];
    for (let i = 0; i < 48; i++) {
      const hour = Math.floor(i / 2);
      const minute = i % 2 === 0 ? "00" : "30";
      const slot = `${String(hour).padStart(2, "0")}:${minute}`;
      if (new Date(`${forDate}T${slot}`) >= minBooking) slots.push(slot);
    }
    return slots;
  };

  const errStyle = { fontSize: "11px", color: "#e05050", marginTop: "5px", display: "block" };

  return (
    <div className="booking-panel" id="book">
      <div className="booking-panel-inner">
        <div>
          <h2 className="booking-panel-headline">Your fare,<br /><em>instantly.</em></h2>
          <p className="booking-panel-sub">Enter your journey details to see your fare. Then reserve directly via WhatsApp.</p>
        </div>

        <div className="booking-panel-form">
          <button className="quick-chip" onClick={() => { setTo("Melbourne Airport (Tullamarine)"); setToSelected(true); }}>
            <span className="quick-chip-dot" />Airport transfer? Set Melbourne Airport as destination
          </button>

          {/* FROM */}
          <AddressField id="from" label="Pickup" placeholder="Enter pickup address, suburb or hotel" value={from}
            onChange={(v) => { setFrom(v); setFromSelected(false); setErrors((p) => ({ ...p, from: null })); }}
            onSelect={(v) => setFromSelected(!!v)}
          />
          {errors.from && <span style={errStyle}>{errors.from}</span>}

          {/* TO */}
          <AddressField id="to" label="Destination" placeholder="Enter destination address or airport" value={to}
            onChange={(v) => { setTo(v); setToSelected(false); setErrors((p) => ({ ...p, to: null })); }}
            onSelect={(v) => setToSelected(!!v)}
          />
          {errors.to && <span style={errStyle}>{errors.to}</span>}

          {/* Uçuş numarası — sadece FROM'da airport varsa */}
          {isAirportPickup && (
            <div className="fg">
              <label className="fl">Flight Number</label>
              <input className="fi" placeholder="e.g. EK408" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value.toUpperCase())} />
              <p style={{ fontSize: "12px", color: "#999", marginTop: "6px" }}>We monitor your flight to ensure perfect pickup timing.</p>
            </div>
          )}

          {/* Tarih & Saat */}
          <div className="f2">
            <div className="fg">
              <label className="fl">Date</label>
              <input className="fi" type="date" value={date} min={getTodayLocal()} onChange={handleDateChange} />
              {errors.date && <span style={errStyle}>{errors.date}</span>}
            </div>
            <div className="fg">
              <label className="fl">Time</label>
              <select className="fi" value={time} onChange={(e) => { setTime(e.target.value); setErrors((p) => ({ ...p, time: null })); }}>
                <option value="">Select time</option>
                {!date
                  ? <option disabled>Please select date first</option>
                  : getSlots(date).length === 0
                    ? <option disabled>No available times</option>
                    : getSlots(date).map((s) => <option key={s} value={s}>{s}</option>)
                }
              </select>
              {errors.time && <span style={errStyle}>{errors.time}</span>}
            </div>
          </div>

          {/* Yolcu & Bagaj */}
          <div className="f2">
            <div className="fg">
              <label className="fl">Passengers</label>
              <select className="fi" value={pax} onChange={(e) => setPax(e.target.value)}>
                {[1,2,3,4].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
            <div className="fg">
              <label className="fl">Luggage</label>
              <select className="fi" value={bags} onChange={(e) => setBags(e.target.value)}>
                {[0,1,2,3,4].map((n) => <option key={n}>{n}</option>)}
              </select>
            </div>
          </div>

          {/* Return trip toggle */}
          <div style={{ margin:"1rem 0", display:"flex", alignItems:"center", gap:".75rem", cursor:"pointer" }} onClick={() => { setReturnTrip(!returnTrip); setReturnDate(""); setReturnTime(""); }}>
            <div style={{
              width: 42, height: 24, borderRadius: 12,
              background: returnTrip ? "#B98B55" : "#e0e0e0",
              position: "relative", transition: "background .2s", flexShrink: 0,
            }}>
              <div style={{
                position:"absolute", top:3, left: returnTrip ? 21 : 3,
                width:18, height:18, borderRadius:"50%",
                background:"#fff", transition:"left .2s",
                boxShadow:"0 1px 4px rgba(0,0,0,.2)",
              }}/>
            </div>
            <span style={{ fontSize:".82rem", color:"#555", userSelect:"none" }}>Add return trip</span>
          </div>

          {/* Return tarih & saat */}
          {returnTrip && (
            <div style={{ background:"#f7f3ed", padding:"1.2rem", borderRadius:"12px", marginBottom:"1rem", border:"1px solid rgba(185,139,85,.2)" }}>
              <p style={{ fontSize:".68rem", textTransform:"uppercase", letterSpacing:".12em", color:"#B98B55", marginBottom:"1rem" }}>Return Journey</p>
              <div className="f2">
                <div className="fg">
                  <label className="fl">Return Date</label>
                  <input className="fi" type="date" value={returnDate}
                    min={date || getTodayLocal()}
                    onChange={(e) => {
                      const selected = e.target.value;
                      if (date && selected < date) {
                        alert("Return date cannot be before the outbound date.");
                        setReturnDate("");
                        setReturnTime("");
                        return;
                      }
                      setReturnDate(selected);
                      setReturnTime("");
                      setErrors((p) => ({ ...p, returnDate: null }));
                    }}
                    style={{ background:"#fff" }}
                  />
                  {errors.returnDate && <span style={errStyle}>{errors.returnDate}</span>}
                </div>
                <div className="fg">
                  <label className="fl">Return Time</label>
                  <select className="fi" value={returnTime} onChange={(e) => { setReturnTime(e.target.value); setErrors((p) => ({ ...p, returnTime: null })); }} style={{ background:"#fff" }}>
                    <option value="">Select time</option>
                    {!returnDate
                      ? <option disabled>Please select date first</option>
                      : getSlots(returnDate).length === 0
                        ? <option disabled>No available times</option>
                        : getSlots(returnDate).map((s) => <option key={s} value={s}>{s}</option>)
                    }
                  </select>
                  {errors.returnTime && <span style={errStyle}>{errors.returnTime}</span>}
                </div>
              </div>
            </div>
          )}

          <FareEstimate from={from} to={to} time={time} fromSelected={fromSelected} toSelected={toSelected} returnTrip={returnTrip} returnDate={returnDate} returnTime={returnTime} />

          <button className="btn-whatsapp premium-btn" onClick={handleWA}>
            <WAIcon s={18} /> Get Instant Quote on WhatsApp
          </button>

          <p className="wa-trust-line">Instant response · No commitment · Fixed pricing</p>
          <a href={`mailto:${VERNO_EMAIL}?subject=Booking Request`} className="btn-email-secondary">Prefer email? {VERNO_EMAIL}</a>
        </div>
      </div>
    </div>
  );
}

const SERVICES = [
  {
    label: "Airport Transfers",
    h: "Airport Transfers",
    d: "Your flight lands, we're already there. Tullamarine and Avalon transfers with real-time flight tracking and a fixed fare — no surprises, no waiting.",
    features: ["Flight tracked in real-time", "Fixed fare, no surprises", "Driver in position on arrival"]
  },
  {
    label: "Corporate",
    h: "Corporate Travel",
    d: "First impressions start before the meeting. Punctual, discreet ground transport for executives, clients and business guests across Melbourne.",
    features: ["Discreet & punctual, guaranteed", "Direct booking, no platforms", "Consistent standard, every time"]
  },
  {
    label: "Private Hire",
    h: "Private Hire",
    d: "From the Great Ocean Road to the Yarra Valley wineries — day trips, wine tastings and Victoria's best destinations, handled in comfort.",
    features: ["Your route, your schedule", "Full day availability", "Fixed fare confirmed upfront"]
  },
  {
    label: "Events",
    h: "Events & Occasions",
    d: "Weddings, dinners, shopping trips or a day out — we handle the driving so you can focus on the moment. Luggage, parcels, bags — all taken care of.",
    features: ["Luggage & parcels handled", "Flexible pickup & drop-off", "Available for full day hire"]
  }
];

function CorporateSection() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [details, setDetails] = useState("");
  const handleSubmit = () => {
    const subject = "Corporate Chauffeur Enquiry";
    const body = `Name: ${name}\nCompany: ${company}\nEmail: ${email}\n\nDetails:\n${details}`;
    window.location.href = `mailto:${VERNO_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  return (
    <section id="corporate" className="corporate-section">
      <div className="booking-panel-inner">
        <div>
          <div className="s-label">Corporate</div>
          <h2 className="booking-panel-headline">Corporate Chauffeur Accounts</h2>
          <p className="booking-panel-sub">Tailored chauffeur services for businesses, executives and ongoing travel requirements.</p>
        </div>
        <div className="booking-panel-form">
          <div className="fg"><label className="fl">Full Name</label><input className="fi" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="fg"><label className="fl">Company</label><input className="fi" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
          <div className="fg"><label className="fl">Work Email</label><input className="fi" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="fg"><label className="fl">Estimated Monthly Trips</label><select className="fi" onChange={(e) => setDetails(e.target.value)}><option value="">Select</option><option>1–5 trips</option><option>5–15 trips</option><option>15+ trips</option></select></div>
          <div className="fg"><label className="fl">Typical Route</label><input className="fi" placeholder="e.g. Melbourne Airport ↔ CBD" onChange={(e) => setDetails((prev) => prev + "\nRoute: " + e.target.value)} /></div>
          <div className="fg"><label className="fl">Additional Details (optional)</label><textarea className="fi" rows="3" placeholder="Any specific requirements..." value={details} onChange={(e) => setDetails(e.target.value)} /></div>
          <button className="btn-whatsapp" onClick={handleSubmit}>Request Corporate Account Access</button>
          <p style={{ fontSize: "12px", color: "#999", marginTop: "14px" }}>Suitable for businesses of all sizes — from occasional bookings to ongoing travel requirements.</p>
        </div>
      </div>
    </section>
  );
}

function Services() {
  const [active, setActive] = useState(0);
  const s = SERVICES[active];
  return (
    <section className="sec" id="services" style={{ background:"#f5f5f5" }}>
      <div className="wrap">
        <div className="s-label">Services</div>
        <h2 className="s-h">Every journey,<br /><em>handled.</em></h2>
        <div className="svc-layout">
          <nav className="svc-nav">{SERVICES.map((x, i) => <button key={x.label} className={`svc-nav-item${active===i?" active":""}`} onClick={() => setActive(i)}>{x.label}</button>)}</nav>
          <div className="svc-content">
            <h3 className="svc-content-h">{s.h}</h3>
            <p className="svc-desc">{s.d}</p>
            <ul className="svc-feat-list">
              {s.features.map((f) => <li key={f}>{f}</li>)}
            </ul>
            <a href="#book" className="btn-o" onClick={(e) => { e.preventDefault(); document.getElementById("book")?.scrollIntoView({ behavior:"smooth" }); }}>Get Fare Estimate</a>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyMoments() {
  const items = [
    { title: "Fully electric",           desc: "BMW i5 eDrive40 — silent, smooth and zero emissions. A better journey for you and the city." },
    { title: "Discreet by design",       desc: "No conversation unless you want one. Your privacy, your space, your journey." },
    { title: "Small, intentional fleet", desc: "A small, curated fleet means every journey meets the same standard — no surprises, no inconsistency." },
    { title: "Direct booking",           desc: "No apps, no platforms, no surge pricing. You message us directly and we confirm your fare instantly." },
  ];

  return (
    <section className="sec dark why-moments-section" id="about">
      <div className="wrap">
        <div className="why-moments-layout">
          {/* Sol — görsel */}
          <div className="why-moments-img-wrap">
            <img src={MOMENTS_MAIN} alt="VERNO BMW i5" className="why-moments-img" loading="lazy" />
            <span className="moments-geo">Melbourne — Private Transfers</span>
          </div>

          {/* Sağ — metin + grid */}
          <div className="why-moments-text">
            <div className="s-label inv">Why VÉRNO</div>
            <h2 className="s-h inv">A boutique<br /><em>standard.</em></h2>
            <p className="s-body" style={{ marginBottom:"2.5rem" }}>Small fleet. Consistent quality. Every detail considered.</p>

            <div className="why-grid">
              {items.map((item, i) => (
                <div key={item.title} className="why-cell">
                  <span className="why-n">0{i + 1}</span>
                  <div className="why-t">{item.title}</div>
                  <p className="why-d">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Areas() {
  const areas = [
    { name: "Melbourne CBD",          time: "Premium transfers", desc: "Door-to-door from the heart of the city. Fixed fare, no waiting." },
    { name: "St Kilda & South Yarra", time: "Premium transfers", desc: "Inner-south transfers with the comfort and discretion you expect." },
    { name: "Mornington Peninsula",   time: "Premium transfers", desc: "From Frankston to Portsea — scenic transfers along the Peninsula." },
    { name: "Yarra Valley",           time: "Premium transfers", desc: "Corporate retreats, winery visits and private escapes into the Valley." },
    { name: "Melbourne Airport",      time: "Premium transfers", desc: "Tullamarine pickups and drop-offs. Flight tracked, driver ready." },
    { name: "Avalon Airport",         time: "Premium transfers", desc: "Geelong-side transfers handled with the same fixed-fare precision." },
    { name: "Geelong & Surf Coast",   time: "Premium transfers", desc: "From the city to Torquay and beyond — premium transfers, fixed price." },
    { name: "Greater Melbourne",      time: "Premium transfers", desc: "Wherever you're headed across Melbourne, we'll get you there in comfort." },
  ];
  return (
    <section className="sec" id="areas" style={{ background:"#fff" }}>
      <div className="wrap">
        <div className="s-label">Coverage</div>
        <h2 className="s-h">Across Melbourne<br /><em>and beyond.</em></h2>
        <div className="areas-list">
          {areas.map((area) => (
            <div key={area.name} className="area-item" onClick={() => document.getElementById("book")?.scrollIntoView({ behavior: "smooth" })}>
              <div className="area-name">{area.name}</div>
              <div className="area-time">{area.time}</div>
              <p className="area-desc">{area.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Fleet() {
  return (
    <section className="sec fleet-section" id="fleet">
      <div className="wrap">
        <div className="s-label inv">The Fleet</div>
        <div className="fleet-layout">
          <div className="fleet-img-wrap"><img src={FLEET_IMG} alt="VERNO BMW i5 fleet" className="fleet-img" loading="lazy" /></div>
          <div className="fleet-text">
            <p className="fleet-text-eyebrow">All-Electric Fleet</p>
            <h2 className="fleet-text-title">BMW i5<br /><em>eDrive40</em></h2>
            <p className="fleet-text-sub">Zero emissions. Executive comfort. Built for Melbourne.</p>
            <p className="fleet-text-body">VÉRNO operates premium electric vehicles for comfort, consistency, and a seamless journey.</p>
            <div className="fleet-ev-badge">100% Electric - BMW i5</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="sec" style={{ background:"#f5f5f5" }}>
      <div className="wrap">
        <div className="s-label">Client Experience</div>
        <h2 className="s-h">A service defined by consistency.</h2>
        <div style={{ maxWidth: "520px", marginTop: "20px" }}>
          <p style={{ color: "#555", lineHeight: "1.7" }}>Every journey is handled with precision, discretion and care.</p>
          <p style={{ color: "#999", fontSize: "13px", marginTop: "12px" }}>Verified client feedback will be shared here as VÉRNO continues to grow.</p>
        </div>
      </div>
    </section>
  );
}

function Closer() {
  return (
    <section className="closer" id="contact">
      <div className="closer-inner">
        <p className="s-label inv closer-label">Melbourne, Victoria</p>
        <h2 className="closer-h">Ready when<br /><em>you are.</em></h2>
        <p className="closer-sub">Reserve your transfer directly. Instant confirmation, fixed price.</p>
        <div className="closer-btns">
          <a href="#book" className="btn-wa" onClick={(e) => { e.preventDefault(); document.getElementById("book")?.scrollIntoView({ behavior:"smooth" }); }}>Reserve via WhatsApp</a>
          <a href={`mailto:${VERNO_EMAIL}?subject=Booking Request`} className="btn-outline">Send an Email</a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="ft-grid">
        <div>
          <VernoMark />
          <p className="ft-tagline">Private electric chauffeur for Melbourne.</p>
          <a href={`mailto:${VERNO_EMAIL}`} className="ft-msg-link"><MsgIcon s={12} />{VERNO_EMAIL}</a>
        </div>
        <div><p className="ft-col-h">Services</p><ul className="ft-links"><li><a href="#services">Airport Transfers</a></li><li><a href="#services">Corporate Travel</a></li><li><a href="#services">Private Hire</a></li></ul></div>
        <div><p className="ft-col-h">Coverage</p><ul className="ft-links"><li><a href="#areas">Melbourne CBD</a></li><li><a href="#areas">Melbourne Airport</a></li><li><a href="#areas">Mornington Peninsula</a></li></ul></div>
        <div><p className="ft-col-h">Reservations</p><ul className="ft-links"><li><a href="#book">Fare Estimate</a></li><li><a href={`mailto:${VERNO_EMAIL}`}>{VERNO_EMAIL}</a></li></ul></div>
      </div>
      <div className="ft-bottom">
        <p>© 2025 VÉRNO Private Chauffeur - Melbourne</p>
        <p>Melbourne - Airport - Corporate</p>
      </div>
      <p style={{ maxWidth:"1200px",margin:"18px auto 0",fontSize:"11px",color:"rgba(255,255,255,.25)",textAlign:"center" }}>Melbourne chauffeur service | Airport transfers Melbourne | Private driver Melbourne</p>
      <p style={{ maxWidth:"1200px",margin:"12px auto 0",fontSize:"11px",color:"rgba(255,255,255,.32)",textAlign:"center" }}>Licensed Chauffeur Service — Airport & Corporate Transfers — Melbourne, Victoria</p>
      <p style={{ maxWidth:"1200px",margin:"4px auto 0",fontSize:"10px",color:"rgba(255,255,255,.22)",textAlign:"center" }}>Registered CPV Operator — ABN 37 903 967 567</p>
    </footer>
  );
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Inter:wght@300;400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0} html{scroll-behavior:smooth}
:root{--gold:#B98B55;--gold2:#C49A5A;--black:#111;--white:#fff;--wa:#128C7E;--serif:'Playfair Display',Georgia,serif;--sans:'Inter',Arial,sans-serif}
body{font-family:var(--sans);background:#fff;color:#111;-webkit-font-smoothing:antialiased;overflow-x:hidden} a{text-decoration:none;color:inherit} button,input,select{font-family:var(--sans)}
.nav{position:fixed;top:0;left:0;right:0;z-index:100;height:82px;padding:0 5vw;display:flex;align-items:center;justify-content:space-between;background:transparent;border-bottom:1px solid transparent;}
.nav.solid{background:rgba(12,12,12,.86);backdrop-filter:blur(16px);border-color:rgba(255,255,255,.08);}
.nav-links{display:flex;gap:2.4rem;list-style:none;} .nav-links a,.nav-btn{font-size:.72rem;text-transform:uppercase;letter-spacing:.14em;color:rgba(255,255,255,.72);}
.nav-btn{border:1px solid rgba(210,176,109,.55);padding:.85rem 1.7rem;} .nav-right{display:flex;align-items:center;gap:.5rem;} .hamburger{display:none;} .hamburger-btn{display:none;}
.verno-logo{display:flex;flex-direction:column;align-items:flex-start;line-height:1;} .verno-logo-top{display:flex;align-items:center;gap:10px;} .verno-dot{width:9px;height:9px;border-radius:50%;background:var(--gold);display:inline-block;} .verno-word{font-family:var(--serif);font-size:24px;font-weight:600;letter-spacing:.22em;color:#fff;} .verno-city{margin-left:29px;margin-top:5px;font-family:var(--sans);font-size:8px;letter-spacing:.42em;color:rgba(255,255,255,.36);}
.hero{position:relative;min-height:78vh;padding:105px 5vw 0;background:radial-gradient(circle at 88% 42%, rgba(185,139,85,.34), transparent 28%),linear-gradient(90deg, rgba(5,5,5,.97) 0%, rgba(8,8,8,.88) 38%, rgba(8,8,8,.42) 66%, rgba(8,8,8,.58) 100%),linear-gradient(180deg, rgba(5,5,5,.18) 0%, rgba(5,5,5,.78) 100%),url("/images/hero-bg.jpg") center/cover no-repeat;color:#fff;overflow:hidden;}
.hero::after{content:"";position:absolute;left:0;right:0;bottom:0;height:160px;background:linear-gradient(to bottom, transparent, rgba(10,10,10,.92));pointer-events:none;}
.hero-content{position:relative;z-index:2;min-height:calc(78vh - 105px);max-width:1280px;margin:0 auto;display:grid;grid-template-columns:minmax(0, 1.05fr) 390px;gap:6vw;align-items:center;}
.hero-left{padding-bottom:5vh;}
.hero-label{font-size:.72rem;font-weight:500;letter-spacing:.26em;text-transform:uppercase;color:#C29A66;margin-bottom:1.8rem;}
.hero-h1{font-family:var(--serif);line-height:.95;letter-spacing:-.055em;margin-bottom:1.8rem;max-width:720px;}
.hero-top{display:block;font-style:normal;font-weight:600;font-size:clamp(3.6rem,5vw,5.8rem);color:#fff;}
.hero-bottom{display:block;font-style:italic;font-weight:300;font-size:clamp(3.45rem,4.8vw,5.55rem);color:rgba(255,255,255,.82);margin-top:.05rem;white-space:nowrap;}
.hero-line{background:#C29A66;width:46px;height:2px;margin-bottom:1.6rem;}
.hero-sub{max-width:520px;font-size:.95rem;line-height:1.65;font-weight:300;color:rgba(255,255,255,.55);margin-bottom:2.5rem;}
.hero-tagline{font-size:.72rem;font-weight:500;letter-spacing:.28em;text-transform:uppercase;color:var(--gold);margin-bottom:1.2rem;}
.hero-actions{display:flex;align-items:center;gap:1.6rem;flex-wrap:wrap;}
.hero-gold{display:inline-flex;align-items:center;justify-content:center;gap:.65rem;padding:1rem 1.9rem;font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;background:linear-gradient(180deg,#C49A60,#A8753F);color:#fff;border:1px solid rgba(201,164,109,.65);}
.hero-outline{display:inline-flex;align-items:center;justify-content:center;gap:.65rem;padding:1rem 1.9rem;font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border:1px solid rgba(201,164,109,.58);color:rgba(255,255,255,.82);background:rgba(255,255,255,.02);}
.btn-wa-note{font-size:.75rem;color:rgba(255,255,255,.45);margin-top:.4rem;display:block;}
.hero-trust{display:flex;align-items:center;gap:2.2rem;flex-wrap:wrap;margin-top:2.6rem;}
.hero-trust-item{display:flex;align-items:center;gap:.55rem;font-size:.68rem;letter-spacing:.13em;text-transform:uppercase;color:rgba(255,255,255,.56);}
.trust-small-icon{width:19px;height:19px;fill:none;stroke:#B98B55;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;}
.hero-service-panel{width:390px;border-radius:18px;background:rgba(10,10,10,.34);backdrop-filter:blur(8px);border:1px solid rgba(201,164,109,.26);box-shadow:0 25px 70px rgba(0,0,0,.35);overflow:hidden;}
.hero-service-row{display:grid;grid-template-columns:92px 1fr;gap:1.25rem;padding:2.05rem 2.15rem;border-bottom:1px solid rgba(255,255,255,.08);align-items:flex-start;}
.hero-service-row:last-child{border-bottom:none;}
.hero-service-icon{width:68px;height:68px;border-radius:50%;border:1.4px solid rgba(210,176,109,.45);background:rgba(210,176,109,.055);color:#D2B06D;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.lux-icon{width:38px;height:38px;fill:none;stroke:currentColor;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;}
.hero-service-row h3{font-family:var(--serif);font-size:1.34rem;font-weight:600;color:#fff;margin-bottom:.4rem;}
.hero-service-row p{font-size:.92rem;line-height:1.45;color:rgba(255,255,255,.52);}
.trust-strip{background:rgba(18,18,18,.96);padding:2.25rem 5vw;border-top:1px solid rgba(201,164,109,.11);border-bottom:1px solid rgba(201,164,109,.11);}
.trust-strip-inner{max-width:1050px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:0;}
.trust-feature{display:grid;grid-template-columns:52px 1fr;gap:1.3rem;align-items:flex-start;padding:0 2.6rem;border-right:1px solid rgba(255,255,255,.08);}
.trust-feature:last-child{border-right:none;}
.trust-icon{color:#B98B55;opacity:.95;}
.trust-feature h4{font-size:.72rem;color:rgba(255,255,255,.9);letter-spacing:.14em;text-transform:uppercase;margin-bottom:.55rem;}
.trust-feature p{font-size:.82rem;line-height:1.65;color:rgba(255,255,255,.42);}
.btn-wa{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;padding:1rem 1.8rem;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;background:var(--wa);color:#fff;}
.btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;padding:1rem 1.8rem;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;border:1px solid rgba(255,255,255,.22);color:rgba(255,255,255,.7);}
.btn-o{display:inline-flex;align-items:center;gap:.6rem;padding:1rem 1.8rem;font-size:.8rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;border:1px solid #e5e5e5;color:#555;}
.sec{padding:9rem 5vw} .sec.dark{background:#111} .night2{background:#0a0a0a} .wrap{max-width:1200px;margin:auto}
.s-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:1.2rem;}
.inv{color:var(--gold)} .s-h{font-family:var(--serif);font-size:clamp(2rem,4vw,3.4rem);font-weight:400;line-height:1.1;margin-bottom:2rem;} .s-h.inv{color:#fff;}
.s-h em,.booking-panel-headline em,.fleet-text-title em,.closer-h em{color:var(--gold);font-style:normal;}
.s-body{color:rgba(255,255,255,.5);line-height:1.75;}
.booking-panel{padding:7rem 5vw 6rem;background:#fff;}
.booking-panel-inner{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:360px 620px;gap:6rem;align-items:center;justify-content:center;}
.booking-panel-headline{font-family:var(--serif);font-size:clamp(2.2rem,3vw,3rem);font-weight:400;line-height:1.05;margin-bottom:1.6rem;}
.booking-panel-sub{max-width:330px;font-size:.95rem;line-height:1.75;color:#777;font-weight:300;}
.booking-panel-form{width:100%;max-width:620px;background:#fff;padding:2.7rem;border-radius:22px;border:1px solid rgba(0,0,0,.06);box-shadow:0 28px 80px rgba(0,0,0,.09);}
.fg{position:relative;margin-bottom:1.15rem;} .fl{display:block;font-size:.68rem;text-transform:uppercase;letter-spacing:.14em;color:#999;margin-bottom:.55rem;}
.fi{width:100%;height:56px;padding:0 18px;background:#fafafa;border:1px solid #e6e6e6;border-radius:12px;outline:none;font-size:.9rem;color:#111;}
.fi:focus{background:#fff;border-color:#B98B55;box-shadow:0 0 0 3px rgba(185,139,85,.12);}
textarea.fi{height:auto;padding:14px 18px;resize:vertical;}
.fi[type="date"]{
  height:56px;
  padding:0 18px;
  -webkit-appearance:none;
  appearance:none;
  line-height:normal;
}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:1.15rem;align-items:end;}
.address-field{position:relative;} .address-input{padding-right:42px;}
.clear-address-btn{position:absolute;right:12px;top:34px;width:24px;height:24px;border:0;border-radius:50%;background:rgba(0,0,0,.08);color:#777;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.clear-address-btn:hover{background:rgba(0,0,0,.14);color:#111;}
.quick-chip{width:auto;display:inline-flex;align-items:center;justify-content:center;background:#f7f3ed;border:1px solid rgba(185,139,85,.28);color:#B98B55;padding:.65rem 1rem;margin-bottom:1.6rem;font-size:.68rem;text-transform:uppercase;letter-spacing:.09em;border-radius:0;cursor:pointer;}
.quick-chip-dot{display:inline-block;width:5px;height:5px;background:var(--wa);border-radius:50%;margin-right:.5rem;}
.fare-estimate{margin-top:1.5rem;background:#111;color:#fff;padding:2rem;border-radius:14px;}
.fare-label{font-size:.65rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-bottom:.7rem;}
.fare-price{font-family:var(--serif);font-size:4rem;line-height:1;}
.fare-guarantee{color:rgba(255,255,255,.35);font-size:.75rem;margin-top:.4rem;}
.fare-trust{display:flex;gap:1rem;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,.08);padding-top:1rem;margin-top:1rem;color:rgba(255,255,255,.35);font-size:.7rem;}
.btn-whatsapp{width:100%;height:58px;display:flex;align-items:center;justify-content:center;gap:.65rem;background:linear-gradient(180deg,#D4A96F,#A8753F);color:#111;border:1px solid rgba(212,169,111,.65);border-radius:14px;font-size:.86rem;font-weight:700;letter-spacing:.03em;margin-top:1.8rem;cursor:pointer;}
.btn-whatsapp:hover{filter:brightness(1.06);}
.premium-btn{width:100%;padding:16px;border-radius:14px;border:1px solid rgba(212,169,111,.7);background:linear-gradient(180deg,#D4A96F,#A8753F);color:#fff;font-size:14px;font-weight:600;letter-spacing:.04em;cursor:pointer;transition:all .25s ease;}
.premium-btn:hover{transform:translateY(-2px);box-shadow:0 10px 30px rgba(168,117,63,.35);} .premium-btn:active{transform:scale(.98);}
.wa-trust-line{text-align:center;font-size:.76rem;color:#999;margin-top:.9rem;letter-spacing:.02em;}
.btn-email-secondary{display:block;text-align:center;font-size:.75rem;color:#999;margin-top:.85rem;}
.corporate-section{padding:7rem 5vw 6rem;background:#fff;}
.why-moments-section{background:#111;}
.why-moments-layout{display:grid;grid-template-columns:1fr 1fr;gap:6rem;align-items:center;}
.why-moments-img-wrap{position:relative;background:#1a1a1a;overflow:hidden;border-radius:4px;}
.why-moments-img{width:100%;aspect-ratio:4/5;object-fit:cover;display:block;}
.why-moments-text{display:flex;flex-direction:column;}
@media(max-width:1024px){
  .why-moments-layout{grid-template-columns:1fr;gap:3rem;}
  .why-moments-img{aspect-ratio:16/9;}
}
@media(max-width:768px){
  .why-moments-img{aspect-ratio:4/3;}
}
.svc-layout{display:grid;grid-template-columns:210px 1fr;gap:5rem;margin-top:4rem;} .svc-nav{display:flex;flex-direction:column;}
.svc-nav-item{text-align:left;padding:1rem 0;border-bottom:1px solid #e5e5e5;color:#999;background:none;border-top:none;border-left:none;border-right:none;cursor:pointer;}
.svc-nav-item.active{color:#111;font-weight:600;}
.svc-content-h{font-family:var(--serif);font-size:clamp(1.8rem,3vw,2.6rem);font-weight:400;line-height:1.15;margin-bottom:1rem;}
.svc-desc{font-size:.9rem;line-height:1.75;color:#666;font-weight:300;}
.svc-feat-list{list-style:none;display:grid;gap:.7rem;margin:1.5rem 0;color:#555;}
.why-layout{display:grid;grid-template-columns:320px 1fr;gap:6rem;}
.why-grid{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(255,255,255,.1);}
.why-cell{padding:2rem;border-bottom:1px solid rgba(255,255,255,.1);}
.why-n{color:var(--gold);font-size:.7rem;} .why-t{font-family:var(--serif);color:#fff;margin:.7rem 0;} .why-d{color:rgba(255,255,255,.4);font-size:.85rem;line-height:1.7;}
.areas-list{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid #eee;margin-top:2rem;}
.area-item{padding:2rem 1rem;border-bottom:1px solid #eee;cursor:pointer;} .area-item:hover{background:#fafafa;}
.area-name{font-family:var(--serif);margin-bottom:.4rem;} .area-time{font-size:.68rem;color:var(--gold);text-transform:uppercase;letter-spacing:.08em;margin-bottom:.6rem;}
.area-desc{font-size:.82rem;line-height:1.65;color:#666;}
.fleet-section{background:#111;} .fleet-layout{display:grid;grid-template-columns:1.1fr 1fr;gap:6rem;align-items:center;}
.fleet-img-wrap{background:#1a1a1a;min-height:340px;overflow:hidden;} .fleet-img{width:100%;min-height:340px;object-fit:cover;display:block;}
.fleet-text-eyebrow{color:rgba(255,255,255,.35);text-transform:uppercase;letter-spacing:.12em;font-size:.7rem;margin-bottom:.8rem;}
.fleet-text-title{font-family:var(--serif);font-size:clamp(1.8rem,3vw,2.6rem);font-weight:400;line-height:1.15;color:#fff;margin-bottom:1rem;}
.fleet-text-sub{color:rgba(255,255,255,.45);line-height:1.75;margin-bottom:.6rem;} .fleet-text-body{color:rgba(255,255,255,.45);line-height:1.75;font-size:.9rem;}
.fleet-ev-badge{display:inline-flex;color:var(--gold);border:1px solid rgba(158,138,106,.35);padding:.4rem .8rem;margin-top:1rem;font-size:.65rem;letter-spacing:.14em;text-transform:uppercase;}
.proc-track{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid rgba(255,255,255,.08);margin-top:3rem;}
.proc-step{padding:2rem;border-right:1px solid rgba(255,255,255,.08);} .proc-step:last-child{border-right:none;}
.proc-roman{font-size:2rem;color:var(--gold);opacity:.4;} .proc-name{font-family:var(--serif);color:#fff;margin:1rem 0;} .proc-desc{color:rgba(255,255,255,.4);font-size:.85rem;line-height:1.7;}
.moments{background:#111;padding:8rem 5vw;}
.moments-inner{max-width:1200px;margin:auto;display:grid;grid-template-columns:1.35fr 1fr;gap:7rem;align-items:center;}
.moments-img-wrap{position:relative;background:#1a1a1a;min-height:340px;overflow:hidden;}
.moments-img{width:100%;aspect-ratio:16/9;object-fit:cover;display:block;}
.moments-geo{position:absolute;left:1rem;bottom:1rem;color:rgba(255,255,255,.6);font-size:.7rem;background:rgba(0,0,0,.4);padding:.35rem .7rem;}
.moments-eyebrow{font-size:.7rem;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:1rem;}
.moments-title{font-family:var(--serif);color:#fff;font-size:clamp(2rem,3vw,3rem);font-weight:400;line-height:1.2;}
.moments-title em{color:rgba(255,255,255,.45);} .moments-rule{width:2.5rem;height:2px;background:var(--gold);margin:1.5rem 0;} .moments-desc{color:rgba(255,255,255,.45);line-height:1.75;}
.closer{background:#111;color:#fff;padding:10rem 5vw;text-align:center;} .closer-inner{max-width:640px;margin:auto;}
.closer-h{font-family:var(--serif);font-size:clamp(2rem,4vw,3.4rem);font-weight:400;line-height:1.1;}
.closer-sub{color:rgba(255,255,255,.35);} .closer-btns{display:flex;gap:1rem;justify-content:center;flex-wrap:wrap;margin-top:3rem;}
footer{background:#080808;color:#fff;padding:5rem 5vw 2.5rem;}
.ft-grid{max-width:1200px;margin:auto;display:grid;grid-template-columns:1.8fr 1fr 1fr 1fr;gap:4rem;}
.ft-tagline,.ft-msg-link,.ft-links a,.ft-bottom p{color:rgba(255,255,255,.32);font-size:.8rem;}
.ft-msg-link{display:flex;align-items:center;gap:.4rem;}
.ft-col-h{font-size:.65rem;text-transform:uppercase;letter-spacing:.14em;color:rgba(255,255,255,.25);margin-bottom:1rem;}
.ft-links{list-style:none;display:grid;gap:.5rem;}
.ft-bottom{max-width:1200px;margin:4rem auto 0;border-top:1px solid rgba(255,255,255,.08);padding-top:2rem;display:flex;justify-content:space-between;}
.wa-float{position:fixed;right:2rem;bottom:2rem;background:var(--wa);color:#fff;padding:.8rem 1.3rem;z-index:999;display:flex;gap:.6rem;align-items:center;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;font-weight:600;}

/* ============================================================
   HAMBURGER & MOBİL DRAWER
   ============================================================ */
.hamburger{
  display:none;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  gap:5px;
  width:40px;height:40px;
  background:transparent;
  border:1px solid rgba(255,255,255,.22);
  cursor:pointer;
  margin-left:1rem;
  padding:0;
}
.hamburger span{
  display:block;
  width:20px;height:1.5px;
  background:rgba(255,255,255,.85);
  transition:all .25s ease;
}

/* Overlay */
.mob-overlay{
  display:none;
  position:fixed;inset:0;
  background:rgba(0,0,0,.55);
  z-index:998;
  opacity:0;
  transition:opacity .35s ease;
}
.mob-overlay.open{
  opacity:1;
}

/* Drawer */
.mob-drawer{
  position:fixed;
  top:0;right:0;bottom:0;
  width:min(360px, 88vw);
  background:#0c0c0c;
  z-index:999;
  display:flex;
  flex-direction:column;
  padding:2rem 2.2rem;
  transform:translateX(100%);
  transition:transform .38s cubic-bezier(.22,.61,.36,1);
  border-left:1px solid rgba(194,154,102,.18);
}
.mob-drawer.open{
  transform:translateX(0);
}

/* Drawer üst */
.mob-drawer-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:3rem;
}
.mob-close{
  width:38px;height:38px;
  background:rgba(255,255,255,.07);
  border:1px solid rgba(255,255,255,.12);
  color:rgba(255,255,255,.7);
  font-size:22px;
  cursor:pointer;
  display:flex;align-items:center;justify-content:center;
}

/* Drawer linkler */
.mob-nav{
  display:flex;
  flex-direction:column;
  gap:0;
  flex:1;
}
.mob-nav-link{
  font-family:var(--serif);
  font-size:2rem;
  font-weight:400;
  color:rgba(255,255,255,.82);
  padding:.7rem 0;
  border-bottom:1px solid rgba(255,255,255,.07);
  letter-spacing:-.02em;
  transition:color .2s;
}
.mob-nav-link:hover{
  color:var(--gold);
}

/* Drawer alt */
.mob-drawer-bottom{
  margin-top:2.5rem;
  display:flex;
  flex-direction:column;
  gap:1rem;
}
.mob-wa-btn{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:.6rem;
  padding:1rem;
  background:linear-gradient(180deg,#C49A60,#A8753F);
  color:#fff;
  font-size:.82rem;
  font-weight:600;
  letter-spacing:.06em;
  text-transform:uppercase;
  border:1px solid rgba(201,164,109,.5);
}
.mob-email-link{
  text-align:center;
  font-size:.72rem;
  color:rgba(255,255,255,.35);
  letter-spacing:.04em;
}

@media(max-width:1024px){
  .booking-panel-inner,.why-layout,.fleet-layout,.moments-inner{grid-template-columns:1fr;gap:3rem;}
  .hero-content{grid-template-columns:1fr;min-height:auto;}
  .hero-service-panel{width:100%;max-width:520px;}
  .areas-list{grid-template-columns:repeat(2,1fr);}
  .ft-grid{grid-template-columns:1fr 1fr;}
  .svc-layout{grid-template-columns:1fr;}
  .svc-nav{flex-direction:row;overflow-x:auto;gap:1rem;}
  .svc-nav-item{white-space:nowrap;}
  .trust-strip-inner{grid-template-columns:1fr;gap:2rem;}
  .trust-feature{border-right:none;padding:0;}
  .nav-links,.nav-btn{display:none;}
  .hamburger-btn{display:flex !important;}
  .mob-overlay{display:block;}
}
@media(max-width:768px){
  body{overflow-x:hidden;}
  .hero{min-height:auto;padding:100px 5vw 60px;}
  .hero-top,.hero-bottom{font-size:3rem;white-space:normal;}
  .hero-actions{flex-direction:column;}
  .booking-panel,.sec{padding:5rem 5vw;}
  .trust-strip{width:100%;overflow:hidden;}
  .trust-strip-inner{display:flex;flex-direction:column;gap:1.5rem;width:100%;}
  .trust-feature{display:flex;align-items:flex-start;gap:12px;width:100%;padding:0;border:none;}
  .trust-icon{flex-shrink:0;}
  .f2,.areas-list,.proc-track,.why-grid,.ft-grid{grid-template-columns:1fr;}
  .ft-bottom{flex-direction:column;}
  .closer-btns{flex-direction:column;}
  .btn-wa,.btn-outline{width:100%;justify-content:center;}
  .wa-float{right:1rem;bottom:1rem;}
}
`;

export default function Home() {
  const wa = buildWhatsAppLink({ from: "", to: "", fare: null });
  return <>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <Nav />
    <Hero />
    <TrustStrip />
    <InlineBooking />
    <Fleet />
    <CorporateSection />
    <Services />
    <WhyMoments />
    <Areas />
    <Testimonials />
    <Closer />
    <Footer />
    <a href={wa} target="_blank" rel="noopener noreferrer" className="wa-float"><WAIcon s={17} /><span>Reserve</span></a>
  </>;
}
