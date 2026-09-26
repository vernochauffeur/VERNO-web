import { useState, useEffect, useRef } from "react";
import {
  PRICING, quoteFare, totalFare, assessJourney, normalizeAirportAddress, formatPrice,
  LATE_NIGHT_WINDOW, LATE_NIGHT_SURCHARGE_LABEL, WAITING_POLICY, SPECIAL_QUOTE_NOTE,
  REGIONAL_QUOTE_LABEL, REGIONAL_QUOTE_NOTE, EVENT_FARE_LABEL, EVENT_FARE_NOTE, MAJOR_VENUE_FEE_NOTE,
  AIRPORT_FARE_EXAMPLES, POINT_TO_POINT_EXAMPLES,
} from "../lib/pricing.js";
import { getDrivingDistanceKm } from "../lib/distance.js";
import { loadGoogleMaps } from "../lib/maps.js";
import {
  VERNO_EMAIL, VERNO_PHONE, VERNO_PHONE_DISPLAY, MAX_PASSENGERS,
  buildBookingMessage, buildBlankBookingMessage, buildWhatsAppUrl, buildSmsUrl,
} from "../lib/booking.js";
import { FAQS } from "../content/faq.js";

const MOMENTS_MAIN = "/images/moments-main.jpg";
const JOURNEY_IMG_1 = "/images/journey-1.jpg";
const JOURNEY_IMG_2 = "/images/journey-2.jpg";
const JOURNEY_IMG_3 = "/images/journey-3.jpg";
const JOURNEY_IMG_4 = "/images/journey-4.jpg";
const SVC_AIRPORT = "/images/svc-airport.jpg";
const SVC_CORPORATE = "/images/svc-corporate.jpg";
const SVC_PRIVATE = "/images/svc-private.jpg";
const SVC_EVENTS = "/images/svc-events.jpg";
const FLEET_IMG = "/images/fleet.jpg";
const GENERIC_WA_URL = buildWhatsAppUrl(buildBlankBookingMessage());

function trackWhatsAppClick(source) {
  if (window.gtag) window.gtag("event", "whatsapp_click", { source });
}

function goToBookingForm() {
  const el = document.getElementById("from");
  if (!el) { document.getElementById("book")?.scrollIntoView({ behavior: "smooth" }); return; }
  el.focus({ preventScroll: true });
  setTimeout(() => {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, 400);
}

// Driving distance for one route. Only the latest request can update state, so a
// slow Distance Matrix response for an old address never overwrites a newer one.
function useRouteDistance(origin, destination, enabled) {
  const active = enabled && !!origin && !!destination;
  const routeKey = active ? `${origin}\u0000${destination}` : "";
  const [state, setState] = useState({ routeKey: "", status: "idle", km: null });
  useEffect(() => {
    if (!routeKey) { setState({ routeKey: "", status: "idle", km: null }); return; }
    let current = true;
    setState({ routeKey, status: "loading", km: null });
    getDrivingDistanceKm(origin, destination).then((km) => {
      if (current) setState(km === null ? { routeKey, status: "error", km: null } : { routeKey, status: "ready", km });
    });
    return () => { current = false; };
  }, [routeKey]);
  // Never return a result that belongs to a different route (e.g. the render before the effect runs).
  if (!routeKey) return { status: "idle", km: null };
  return state.routeKey === routeKey ? state : { status: "loading", km: null };
}

// Prices one journey leg with the shared engine. Pickup time only affects the
// late-night surcharge, so changing it re-prices without a new distance request.
//
// status: idle | unlocated (no coordinates to check the service area) |
//         regional (quote required — no automatic fare) | loading | error | ready
function useLegQuote({ from, to, fromLocation, toLocation, time, date, enabled }) {
  const journey = assessJourney({ from, to, fromLocation, toLocation, date });
  const priceable = enabled && journey.located && !journey.regional;
  const origin = priceable ? normalizeAirportAddress(from, fromLocation) : "";
  const destination = priceable ? normalizeAirportAddress(to, toLocation) : "";
  const distance = useRouteDistance(origin, destination, priceable);

  let status = distance.status;
  if (enabled && !journey.located) status = "unlocated";
  else if (enabled && journey.regional) status = "regional";
  const quote = status === "ready"
    ? quoteFare({ km: distance.km, time, isAirportTransfer: journey.isAirportTransfer, atMajorVenue: !!journey.majorVenue })
    : null;

  return {
    status,
    quote,
    regional: status === "regional",
    event: enabled && journey.located ? journey.event : null,
    majorVenue: enabled && journey.located ? journey.majorVenue : null,
    pickupIsAirport: !!journey.fromAirport,
  };
}

function AddressField({ label, placeholder, value, onChange, onSelect, id, marker }) {
  const inputRef = useRef(null);
  useEffect(() => {
    let timer;
    const initAutocomplete = () => {
      if (!window.google?.maps?.places || !inputRef.current) { timer = setTimeout(initAutocomplete, 300); return; }
      const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, { componentRestrictions: { country: "au" }, fields: ["formatted_address", "name", "geometry"] });
      autocomplete.addListener("place_changed", () => {
        try {
          const place = autocomplete.getPlace();
          const selected = place.formatted_address || place.name || "";
          const loc = place.geometry?.location;
          const location = loc ? { lat: loc.lat(), lng: loc.lng() } : null;
          onChange(selected);
          if (onSelect) onSelect(selected || null, location);
        } catch(e) { console.error("Autocomplete error:", e); }
      });
    };
    initAutocomplete();
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="fg address-field">
      {label && <label className="fl" htmlFor={id}>{label}</label>}
      <div className="address-control">
        {marker && <span className={`route-marker route-marker--${marker}`} aria-hidden="true" />}
        <input
          id={id} ref={inputRef} className={`fi address-input${marker ? " has-marker" : ""}`}
          placeholder={placeholder} value={value}
          onFocus={loadGoogleMaps}
          onChange={(e) => { onChange(e.target.value); }}
          autoComplete="off"
        />
        {value && (
          <button type="button" className="clear-address-btn"
            onClick={() => { onChange(""); if (onSelect) onSelect(null); }}
            aria-label={`Clear ${label || "address"}`}
          >×</button>
        )}
      </div>
    </div>
  );
}

function WAIcon({ s = 20 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 2.12.56 4.12 1.53 5.85L0 24l6.34-1.52A11.95 11.95 0 0012 24c6.63 0 12-5.37 12-12S18.63 0 12 0zm0 22a9.96 9.96 0 01-5.19-1.37l-.37-.22-3.84.92.98-3.73-.24-.38A9.96 9.96 0 012 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35z"/></svg>; }
function MsgIcon({ s = 14 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>; }
function PhoneIcon({ s = 16 }) { return <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.58 2.81.7A2 2 0 0 1 22 16.92z"/></svg>; }
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
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    if (menuOpen) window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  const primaryLinks = [
    { href: "#services",  label: "Services",  id: "services" },
    { href: "#corporate", label: "Corporate", id: "corporate" },
    { href: "#pricing",   label: "Pricing",   id: "pricing" },
    { href: "#faq",       label: "FAQ",       id: "faq" },
  ];
  const menuLinks = [
    { href: "#services",  label: "Services",   id: "services" },
    { href: "#journey",   label: "Experience", id: "journey" },
    { href: "#corporate", label: "Corporate",  id: "corporate" },
    { href: "#pricing",   label: "Pricing",    id: "pricing" },
    { href: "#faq",       label: "FAQ",        id: "faq" },
    { href: "#areas",     label: "Coverage",   id: "areas" },
  ];

  const scrollTo = (id) => {
    close();
    setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    }, menuOpen ? 350 : 0);
  };

  return (
    <>
      <nav className={`nav${solid ? " solid" : ""}`} aria-label="Main">
        <a href="#" className="nav-logo-wrap" aria-label="VÉRNO — back to top"><VernoMark /></a>

        <ul className="nav-links">
          {primaryLinks.map((l) => (
            <li key={l.href}>
              <a href={l.href} onClick={(e) => { e.preventDefault(); scrollTo(l.id); }}>{l.label}</a>
            </li>
          ))}
        </ul>

        <div className="nav-right">
          <a href={`tel:${VERNO_PHONE}`} className="nav-phone" aria-label="Call VÉRNO">
            <PhoneIcon s={16} />
            <span className="nav-phone-num">{VERNO_PHONE_DISPLAY}</span>
          </a>
          <a href="#book" className="nav-cta" onClick={(e) => { e.preventDefault(); scrollTo("book"); }}>Get a fare</a>
          <button type="button" className="nav-menu-btn" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-expanded={menuOpen}>
            <span /><span />
          </button>
        </div>
      </nav>

      <div className={`nav-menu${menuOpen ? " open" : ""}`} role="dialog" aria-modal="true" aria-label="Menu">
        <div className="nav-menu-top">
          <VernoMark />
          <button type="button" className="nav-menu-close" onClick={close} aria-label="Close menu">×</button>
        </div>
        <nav className="nav-menu-links" aria-label="Menu links">
          {menuLinks.map((l) => (
            <a key={l.href} href={l.href} className="nav-menu-link" onClick={(e) => { e.preventDefault(); scrollTo(l.id); }}>{l.label}</a>
          ))}
        </nav>
        <div className="nav-menu-actions">
          <a href="#book" className="btn btn-inverse" onClick={(e) => { e.preventDefault(); scrollTo("book"); }}>Get your fare</a>
          <a href={`tel:${VERNO_PHONE}`} className="nav-menu-contact" onClick={close}><PhoneIcon s={16} /> {VERNO_PHONE_DISPLAY}</a>
          <a href={GENERIC_WA_URL} target="_blank" rel="noopener noreferrer" className="nav-menu-contact" onClick={() => { trackWhatsAppClick("nav_menu"); close(); }}><WAIcon s={16} /> WhatsApp</a>
          <a href={`mailto:${VERNO_EMAIL}`} className="nav-menu-contact" onClick={close}><MsgIcon s={16} /> {VERNO_EMAIL}</a>
        </div>
      </div>
    </>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="hero-inner">
        <h1 className="hero-title">Melbourne, privately.</h1>
        <p className="hero-lede">
          Private chauffeur transfers across Melbourne in a BMW i5 — airport, corporate and private travel.
          See your fare instantly, with no surge pricing and no sign-up.
        </p>
        <button type="button" className="hero-route" onClick={goToBookingForm} aria-label="Get your fare — open the fare calculator">
          <span className="hero-route-field"><span className="route-marker route-marker--dot" aria-hidden="true" />Pickup address</span>
          <span className="hero-route-field"><span className="route-marker route-marker--square" aria-hidden="true" />Where to?</span>
          <span className="hero-route-cta">Get your fare <span aria-hidden="true">→</span></span>
        </button>
        <ul className="hero-dataline" aria-label="Service overview">
          <li>Melbourne Airport</li>
          <li>Melbourne CBD</li>
          <li>Corporate travel</li>
          <li>BMW i5 electric</li>
        </ul>
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

const selectAddressNotice = (
  <div className="fare-hint">Please select an address from the dropdown to see your fare.</div>
);

const LABEL_STYLES = {
  airport: { color: "var(--fare-green)" },
  notice: { color: "var(--notice)" },
  standard: {},
};

// One journey leg in the fare panel: automatic fare, event-day guide fare, or regional quote.
function LegFare({ leg, legName, pendingText }) {
  const prefix = legName ? `${legName} · ` : "";
  if (leg.status === "regional") {
    return (
      <>
        <div className="fare-label" style={LABEL_STYLES.notice}>{prefix}{REGIONAL_QUOTE_LABEL}</div>
        <div className="fare-note">{REGIONAL_QUOTE_NOTE}</div>
      </>
    );
  }
  const quote = leg.quote;
  if (!quote) {
    return (
      <>
        <div className="fare-label" style={LABEL_STYLES.standard}>{legName}</div>
        <div className="fare-guarantee">{pendingText}</div>
      </>
    );
  }
  const label = leg.event ? EVENT_FARE_LABEL : quote.isAirportTransfer ? "Airport Transfer Fare" : "Estimated Fare";
  const style = leg.event ? LABEL_STYLES.notice : quote.isAirportTransfer ? LABEL_STYLES.airport : LABEL_STYLES.standard;
  return (
    <>
      <div className="fare-label" style={style}>{prefix}{label}</div>
      <div className="fare-price">{formatPrice(quote.fare)}</div>
      {quote.venueFee > 0 && (
        <div className="fare-guarantee">
          Includes {formatPrice(quote.venueFee)} major venue fee ({leg.majorVenue?.name})
        </div>
      )}
      {leg.event && (
        <div className="fare-note">
          <strong>{leg.event.name}.</strong> {EVENT_FARE_NOTE}
        </div>
      )}
    </>
  );
}

function returnPendingText(returnLeg, diffReturn) {
  if (returnLeg.status === "loading") return "Calculating return fare...";
  if (diffReturn && (returnLeg.status === "idle" || returnLeg.status === "unlocated")) {
    return "Select both return addresses from the dropdown to see the return fare.";
  }
  return "Return fare will be confirmed with your booking.";
}

function FareEstimate({ from, to, fromSelected, toSelected, outbound, showReturn, returnLeg, diffReturn, total }) {
  if (from.trim().length < 4 || to.trim().length < 4) return null;
  if (!fromSelected || !toSelected || outbound.status === "unlocated") return selectAddressNotice;

  if (outbound.status === "loading") {
    return <div className="fare-hint" aria-live="polite">Calculating fare...</div>;
  }

  if (outbound.status === "error") {
    return <div className="fare-hint">We couldn't calculate this route automatically. Send your request and we'll confirm your fare.</div>;
  }

  if (outbound.status !== "ready" && outbound.status !== "regional") return null;

  const returnQuote = showReturn ? returnLeg.quote : null;
  const lateOutbound = !!outbound.quote?.lateNight;
  const lateReturn = !!returnQuote?.lateNight;
  let lateNotice = null;
  if (lateOutbound && lateReturn) lateNotice = `Late-night surcharge applied (${LATE_NIGHT_WINDOW})`;
  else if (lateOutbound) lateNotice = `Late-night surcharge applied${showReturn ? " to outbound" : ""} (${LATE_NIGHT_WINDOW})`;
  else if (lateReturn) lateNotice = `Late-night surcharge applied to return (${LATE_NIGHT_WINDOW})`;

  const anyRegional = outbound.regional || (showReturn && returnLeg.regional);
  const anyEvent = !!outbound.event || (showReturn && !!returnLeg.event);
  let totalText = null;
  if (showReturn && anyRegional) totalText = "Total: to be quoted (regional)";
  else if (total != null) totalText = `Total: ${formatPrice(total)} · ${anyEvent ? "Event-day fare to be confirmed" : "Return fare included"}`;

  return (
    <div className="fare-estimate" aria-live="polite">
      {lateNotice && <div className="fare-flag">{lateNotice}</div>}
      <LegFare leg={outbound} legName={showReturn ? "Outbound" : ""} />
      {showReturn && (
        <div className="fare-leg-return">
          <LegFare leg={returnLeg} legName="Return" pendingText={returnPendingText(returnLeg, diffReturn)} />
          {totalText && (
            <div className="fare-total">{totalText}</div>
          )}
        </div>
      )}
      {(outbound.quote || returnQuote) && (
        <div className="fare-guarantee">Final fixed price confirmed when your booking is confirmed.</div>
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

function InlineBooking() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromSelected, setFromSelected] = useState(false);
  const [toSelected, setToSelected] = useState(false);
  const [fromLocation, setFromLocation] = useState(null);
  const [toLocation, setToLocation] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [pax, setPax] = useState("1");
  const [bags, setBags] = useState("1");
  const [flightNumber, setFlightNumber] = useState("");
  const [returnTrip, setReturnTrip] = useState(false);
  const [returnDate, setReturnDate] = useState("");
  const [returnTime, setReturnTime] = useState("");
  const [diffReturn, setDiffReturn] = useState(false);
  const [returnFrom, setReturnFrom] = useState("");
  const [returnTo, setReturnTo] = useState("");
  const [returnFromSelected, setReturnFromSelected] = useState(false);
  const [returnToSelected, setReturnToSelected] = useState(false);
  const [returnFromLocation, setReturnFromLocation] = useState(null);
  const [returnToLocation, setReturnToLocation] = useState(null);
  const [returnFlightNumber, setReturnFlightNumber] = useState("");
  const [errors, setErrors] = useState({});

  const hasAddress = (v) => v.trim().length >= 4;

  // Outbound leg
  const outboundReady = fromSelected && toSelected && hasAddress(from) && hasAddress(to);
  const outbound = useLegQuote({ from, to, fromLocation, toLocation, time, date, enabled: outboundReady });
  const isAirportPickup = outbound.pickupIsAirport;

  // Return leg: destination → original pickup, or the separately selected return addresses.
  const returnPickup = diffReturn ? returnFrom : to;
  const returnDropoff = diffReturn ? returnTo : from;
  const returnReady = returnTrip && (diffReturn
    ? returnFromSelected && returnToSelected && hasAddress(returnFrom) && hasAddress(returnTo)
    : outboundReady);
  const returnLeg = useLegQuote({
    from: returnPickup,
    to: returnDropoff,
    fromLocation: diffReturn ? returnFromLocation : toLocation,
    toLocation: diffReturn ? returnToLocation : fromLocation,
    time: returnTime,
    date: returnDate,
    enabled: returnReady,
  });
  const isAirportReturnPickup = returnLeg.pickupIsAirport;

  // The exact values shown in the fare panel — also used verbatim in WhatsApp / SMS.
  const showReturn = returnTrip && !!returnDate && !!returnTime;
  const outboundFare = outbound.quote?.fare ?? null;
  const returnFare = returnTrip ? returnLeg.quote?.fare ?? null : null;
  const total = returnTrip ? totalFare(outboundFare, returnFare) : null;

  const validate = () => {
    const e = {};
    if (!hasAddress(from)) e.from = "Please enter a pickup location.";
    if (!hasAddress(to))   e.to   = "Please enter a destination.";
    if (!date)             e.date = "Please select a date.";
    if (!time)             e.time = "Please select a time.";
    if (returnTrip) {
      if (!returnDate) e.returnDate = "Please select a return date.";
      if (!returnTime) e.returnTime = "Please select a return time.";
      if (diffReturn) {
        if (!hasAddress(returnFrom)) e.returnFrom = "Please enter a return pickup location.";
        if (!hasAddress(returnTo))   e.returnTo   = "Please enter a return destination.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const bookingMessage = () => buildBookingMessage({
    outbound: {
      pickup: from, dropoff: to, date, time, passengers: pax, luggage: bags,
      flightNumber: isAirportPickup ? flightNumber : "",
      fare: outboundFare, lateNight: !!outbound.quote?.lateNight,
      regional: outbound.regional, event: outbound.event?.name || "",
      venueFee: outbound.quote?.venueFee || 0,
    },
    returnLeg: returnTrip ? {
      pickup: returnPickup, dropoff: returnDropoff, date: returnDate, time: returnTime,
      flightNumber: isAirportReturnPickup ? returnFlightNumber : "",
      fare: returnFare, lateNight: !!returnLeg.quote?.lateNight,
      regional: returnLeg.regional, event: returnLeg.event?.name || "",
      venueFee: returnLeg.quote?.venueFee || 0,
    } : null,
    total,
  });

  const trackConversion = () => {
    if (window.gtag) {
      window.gtag('event', 'conversion', {
        'send_to': 'AW-18141523015/sdWqCPHY0bwcEMfYxspD'
      });
    }
  };

  const handleWA = () => {
    if (!validate()) return;
    trackConversion();
    trackWhatsAppClick("booking_form");
    window.open(buildWhatsAppUrl(bookingMessage()), "_blank", "noopener");
  };

  const handleSMS = () => {
    if (!validate()) return;
    trackConversion();
    window.location.href = buildSmsUrl(bookingMessage());
  };

  const resetReturnAddresses = () => {
    setReturnFrom(""); setReturnTo("");
    setReturnFromSelected(false); setReturnToSelected(false);
    setReturnFromLocation(null); setReturnToLocation(null);
    setErrors((p) => ({ ...p, returnFrom: null, returnTo: null }));
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
    for (let i = 0; i < 96; i++) {
      const hour = Math.floor(i / 4);
      const minute = String((i % 4) * 15).padStart(2, "0");
      const slot = `${String(hour).padStart(2, "0")}:${minute}`;
      if (new Date(`${forDate}T${slot}`) >= minBooking) slots.push(slot);
    }
    return slots;
  };


  return (
    <div className="booking-panel" id="book">
      <div className="booking-panel-inner">
        <div className="booking-intro">
          <h2 className="booking-panel-headline">Your fare, before you book.</h2>
          <p className="booking-panel-sub">Enter your pickup and destination to see your fare — no commitment required.</p>
          <ol className="booking-facts">
            <li><span className="booking-fact-n">01</span><span><strong>Instant fare</strong>Calculated from your route as you type.</span></li>
            <li><span className="booking-fact-n">02</span><span><strong>Fixed price confirmed before you travel</strong>We confirm your final price when your booking is accepted.</span></li>
            <li><span className="booking-fact-n">03</span><span><strong>Direct booking</strong>By WhatsApp, SMS, phone or email. No app, no platform fees.</span></li>
          </ol>
          <p className="form-stars" aria-label="Rated 5.0 on Google">
            <span className="form-stars-icons" aria-hidden="true">★</span>
            <span className="form-stars-text">5.0 on Google Reviews</span>
          </p>
        </div>

        <div className="booking-panel-form">
          <button type="button" className="quick-chip" onClick={() => { setTo("Melbourne Airport (Tullamarine) VIC, Australia"); setToSelected(true); setToLocation(null); setErrors((p) => ({ ...p, to: null })); }}>
            Going to Melbourne Airport? Set it as your destination <span aria-hidden="true">→</span>
          </button>

          <AddressField id="from" label="Pickup" marker="dot" placeholder="Suburb, hotel or airport — fare shown instantly" value={from}
            onChange={(v) => { setFrom(v); setFromSelected(false); setFromLocation(null); setErrors((p) => ({ ...p, from: null })); }}
            onSelect={(v, location) => { setFromSelected(!!v); setFromLocation(v ? location : null); }}
          />
          {errors.from && <span className="field-error">{errors.from}</span>}

          <AddressField id="to" label="Destination" marker="square" placeholder="Suburb, hotel or airport — fare shown instantly" value={to}
            onChange={(v) => { setTo(v); setToSelected(false); setToLocation(null); setErrors((p) => ({ ...p, to: null })); }}
            onSelect={(v, location) => { setToSelected(!!v); setToLocation(v ? location : null); }}
          />
          {errors.to && <span className="field-error">{errors.to}</span>}

          <div>
            {isAirportPickup && (
              <div className="fg" style={{ marginBottom:"1rem" }}>
                <label className="fl">Flight Number</label>
                <input className="fi" placeholder="e.g. EK408" value={flightNumber} onChange={(e) => setFlightNumber(e.target.value.toUpperCase())} />
                <p className="field-help">We monitor your flight to ensure perfect pickup timing.</p>
              </div>
            )}

            <div className="f2" style={{ marginBottom:"1rem" }}>
              <div className="fg">
                <label className="fl">Date</label>
                <input className="fi" type="date" value={date} min={getTodayLocal()} onChange={handleDateChange} />
                {errors.date && <span className="field-error">{errors.date}</span>}
              </div>
              <div className="fg">
                <label className="fl">Time</label>
                <select className="fi" value={time} onChange={(e) => { setTime(e.target.value); setErrors((p) => ({ ...p, time: null })); }}>
                  <option value="">Select time</option>
                  {!date ? <option disabled>Please select date first</option>
                    : getSlots(date).length === 0 ? <option disabled>No available times</option>
                    : getSlots(date).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                {errors.time && <span className="field-error">{errors.time}</span>}
              </div>
            </div>

            <div className="f2" style={{ marginBottom:"1rem" }}>
              <div className="fg">
                <label className="fl">Passengers</label>
                <select className="fi" value={pax} onChange={(e) => setPax(e.target.value)}>
                  {Array.from({ length: MAX_PASSENGERS }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="fg">
                <label className="fl">Luggage</label>
                <select className="fi" value={bags} onChange={(e) => setBags(e.target.value)}>
                  {[0,1,2,3,4,5,6,7].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            <button type="button" className="switch" role="switch" aria-checked={returnTrip}
              onClick={() => { setReturnTrip(!returnTrip); setReturnDate(""); setReturnTime(""); setDiffReturn(false); setReturnFlightNumber(""); resetReturnAddresses(); setErrors((p) => ({ ...p, returnDate: null, returnTime: null })); }}>
              <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
              <span className="switch-label">Add return trip</span>
            </button>

            {returnTrip && (
              <div className="return-panel">
                <p className="return-panel-title">Return journey</p>
                <div className="f2" style={{ marginBottom:"1rem" }}>
                  <div className="fg">
                    <label className="fl">Return Date</label>
                    <input className="fi" type="date" value={returnDate} min={date || getTodayLocal()}
                      onChange={(e) => { const s = e.target.value; if (date && s < date) { setReturnDate(date); setReturnTime(""); return; } setReturnDate(s); setReturnTime(""); }}
                      />
                    {errors.returnDate && <span className="field-error">{errors.returnDate}</span>}
                  </div>
                  <div className="fg">
                    <label className="fl">Return Time</label>
                    <select className="fi" value={returnTime} onChange={(e) => { setReturnTime(e.target.value); setErrors((p) => ({ ...p, returnTime: null })); }}>
                      <option value="">Select time</option>
                      {!returnDate ? <option disabled>Please select date first</option>
                        : (() => { const slots = getSlots(returnDate); const filtered = returnDate === date && time ? slots.filter(s => s > time) : slots;
                          return filtered.length === 0 ? <option disabled>No available times</option> : filtered.map((s) => <option key={s} value={s}>{s}</option>); })()}
                    </select>
                    {errors.returnTime && <span className="field-error">{errors.returnTime}</span>}
                  </div>
                </div>
                <button type="button" className="switch switch--small" role="switch" aria-checked={diffReturn}
                  onClick={() => { setDiffReturn(!diffReturn); resetReturnAddresses(); }}>
                  <span className="switch-track" aria-hidden="true"><span className="switch-knob" /></span>
                  <span className="switch-label">Different return address</span>
                </button>
                <div className="return-addresses" style={{ display: diffReturn ? "flex" : "none" }}>
                  <div className="fg">
                    <label className="fl">Return Pickup</label>
                    <AddressField id="returnFrom" label="" placeholder="Enter return pickup address" value={returnFrom}
                      onChange={(v) => { setReturnFrom(v); setReturnFromSelected(false); setReturnFromLocation(null); setErrors((p) => ({ ...p, returnFrom: null })); }}
                      onSelect={(v, location) => { setReturnFromSelected(!!v); setReturnFromLocation(v ? location : null); }} />
                    {errors.returnFrom && <span className="field-error">{errors.returnFrom}</span>}
                  </div>
                  <div className="fg">
                    <label className="fl">Return Destination</label>
                    <AddressField id="returnTo" label="" placeholder="Enter return destination" value={returnTo}
                      onChange={(v) => { setReturnTo(v); setReturnToSelected(false); setReturnToLocation(null); setErrors((p) => ({ ...p, returnTo: null })); }}
                      onSelect={(v, location) => { setReturnToSelected(!!v); setReturnToLocation(v ? location : null); }} />
                    {errors.returnTo && <span className="field-error">{errors.returnTo}</span>}
                  </div>
                </div>
                {isAirportReturnPickup && (
                  <div className="fg">
                    <label className="fl">Return Flight Number</label>
                    <input className="fi" type="text" placeholder="e.g. QF409" value={returnFlightNumber}
                      onChange={(e) => setReturnFlightNumber(e.target.value.toUpperCase())} />
                  </div>
                )}
              </div>
            )}
          </div>

          <FareEstimate from={from} to={to} fromSelected={fromSelected} toSelected={toSelected}
            outbound={outbound} showReturn={showReturn} returnLeg={returnLeg} diffReturn={diffReturn} total={total} />

          <button type="button" className="btn btn-primary btn-block booking-submit" onClick={handleWA}>
            <WAIcon s={18} /> Confirm via WhatsApp
          </button>
          <div className="booking-alt">
            <button className="btn-text-link" onClick={handleSMS}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>
              Book via SMS
            </button>
            <span className="booking-alt-sep" aria-hidden="true" />
            <a href={`tel:${VERNO_PHONE}`} className="btn-text-link">
              <PhoneIcon s={15} />
              Call us
            </a>
            <span className="booking-alt-sep" aria-hidden="true" />
            <a href={`mailto:${VERNO_EMAIL}?subject=Booking Request`} className="btn-text-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              Email us
            </a>
          </div>
          <p className="wa-trust-line">Instant response · No commitment · Fixed pricing</p>
        </div>
      </div>
    </div>
  );
}

const SERVICES = [
  {
    label: "Airport Transfers",
    h: "Airport Transfers",
    img: SVC_AIRPORT,
    d: `Your flight lands, we're already there. Tullamarine and Avalon transfers with real-time flight tracking, ${PRICING.WAITING.AIRPORT_COMPLIMENTARY_MINUTES} minutes complimentary waiting from landing and a fixed fare — no surprises.`,
    features: ["Flight tracked in real-time", "Fixed fare, no surprises", "Driver in position on arrival"]
  },
  {
    label: "Corporate",
    h: "Corporate Travel",
    img: SVC_CORPORATE,
    d: "First impressions start before the meeting. Punctual, discreet ground transport for executives, clients and business guests across Melbourne.",
    features: ["Discreet & punctual, guaranteed", "Direct booking, no platforms", "Consistent standard, every time"]
  },
  {
    label: "Private Hire",
    h: "Private Hire",
    img: SVC_PRIVATE,
    d: "From the Great Ocean Road to the Yarra Valley wineries — day trips, wine tastings and Victoria's best destinations, handled in comfort.",
    features: ["Your route, your schedule", "Full day availability", "Fixed fare confirmed upfront"]
  },
  {
    label: "Events",
    h: "Events & Occasions",
    img: SVC_EVENTS,
    d: "Weddings, dinners, shopping trips or a day out — we handle the driving so you can focus on the moment. Luggage, parcels, bags — all taken care of.",
    features: ["Luggage & parcels handled", "Flexible pickup & drop-off", "Available for full day hire"]
  }
];

function CorporateSection() {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [monthlyTrips, setMonthlyTrips] = useState("");
  const [typicalRoute, setTypicalRoute] = useState("");
  const [details, setDetails] = useState("");
  const handleSubmit = () => {
    const subject = "Corporate Chauffeur Enquiry";
    const body = [
      `Name: ${name}`,
      `Company: ${company}`,
      `Email: ${email}`,
      `Estimated monthly trips: ${monthlyTrips}`,
      `Typical route: ${typicalRoute}`,
      "",
      "Details:",
      details,
    ].join("\n");
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
          <div className="fg"><label className="fl">Estimated Monthly Trips</label><select className="fi" value={monthlyTrips} onChange={(e) => setMonthlyTrips(e.target.value)}><option value="">Select</option><option>1–5 trips</option><option>5–15 trips</option><option>15+ trips</option></select></div>
          <div className="fg"><label className="fl">Typical Route</label><input className="fi" placeholder="e.g. Melbourne Airport ↔ CBD" value={typicalRoute} onChange={(e) => setTypicalRoute(e.target.value)} /></div>
          <div className="fg"><label className="fl">Additional Details (optional)</label><textarea className="fi" rows="3" placeholder="Any specific requirements..." value={details} onChange={(e) => setDetails(e.target.value)} /></div>
          <button className="btn-whatsapp" onClick={handleSubmit}>Request Corporate Account Access</button>
          <p style={{ fontSize: "12px", color: "#999", marginTop: "14px" }}>Suitable for businesses of all sizes — from occasional bookings to ongoing travel requirements.</p>
        </div>
      </div>
    </section>
  );
}

function Services() {
  return (
    <section className="sec" id="services" style={{ background:"#f5ead4", overflow:"hidden" }}>
      <div className="wrap">
        <div className="s-label">Services</div>
        <h2 className="s-h">Every journey,<br /><span className="gold-em">handled.</span></h2>
      </div>

      <div className="svc-scroll-wrap">
        <div className="svc-scroll-track">
          {SERVICES.map((s) => (
            <div key={s.label} className="svc-card">
              <div className="svc-card-img-wrap">
                <img src={s.img} alt={`${s.h} Melbourne — VÉRNO Chauffeur BMW i5`} className="svc-card-img" loading="lazy" />
              </div>
              <div className="svc-card-body">
                <div className="svc-card-label">{s.label}</div>
                <h3 className="svc-card-title">{s.h}</h3>
                <p className="svc-card-desc">{s.d}</p>
                <ul className="svc-card-features">
                  {s.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                <a href="#book" className="svc-card-btn" onClick={(e) => { e.preventDefault(); document.getElementById("book")?.scrollIntoView({ behavior:"smooth" }); }}>Get Fare Estimate &rarr;</a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function JourneyMoments() {
  const [active, setActive] = useState(0);
  const moments = [
    { num: "01", title: "We're already there.", desc: "Your flight lands. Your chauffeur was waiting before you even walked through arrivals. No calls, no searching — just a name board and a calm presence.", img: JOURNEY_IMG_1, color: "#f5ede0" },
    { num: "02", title: "Your space. Your silence.", desc: "The cabin is quiet, the temperature is right. Conversation if you want it. Silence if you don't. This is your space for the next hour.", img: JOURNEY_IMG_2, color: "#e8f0f5" },
    { num: "03", title: "Your bags, handled.", desc: "Heavy luggage, shopping bags, laptop case — loaded without being asked. You walked to the car. Everything else was taken care of.", img: JOURNEY_IMG_3, color: "#f0ede8" },
    { num: "04", title: "Door closed. Journey done.", desc: "You're home. Or at your hotel. Or at the meeting. The door closes quietly behind you. That's exactly how it should feel.", img: JOURNEY_IMG_4, color: "#e8ede8" },
  ];

  return (
    <section className="journey-section" id="journey">
      <div className="wrap" style={{ paddingBottom:"3rem" }}>
        <div className="s-label">The Experience</div>
        <h2 className="s-h">From the moment<br /><span className="gold-em">we arrive.</span></h2>
      </div>
      <div className="journey-cards">
        {moments.map((m, i) => (
          <div
            key={m.num}
            className={`journey-card ${active === i ? "active" : ""}`}
            style={{ "--card-color": m.color }}
            onPointerEnter={() => setActive(i)}
            onPointerDown={() => setActive(i)}
          >
            {m.img && <div className="journey-card-bg" style={{ backgroundImage: `url(${m.img})` }} role="img" aria-label={`${m.title} - VÉRNO Chauffeur Melbourne`} />}
            <div className="journey-card-overlay" />
            <div className="journey-card-content">
              <span className="journey-card-num">{m.num}</span>
              <h3 className="journey-card-title">{m.title}</h3>
              <p className="journey-card-desc">{m.desc}</p>
              <div className="journey-card-rule" />
            </div>
          </div>
        ))}
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
          <div className="why-moments-img-wrap">
            <img src={MOMENTS_MAIN} alt="VÉRNO BMW i5 chauffeur service Melbourne" className="why-moments-img" loading="lazy" />
            <span className="moments-geo">Melbourne — Private Transfers</span>
          </div>
          <div className="why-moments-text">
            <div className="s-label inv">Why VÉRNO</div>
            <h2 className="s-h inv">A boutique<br /><span className="gold-em">standard.</span></h2>
            <p className="s-body" style={{ marginBottom:"1.2rem" }}>Small fleet. Consistent quality. Every detail considered.</p>
            <p className="s-body" style={{ marginBottom:"2.5rem", fontSize:".85rem", opacity:.7 }}>
              Melbourne's premium private chauffeur service operating a modern BMW i5 fleet across CBD, St Kilda, South Yarra, Toorak, Brighton, Hawthorn and surrounding suburbs. Specialising in Tullamarine and Avalon airport transfers, corporate travel for business districts including Docklands and Southbank, and private day hire to Mornington Peninsula, Yarra Valley and the Great Ocean Road. ABN registered, fully licensed CPV operator.
            </p>
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

function Pricing() {
  const airports = AIRPORT_FARE_EXAMPLES;
  const pointToPoint = POINT_TO_POINT_EXAMPLES;

  return (
    <section id="pricing" style={{ background:"#f5ead4", padding:"5rem 5vw" }}>
      <div className="wrap">
        <div className="s-label">Pricing</div>
        <h2 className="s-h" style={{ color:"#111" }}>Simple,<br /><span className="gold-em">fixed pricing.</span></h2>
        <p style={{ fontSize:".95rem", color:"#666", marginBottom:"3rem", maxWidth:500 }}>Every fare confirmed before you travel. No surge, no hidden fees.</p>

        <div className="pricing-grid">
          <div className="pricing-table">
            <div className="pricing-table-label">Airport Transfers</div>
            {airports.map((r) => (
              <div key={r.from + r.to} className="pricing-row">
                <span className="pricing-route">{r.from} &rarr; {r.to}</span>
                <span className="pricing-price">from {formatPrice(r.price)}</span>
              </div>
            ))}
          </div>
          <div className="pricing-table">
            <div className="pricing-table-label">Point to Point</div>
            {pointToPoint.map((r) => (
              <div key={r.from + r.to} className="pricing-row">
                <span className="pricing-route">{r.from} &rarr; {r.to}</span>
                <span className="pricing-price">from {formatPrice(r.price)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pricing-note">
          <p>Late-night surcharge of {LATE_NIGHT_SURCHARGE_LABEL} applies to pickups {LATE_NIGHT_WINDOW} &middot; Your fare is calculated instantly in the booking form.</p>
          <p>{WAITING_POLICY}</p>
          <p>{MAJOR_VENUE_FEE_NOTE}</p>
          <p>{SPECIAL_QUOTE_NOTE}</p>
          <a href="#book" className="pricing-cta" onClick={(e) => { e.preventDefault(); document.getElementById("book")?.scrollIntoView({ behavior:"smooth" }); }}>
            Calculate your fare &rarr;
          </a>
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
    <section className="sec" id="areas" style={{ background:"#fdf9f4" }}>
      <div className="wrap">
        <div className="s-label">Coverage</div>
        <h2 className="s-h">Across Melbourne<br /><span className="gold-em">and beyond.</span></h2>
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
            <h2 className="fleet-text-title">BMW i5<br /><span className="gold-em">eDrive40</span></h2>
            <p className="fleet-text-sub">Zero emissions. Executive comfort. Built for Melbourne.</p>
            <p className="fleet-text-body">VÉRNO operates premium electric vehicles for comfort, consistency, and a seamless journey.</p>
            <div className="fleet-ev-badge">100% Electric - BMW i5</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState(null);
  const faqs = FAQS;

  return (
    <section id="faq" style={{ background:"#fdf9f4", padding:"5rem 5vw" }}>
      <div className="wrap" style={{ maxWidth:"800px" }}>
        <div className="s-label" style={{ color:"#C4954A" }}>FAQ</div>
        <h2 className="s-h" style={{ color:"#111", marginBottom:"2.5rem" }}>Frequently asked<br /><span className="gold-em">questions.</span></h2>
        <div className="faq-list">
          {faqs.map((item, i) => (
            <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
              <button className="faq-question" onClick={() => setOpen(open === i ? null : i)}>
                <span>{item.q}</span>
                <span className="faq-icon">{open === i ? "−" : "+"}</span>
              </button>
              <div className="faq-answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function AboutSEO() {
  return (
    <section id="about" style={{ background:"#fdf9f4", padding:"4rem 5vw 3rem", textAlign:"center" }}>
      <div className="wrap" style={{ maxWidth:"760px" }}>
        <div className="s-label" style={{ color:"#C4954A", marginBottom:"1rem" }}>About VÉRNO</div>
        <h2 style={{ fontFamily:"var(--serif)", fontSize:"1.8rem", fontWeight:600, color:"#111", marginBottom:"1.5rem", lineHeight:1.3 }}>
          Melbourne's <span style={{ color:"#C4954A", fontStyle:"italic" }}>private chauffeur</span> service.
        </h2>
        <p style={{ fontSize:".92rem", lineHeight:1.8, color:"#555", marginBottom:"1rem" }}>
          VÉRNO operates a modern BMW i5 electric fleet across Melbourne — providing premium private chauffeur transfers from CBD, St Kilda, South Yarra, Toorak, Brighton, Hawthorn and surrounding suburbs. We specialise in fixed-fare Tullamarine and Avalon airport transfers, corporate ground transport for executives and business guests, and private day hire to the Mornington Peninsula, Yarra Valley wineries and the Great Ocean Road.
        </p>
        <p style={{ fontSize:".85rem", lineHeight:1.8, color:"#777" }}>
          ABN registered · Licensed CPV operator · Direct booking · No surge pricing
        </p>
      </div>
    </section>
  );
}

function Closer() {
  return (
    <section className="closer" id="contact">
      <div className="closer-inner">
        <p className="s-label inv closer-label">Melbourne, Victoria</p>
        <h2 className="closer-h">Ready when<br /><span className="gold-em">you are.</span></h2>
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
        <div><p className="ft-col-h">Reservations</p><ul className="ft-links"><li><a href={`tel:${VERNO_PHONE}`}>{VERNO_PHONE_DISPLAY}</a></li><li><a href="#book">Fare Estimate</a></li><li><a href={`mailto:${VERNO_EMAIL}`}>{VERNO_EMAIL}</a></li></ul></div>
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
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter+Tight:wght@300;400;500;600&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&text=V%C3%89RNO&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0} html{scroll-behavior:smooth}
:root{--gold:#C4954A;--gold2:#D4A55A;--black:#0f0d0a;--white:#fdf9f4;--wa:#128C7E;--serif:'Instrument Serif',Georgia,serif;--sans:'Inter Tight','Inter',Arial,sans-serif}
body{font-family:var(--sans);background:#0f0d0a;color:#111;-webkit-font-smoothing:antialiased;overflow-x:hidden} a{text-decoration:none;color:inherit} button,input,select{font-family:var(--sans)}
.verno-logo{display:flex;flex-direction:column;align-items:flex-start;line-height:1;} .verno-logo-top{display:flex;align-items:center;gap:12px;} .verno-dot{width:11px;height:11px;border-radius:50%;background:var(--gold);display:inline-block;} .verno-word{font-family:var(--serif);font-size:32px;font-weight:600;letter-spacing:.22em;color:#fff;} .verno-city{margin-left:38px;margin-top:6px;font-family:var(--sans);font-size:10px;letter-spacing:.42em;color:rgba(255,255,255,.45);}
.btn-wa-note{font-size:.75rem;color:rgba(255,255,255,.45);margin-top:.4rem;display:block;}
.trust-small-icon{width:19px;height:19px;fill:none;stroke:#B98B55;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0;}
.lux-icon{width:38px;height:38px;fill:none;stroke:currentColor;stroke-width:3.2;stroke-linecap:round;stroke-linejoin:round;}
.trust-strip{display:flex;flex-wrap:wrap;gap:18px;color:rgba(247,245,240,.76);font-size:12px;letter-spacing:.14em;text-transform:uppercase;background:rgba(18,18,18,.96);padding:2.25rem 5vw;border-top:1px solid rgba(201,164,109,.11);border-bottom:1px solid rgba(201,164,109,.11);}
.trust-strip-inner{max-width:1050px;margin:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:0;}
.trust-feature{display:grid;grid-template-columns:52px 1fr;gap:1.3rem;align-items:flex-start;padding:0 2.6rem;border-right:1px solid rgba(255,255,255,.08);}
.trust-feature:last-child{border-right:none;}
.trust-icon{color:#B98B55;opacity:.95;}
.trust-feature h4{font-size:.72rem;color:rgba(255,255,255,.9);letter-spacing:.14em;text-transform:uppercase;margin-bottom:.55rem;}
.trust-feature p{font-size:.82rem;line-height:1.65;color:rgba(255,255,255,.42);}
.btn-wa{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;padding:1rem 1.8rem;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;background:var(--wa);color:#fff;}
.btn-outline{display:inline-flex;align-items:center;justify-content:center;gap:.6rem;padding:1rem 1.8rem;font-size:.8rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;border:1px solid rgba(255,255,255,.22);color:rgba(255,255,255,.7);}
.btn-o{display:inline-flex;align-items:center;gap:.6rem;padding:1rem 1.8rem;font-size:.8rem;font-weight:500;letter-spacing:.06em;text-transform:uppercase;border:1px solid #e5e5e5;color:#555;}
.sec{padding:6rem 5vw} .sec.dark{background:#1a1510} .night2{background:#0f0d0a} .wrap{max-width:1200px;margin:auto}
.s-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:1.2rem;}
.inv{color:var(--gold)} .s-h{font-family:var(--serif);font-size:clamp(2rem,4vw,3.4rem);font-weight:400;line-height:1.1;margin-bottom:2rem;} .s-h.inv{color:#fff;}
.s-h-em,.booking-panel-headline-em,.fleet-text-title-em,.closer-h-em,.gold-em{color:var(--gold);font-style:italic;}
.s-body{color:rgba(255,255,255,.5);line-height:1.75;}
.booking-panel-inner{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:360px 620px;gap:6rem;align-items:center;justify-content:center;}
.booking-panel-headline{font-family:var(--serif);font-size:clamp(2.2rem,3vw,3rem);font-weight:400;line-height:1.05;margin-bottom:1.6rem;}
.fg{position:relative;margin-bottom:1.15rem;} .fl{display:block;font-size:.68rem;text-transform:uppercase;letter-spacing:.14em;color:#999;margin-bottom:.55rem;}
.fi{width:100%;height:56px;padding:0 18px;background:#fafafa;border:1px solid #e6e6e6;border-radius:12px;outline:none;font-size:.9rem;color:#111;}
.fi:focus{background:#fff;border-color:#B98B55;box-shadow:0 0 0 3px rgba(185,139,85,.12);}
textarea.fi{height:auto;padding:14px 18px;resize:vertical;}
.fi[type="date"]{height:56px;padding:0 18px;-webkit-appearance:none;appearance:none;line-height:normal;}
.f2{display:grid;grid-template-columns:1fr 1fr;gap:1.15rem;align-items:end;}
.btn-whatsapp{width:100%;height:58px;display:flex;align-items:center;justify-content:center;gap:.65rem;background:linear-gradient(180deg,#D4A96F,#A8753F);color:#111;border:1px solid rgba(212,169,111,.65);border-radius:14px;font-size:.86rem;font-weight:700;letter-spacing:.03em;margin-top:1.8rem;cursor:pointer;}
.btn-whatsapp:hover{filter:brightness(1.06);}
.btn-reserve-fare{width:100%;padding:1rem;background:#1a1510;color:#fff;border:none;cursor:pointer;font-size:.85rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;border-radius:2px;margin-top:.5rem;transition:background .2s;}
.btn-reserve-fare:hover{background:#2a2318;}
.btn-text-link{display:inline-flex;align-items:center;gap:.4rem;font-size:.78rem;font-weight:500;color:#666;background:none;border:none;cursor:pointer;padding:0;letter-spacing:.04em;text-decoration:none;transition:color .2s;}
.btn-text-link:hover{color:#C4954A;}
.btn-email-secondary{display:block;text-align:center;font-size:.75rem;color:#999;margin-top:.85rem;}
.corporate-section{padding:5rem 5vw;background:#fdf9f4;}
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
.pricing-grid{display:grid;grid-template-columns:1fr 1fr;gap:3rem;margin-bottom:2.5rem;}
.pricing-table{display:flex;flex-direction:column;gap:0;}
.pricing-table-label{font-size:.7rem;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#C4954A;margin-bottom:1rem;}
.pricing-row{display:flex;justify-content:space-between;align-items:center;padding:.75rem 0;border-bottom:1px solid rgba(0,0,0,.07);}
.pricing-route{font-size:.9rem;color:#444;}
.pricing-price{font-family:var(--serif);font-size:1.1rem;font-weight:600;color:#111;}
.pricing-note{margin-top:2rem;padding-top:1.5rem;border-top:1px solid rgba(0,0,0,.08);}
.pricing-note p{font-size:.82rem;color:#888;margin-bottom:.8rem;}
.pricing-cta{font-size:.88rem;font-weight:500;color:#C4954A;letter-spacing:.04em;}
.pricing-cta:hover{color:#9a7040;}
.faq-list{display:flex;flex-direction:column;gap:0;}
.faq-item{border-bottom:1px solid rgba(0,0,0,.1);}
.faq-question{width:100%;display:flex;align-items:center;justify-content:space-between;gap:1rem;padding:1.3rem 0;background:none;border:none;cursor:pointer;text-align:left;font-family:var(--serif);font-size:1.05rem;font-weight:500;color:#111;transition:color .2s;}
.faq-question:hover{color:#C4954A;}
.faq-icon{font-size:1.5rem;color:#C4954A;font-weight:300;line-height:1;flex-shrink:0;}
.faq-answer{max-height:0;overflow:hidden;transition:max-height .35s ease;}
.faq-item.open .faq-answer{max-height:300px;}
.faq-answer p{padding:0 0 1.3rem;font-size:.9rem;line-height:1.75;color:#555;}
@media(max-width:768px){.faq-question{font-size:.95rem;}.faq-answer p{font-size:.85rem;}}
@media(max-width:768px){.pricing-grid{grid-template-columns:1fr;gap:2rem;}}
.journey-section{background:#0f0d0a;padding:4rem 0 0;}
.journey-section .wrap{padding-bottom:2rem;}
.journey-section .s-label{color:var(--gold);}
.journey-section .s-h{color:#fff;}
.journey-cards{display:flex;height:600px;}
.journey-card{position:relative;flex:1;transition:flex .5s cubic-bezier(.4,0,.2,1);overflow:hidden;cursor:pointer;}
.journey-card.active{flex:2.5;}
.journey-card-bg{position:absolute;inset:0;background-size:cover;background-position:center;transition:transform .6s ease;transform:scale(1.06);}
.journey-card.active .journey-card-bg{transform:scale(1);}
.journey-card-overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.8) 0%,rgba(0,0,0,.2) 60%,rgba(0,0,0,.05) 100%);transition:opacity .4s;}
.journey-card-content{position:absolute;bottom:0;left:0;right:0;padding:2rem 1.8rem;color:#fff;}
.journey-card-num{display:block;font-family:var(--serif);font-size:3rem;font-weight:600;color:rgba(194,154,102,.5);line-height:1;margin-bottom:.4rem;transition:color .3s;}
.journey-card.active .journey-card-num{color:rgba(194,154,102,.9);}
.journey-card-title{font-family:var(--serif);font-size:.95rem;font-weight:600;line-height:1.3;margin-bottom:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:font-size .3s;}
.journey-card.active .journey-card-title{white-space:normal;font-size:1.45rem;margin-bottom:.85rem;}
.journey-card-desc{font-size:.83rem;line-height:1.7;color:rgba(255,255,255,.78);max-height:0;overflow:hidden;opacity:0;transition:max-height .45s ease,opacity .35s ease .05s;}
.journey-card.active .journey-card-desc{max-height:150px;opacity:1;}
.journey-card-rule{width:0;height:2px;background:#C29A66;margin-top:1rem;transition:width .5s ease .15s;}
.journey-card.active .journey-card-rule{width:40px;}
@media(max-width:768px){
  .journey-cards{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;height:auto;}
  .journey-card{flex:none;height:240px;transition:height .4s ease;}
  .journey-card.active{height:380px;}
  .journey-card-num{font-size:2.2rem;}
  .journey-card-title{font-size:.85rem;white-space:normal;}
  .journey-card.active .journey-card-title{font-size:1.1rem;}
  .journey-card-content{padding:1.4rem;}
  .journey-card-desc{font-size:.78rem;}
}
.svc-scroll-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;padding:2.5rem 5vw 3rem;scrollbar-width:none;}
.svc-scroll-wrap::-webkit-scrollbar{display:none;}
.svc-scroll-track{display:flex;gap:1.5rem;width:max-content;}
.svc-card{width:320px;flex-shrink:0;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.07);display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s;}
.svc-card:hover{transform:translateY(-4px);box-shadow:0 12px 40px rgba(0,0,0,.12);}
.svc-card-img-wrap{height:200px;background:#111;position:relative;overflow:hidden;}
.svc-card-img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s;}
.svc-card:hover .svc-card-img{transform:scale(1.04);}
.svc-card-body{padding:1.8rem;display:flex;flex-direction:column;flex:1;}
.svc-card-label{font-size:.65rem;font-weight:500;letter-spacing:.2em;text-transform:uppercase;color:#C29A66;margin-bottom:.6rem;}
.svc-card-title{font-family:var(--serif);font-size:1.4rem;font-weight:600;color:#111;margin-bottom:.8rem;line-height:1.2;}
.svc-card-desc{font-size:.88rem;line-height:1.65;color:#555;margin-bottom:1.2rem;flex:1;}
.svc-card-features{list-style:none;padding:0;margin:0 0 1.5rem;display:flex;flex-direction:column;gap:.4rem;}
.svc-card-features li{font-size:.78rem;color:#777;padding-left:1rem;position:relative;}
.svc-card-features li::before{content:"—";position:absolute;left:0;color:#C29A66;}
.svc-card-btn{display:inline-block;font-size:.8rem;font-weight:500;letter-spacing:.06em;color:#C29A66;text-decoration:none;border-top:1px solid #f0ece6;padding-top:1rem;transition:color .2s;}
.svc-card-btn:hover{color:#9a7a50;}
@media(max-width:768px){.svc-card{width:280px;}.svc-card-img-wrap{height:160px;}}
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
.moments-geo{position:absolute;left:1rem;bottom:1rem;color:rgba(255,255,255,.6);font-size:.7rem;background:rgba(0,0,0,.4);padding:.35rem .7rem;}
.closer{background:#1a1510;color:#fff;padding:6rem 5vw;text-align:center;} .closer-inner{max-width:640px;margin:auto;}
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
@media(max-width:1024px){
  .booking-panel-inner,.why-layout,.fleet-layout,.moments-inner{grid-template-columns:1fr;gap:3rem;}
  .areas-list{grid-template-columns:repeat(2,1fr);}
  .ft-grid{grid-template-columns:1fr 1fr;}
  .svc-layout{grid-template-columns:1fr;}
  .svc-nav{flex-direction:row;overflow-x:auto;gap:1rem;}
  .svc-nav-item{white-space:nowrap;}
  .trust-strip-inner{grid-template-columns:1fr;gap:2rem;}
  .trust-feature{border-right:none;padding:0;}
}
@media(max-width:768px){
  body{overflow-x:hidden;padding-bottom:76px;}
  .trust-strip{display:none;}
  .wa-float{display:none;}
  .fi{font-size:16px;}
  .booking-panel,.sec{padding:5rem 5vw;}
  .trust-strip{width:100%;overflow:hidden;}
  .trust-strip-inner{display:flex;flex-direction:column;gap:1.5rem;width:100%;}
  .trust-feature{display:flex;align-items:flex-start;gap:12px;width:100%;padding:0;border:none;}
  .trust-icon{flex-shrink:0;}
  .f2,.areas-list,.proc-track,.why-grid,.ft-grid{grid-template-columns:1fr;}
  .ft-bottom{flex-direction:column;}
  .closer-btns{flex-direction:column;}
  .btn-wa,.btn-outline,.btn-hero-green{width:100%;justify-content:center;}
  .wa-float{right:1rem;bottom:1rem;}
}
.booking-panel-sub{max-width:330px;font-size:.95rem;line-height:1.75;color:#777;font-weight:300;}
.booking-panel-form{width:100%;max-width:620px;background:#fff;padding:2.7rem;border-radius:22px;border:1px solid rgba(0,0,0,.06);box-shadow:0 28px 80px rgba(0,0,0,.09);}
/* =====================================================================
   VÉRNO design system — Phase 1 (tokens, navigation, hero, calculator)
   ===================================================================== */
:root{
  --ink:#111213; --graphite:#26282B; --bluestone:#3E4852;
  --slate:#5E6166; --stone:#8C8F93; --placeholder:#767980;
  --rule:#D6D3CD; --rule-dark:#34363A;
  --concrete:#EDEBE7; --paper:#F6F5F2; --field:#FFFFFF;
  --bronze:#9C7A4F; --bronze-text:#7E6038; --bronze-dark:#B89468;
  --fare-green:#2F6B4F; --notice:#8A5A1F; --error:#B3261E;
  --radius-sm:2px; --radius:4px;
  --gutter:clamp(20px,5vw,80px); --maxw:1320px;
  --ease:cubic-bezier(.2,.7,.2,1);
}
body{font-synthesis-weight:none;}
.verno-word{font-family:'Playfair Display',Georgia,serif;}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;height:56px;padding:0 28px;border-radius:var(--radius-sm);border:1px solid transparent;font-family:var(--sans);font-size:15px;font-weight:500;letter-spacing:0;cursor:pointer;text-decoration:none;transition:background-color .18s var(--ease),color .18s var(--ease),border-color .18s var(--ease);}
.btn-primary{background:var(--ink);color:var(--paper);}
.btn-primary:hover{background:var(--graphite);}
.btn-primary:active{transform:translateY(1px);}
.btn-inverse{background:var(--paper);color:var(--ink);}
.btn-inverse:hover{background:#fff;}
.btn-block{width:100%;}
.btn:focus-visible,.nav a:focus-visible,.nav button:focus-visible,.nav-menu a:focus-visible,.nav-menu button:focus-visible,.hero-route:focus-visible,.switch:focus-visible,.quick-chip:focus-visible,.btn-text-link:focus-visible{outline:2px solid var(--bronze);outline-offset:2px;}

/* Navigation */
.nav{position:fixed;top:0;left:0;right:0;z-index:100;height:76px;padding:0 var(--gutter);display:flex;align-items:center;justify-content:space-between;gap:24px;background:transparent;border-bottom:1px solid transparent;transition:background-color .25s var(--ease),border-color .25s var(--ease);}
.nav.solid{background:var(--paper);border-color:var(--rule);}
.nav .verno-word{font-size:26px;}
.nav .verno-city{margin-left:34px;}
.nav.solid .verno-word{color:var(--ink);}
.nav.solid .verno-city{color:var(--slate);}
.nav-links{display:flex;gap:36px;list-style:none;}
.nav-links a{font-size:15px;color:rgba(255,255,255,.88);padding:6px 0;border-bottom:1px solid transparent;transition:border-color .18s var(--ease);}
.nav-links a:hover{border-bottom-color:currentColor;}
.nav.solid .nav-links a{color:var(--ink);}
.nav-right{display:flex;align-items:center;gap:24px;}
.nav-phone{display:inline-flex;align-items:center;gap:8px;font-size:15px;color:rgba(255,255,255,.88);font-variant-numeric:tabular-nums;}
.nav-phone:hover{text-decoration:underline;text-underline-offset:4px;}
.nav.solid .nav-phone{color:var(--ink);}
.nav-cta{display:inline-flex;align-items:center;height:44px;padding:0 20px;border-radius:var(--radius-sm);background:var(--paper);color:var(--ink);font-size:14px;font-weight:500;transition:background-color .18s var(--ease);}
.nav-cta:hover{background:#fff;}
.nav.solid .nav-cta{background:var(--ink);color:var(--paper);}
.nav.solid .nav-cta:hover{background:var(--graphite);}
.nav-menu-btn{display:none;flex-direction:column;justify-content:center;align-items:center;gap:6px;width:44px;height:44px;margin-right:-10px;background:transparent;border:0;cursor:pointer;}
.nav-menu-btn span{display:block;width:22px;height:1.5px;background:#fff;}
.nav.solid .nav-menu-btn span{background:var(--ink);}
.nav-menu{position:fixed;inset:0;z-index:1000;background:var(--ink);color:var(--paper);display:flex;flex-direction:column;padding:16px var(--gutter) calc(32px + env(safe-area-inset-bottom));overflow-y:auto;opacity:0;visibility:hidden;transition:opacity .3s var(--ease),visibility 0s linear .3s;}
.nav-menu.open{opacity:1;visibility:visible;transition:opacity .3s var(--ease);}
.nav-menu-top{display:flex;align-items:center;justify-content:space-between;min-height:60px;margin-bottom:32px;}
.nav-menu .verno-word{font-size:26px;}
.nav-menu .verno-city{margin-left:34px;}
.nav-menu-close{width:44px;height:44px;margin-right:-10px;background:transparent;border:0;color:var(--paper);font-size:32px;font-weight:300;line-height:1;cursor:pointer;}
.nav-menu-links{display:flex;flex-direction:column;margin-bottom:40px;}
.nav-menu-link{font-family:var(--serif);font-size:40px;line-height:1.1;letter-spacing:-.01em;color:var(--paper);padding:14px 0;border-bottom:1px solid var(--rule-dark);}
.nav-menu-link:hover{color:var(--bronze-dark);}
.nav-menu-actions{display:flex;flex-direction:column;gap:18px;margin-top:auto;}
.nav-menu-actions .btn{width:100%;margin-bottom:8px;}
.nav-menu-contact{display:inline-flex;align-items:center;gap:12px;font-size:16px;color:rgba(246,245,242,.82);}

/* Hero */
.hero{position:relative;display:flex;flex-direction:column;justify-content:flex-end;min-height:100vh;min-height:min(100svh,920px);padding:120px var(--gutter) 0;background:var(--ink) url("/images/hero-bg.jpg") center 70%/cover no-repeat;background-image:image-set(url("/images/hero-bg.webp") type("image/webp"),url("/images/hero-bg.jpg") type("image/jpeg"));color:#fff;overflow:hidden;}
.hero::before{content:"";position:absolute;inset:0;pointer-events:none;background:
  linear-gradient(180deg,rgba(10,10,11,.5) 0%,rgba(10,10,11,0) 22%),
  linear-gradient(0deg,rgba(10,10,11,.82) 0%,rgba(10,10,11,.45) 38%,rgba(10,10,11,0) 70%),
  linear-gradient(90deg,rgba(10,10,11,.5) 0%,rgba(10,10,11,0) 62%);}
.hero-inner{position:relative;z-index:1;width:100%;max-width:var(--maxw);margin:0 auto;}
.hero-title{font-family:var(--serif);font-weight:400;font-size:clamp(56px,8.4vw,120px);line-height:.98;letter-spacing:-.02em;color:#fff;max-width:11ch;margin-bottom:24px;}
.hero-lede{font-size:clamp(17px,1.35vw,20px);line-height:1.55;color:rgba(255,255,255,.84);max-width:36em;margin-bottom:40px;}
.hero-route{display:grid;grid-template-columns:1fr 1fr auto;width:100%;max-width:880px;padding:0;border:0;border-radius:var(--radius);overflow:hidden;background:var(--field);font:inherit;text-align:left;cursor:pointer;}
.hero-route-field{display:flex;align-items:center;gap:14px;height:64px;padding:0 22px;font-size:16px;color:var(--slate);border-right:1px solid var(--rule);}
.hero-route-cta{display:flex;align-items:center;gap:10px;height:64px;padding:0 28px;background:var(--ink);color:var(--paper);font-size:15px;font-weight:500;transition:background-color .18s var(--ease);}
.hero-route:hover .hero-route-cta{background:var(--graphite);}
.route-marker{display:inline-block;flex-shrink:0;width:8px;height:8px;background:var(--ink);}
.route-marker--dot{border-radius:50%;}
.route-marker--square{background:var(--bronze);}
.hero-dataline{display:flex;flex-wrap:wrap;gap:8px 32px;list-style:none;margin-top:48px;padding:18px 0 22px;border-top:1px solid rgba(255,255,255,.2);font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.72);}

/* Booking calculator */
.booking-panel{background:var(--concrete);color:var(--ink);padding:clamp(80px,10vw,144px) var(--gutter);}
.booking-panel .booking-panel-inner{max-width:var(--maxw);margin:0 auto;display:grid;grid-template-columns:repeat(12,minmax(0,1fr));column-gap:24px;row-gap:48px;align-items:start;justify-content:stretch;}
.booking-intro{grid-column:1 / span 4;position:sticky;top:112px;}
.booking-panel .booking-panel-headline{font-family:var(--serif);font-weight:400;font-size:clamp(40px,4.4vw,64px);line-height:1;letter-spacing:-.02em;color:var(--ink);margin-bottom:24px;}
.booking-panel .booking-panel-sub{font-size:17px;font-weight:400;line-height:1.55;color:var(--slate);max-width:26em;margin-bottom:40px;}
.booking-facts{list-style:none;border-top:1px solid var(--rule);margin-bottom:32px;}
.booking-facts li{display:grid;grid-template-columns:40px 1fr;gap:8px;padding:18px 0;border-bottom:1px solid var(--rule);font-size:15px;line-height:1.5;color:var(--slate);}
.booking-facts strong{display:block;font-weight:500;color:var(--ink);font-size:16px;margin-bottom:2px;}
.booking-fact-n{font-size:12px;letter-spacing:.08em;color:var(--bronze-text);font-variant-numeric:tabular-nums;padding-top:3px;}
.form-stars{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--slate);}
.form-stars-icons{color:var(--bronze);}
.booking-panel .booking-panel-form{grid-column:6 / span 7;width:auto;max-width:none;background:none;padding:0;border:0;border-radius:0;box-shadow:none;}
.quick-chip{display:inline-flex;align-items:baseline;justify-content:flex-start;gap:8px;margin-bottom:28px;padding:4px 0;background:none;border:0;border-bottom:1px solid var(--ink);color:var(--ink);font-family:var(--sans);font-size:15px;line-height:1.4;text-align:left;cursor:pointer;}
.quick-chip:hover{color:var(--bronze-text);border-bottom-color:var(--bronze-text);}
.booking-panel .fg{position:relative;margin-bottom:20px;}
.booking-panel .fl{display:block;font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--slate);margin-bottom:8px;}
.booking-panel .fi{width:100%;height:56px;padding:0 16px;background:var(--field);border:1px solid var(--rule);border-radius:var(--radius-sm);font-family:var(--sans);font-size:16px;color:var(--ink);outline:none;transition:border-color .15s var(--ease),box-shadow .15s var(--ease);}
.booking-panel .fi::placeholder{color:var(--placeholder);}
.booking-panel .fi:hover{border-color:#BEBAB2;}
.booking-panel .fi:focus{border-color:var(--ink);box-shadow:inset 0 0 0 1px var(--ink);background:var(--field);}
.booking-panel select.fi{appearance:none;-webkit-appearance:none;padding-right:44px;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1.5l5 5 5-5' fill='none' stroke='%23111213' stroke-width='1.4'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 16px center;}
.booking-panel .f2{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start;margin-bottom:4px;}
.booking-panel .f2 .fg{margin-bottom:20px;}
.address-control{position:relative;}
.address-control .route-marker{position:absolute;left:18px;top:50%;transform:translateY(-50%);pointer-events:none;}
.address-input{padding-right:44px !important;}
.address-input.has-marker{padding-left:42px !important;}
.clear-address-btn{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:28px;height:28px;border:0;border-radius:50%;background:transparent;color:var(--slate);font-size:20px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.clear-address-btn:hover{background:var(--concrete);color:var(--ink);}
.field-error{display:block;margin:-12px 0 16px;font-size:13px;color:var(--error);}
.booking-panel .fg .field-error{margin:6px 0 0;}
.field-help{margin-top:8px;font-size:13px;color:var(--slate);}
.switch{display:inline-flex;align-items:center;gap:12px;margin:8px 0 20px;padding:4px 0;background:none;border:0;cursor:pointer;font-family:var(--sans);font-size:15px;color:var(--ink);text-align:left;}
.switch-track{position:relative;flex-shrink:0;width:40px;height:22px;border-radius:11px;background:#C9C5BE;transition:background-color .18s var(--ease);}
.switch-knob{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .18s var(--ease);}
.switch[aria-checked="true"] .switch-track{background:var(--ink);}
.switch[aria-checked="true"] .switch-knob{transform:translateX(18px);}
.switch--small{margin:0 0 16px;font-size:14px;}
.return-panel{background:var(--paper);border:1px solid var(--rule);border-radius:var(--radius-sm);padding:24px 24px 4px;margin-bottom:20px;}
.return-panel-title{font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--slate);margin-bottom:16px;}
.return-addresses{flex-direction:column;}
.booking-panel .return-addresses .address-field{margin-bottom:0;}

/* Fare summary */
.fare-hint{margin:8px 0 24px;padding:4px 0 4px 14px;border-left:3px solid var(--bronze);font-size:15px;line-height:1.5;color:var(--slate);}
.fare-estimate{margin:8px 0 24px;padding:24px 24px 18px;background:var(--paper);border:1px solid var(--rule);border-radius:var(--radius);color:var(--ink);}
.fare-flag{margin-bottom:18px;padding:2px 0 2px 12px;border-left:3px solid var(--bronze);font-size:14px;color:var(--ink);}
.fare-label{font-size:12px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:var(--slate);margin-bottom:8px;}
.fare-price{font-family:var(--serif);font-weight:400;font-size:clamp(52px,5vw,68px);line-height:1;letter-spacing:-.01em;color:var(--ink);font-variant-numeric:lining-nums tabular-nums;}
.fare-guarantee{margin-top:10px;font-size:14px;line-height:1.5;color:var(--slate);}
.fare-note{margin-top:10px;padding-left:12px;border-left:3px solid var(--bronze);font-size:15px;line-height:1.55;color:var(--ink);}
.fare-leg-return{margin-top:20px;padding-top:20px;border-top:1px solid var(--rule);}
.fare-total{margin-top:20px;padding-top:16px;border-top:1px solid var(--ink);font-size:17px;font-weight:500;color:var(--ink);font-variant-numeric:tabular-nums;}
.fare-trust{display:flex;flex-wrap:wrap;gap:6px 20px;margin-top:18px;padding-top:14px;border-top:1px solid var(--rule);font-size:13px;color:var(--slate);}
.booking-submit{margin-top:4px;}
.booking-alt{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:12px 24px;margin-top:18px;}
.booking-alt-sep{width:1px;height:14px;background:var(--rule);}
.booking-panel .btn-text-link{display:inline-flex;align-items:center;gap:8px;padding:6px 0;background:none;border:0;font-family:var(--sans);font-size:14px;font-weight:400;letter-spacing:0;color:var(--slate);cursor:pointer;}
.booking-panel .btn-text-link:hover{color:var(--ink);text-decoration:underline;text-underline-offset:4px;}
.booking-panel .wa-trust-line{margin-top:20px;text-align:center;font-size:13px;color:var(--slate);}

/* Mobile sticky bar */
.sticky-bar{display:none;position:fixed;left:0;right:0;bottom:0;z-index:997;gap:8px;align-items:center;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:var(--ink);border-top:1px solid var(--rule-dark);}
.sb-cta{flex:1;display:flex;align-items:center;justify-content:center;height:48px;border-radius:var(--radius-sm);background:var(--paper);color:var(--ink);font-size:15px;font-weight:500;}
.sb-icon{width:48px;height:48px;flex-shrink:0;display:flex;align-items:center;justify-content:center;border:1px solid var(--rule-dark);border-radius:var(--radius-sm);color:var(--paper);}

@media(max-width:1024px){
  .nav-links,.nav-phone-num{display:none;}
  .nav-menu-btn{display:flex;}
  .nav-right{gap:16px;}
  .booking-intro{grid-column:1 / -1;position:static;}
  .booking-panel .booking-panel-form{grid-column:1 / -1;}
  .booking-facts{display:grid;grid-template-columns:repeat(3,1fr);column-gap:24px;border-top:0;}
  .booking-facts li{border-top:1px solid var(--rule);}
}
@media(max-width:768px){
  .nav{height:64px;}
  .nav .verno-word{font-size:22px;}
  .nav .verno-city{margin-left:30px;font-size:9px;}
  .nav-cta{display:none;}
  .sticky-bar{display:flex;}
  .hero{min-height:auto;padding-top:128px;background-position:60% 30%;}
  .hero-title{font-size:clamp(48px,14vw,64px);margin-bottom:18px;}
  .hero-lede{font-size:17px;margin-bottom:28px;}
  .hero-route{grid-template-columns:1fr;}
  .hero-route-field{height:56px;border-right:0;border-bottom:1px solid var(--rule);}
  .hero-route-cta{height:56px;justify-content:center;}
  .hero-dataline{margin-top:32px;gap:6px 20px;font-size:11px;}
  .booking-panel{padding:72px var(--gutter);}
  .booking-panel .booking-panel-inner{row-gap:32px;}
  .booking-facts{display:block;border-top:1px solid var(--rule);}
  .booking-facts li{border-top:0;}
  .booking-panel .f2{grid-template-columns:1fr 1fr;gap:12px;}
  .booking-panel .fi{font-size:16px;}
  .return-panel{padding:18px 16px 2px;}
  .fare-estimate{padding:20px 18px 14px;}
  .booking-alt-sep{display:none;}
}
@media(prefers-reduced-motion:reduce){
  .nav,.nav-menu,.btn,.switch-track,.switch-knob,.hero-route-cta{transition:none!important;}
}

`;

function StickyBar() {
  return (
    <div className="sticky-bar">
      <a href={`tel:${VERNO_PHONE}`} className="sb-icon" aria-label="Call Verno Chauffeur"><PhoneIcon s={19} /></a>
      <a
        href="#book"
        className="sb-cta"
        onClick={(e) => { e.preventDefault(); goToBookingForm(); }}
      >See your fare &rarr;</a>
      <a href={GENERIC_WA_URL} target="_blank" rel="noopener noreferrer" className="sb-icon sb-wa" aria-label="WhatsApp" onClick={() => trackWhatsAppClick("sticky_bar")}><WAIcon s={19} /></a>
    </div>
  );
}

export default function Home() {
  return <>
    <style dangerouslySetInnerHTML={{ __html: CSS }} />
    <Nav />
    <Hero />
    <TrustStrip />
    <InlineBooking />
    <Services />
    <JourneyMoments />
    <CorporateSection />
    <Pricing />
    <FAQ />
    <Areas />
    <AboutSEO />
    <Closer />
    <Footer />
    <a href={GENERIC_WA_URL} target="_blank" rel="noopener noreferrer" className="wa-float" onClick={() => trackWhatsAppClick("floating_button")}><WAIcon s={17} /><span>Reserve</span></a>
    <StickyBar />
  </>;
}
